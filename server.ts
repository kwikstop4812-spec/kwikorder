import express from "express";
import fs from "fs";
import path from "path";
import sql from "mssql";
import { createServer as createViteServer } from "vite";
import { getCoverageDays } from "./src/supplierConfigUtils";
import { compareByPackSize } from "./src/productUtils";

const CONFIG_FILE = path.join(process.cwd(), "supplier_configs.json");
const STARRED_FILE = path.join(process.cwd(), "starred_products.json");
const PHOTO_DIR = path.join(process.cwd(), "product_photos");
const PHOTO_MAP_FILE = path.join(process.cwd(), "product_photos.json");

const VALID_WEEKDAYS = new Set([
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]);

/** IdealPOS long description (Description3), then Description2, then Description */
const PRODUCT_DISPLAY_NAME_SQL = `
  COALESCE(
    NULLIF(LTRIM(RTRIM(si.Description3)), N''),
    NULLIF(LTRIM(RTRIM(si.Description2)), N''),
    si.Description
  )
`;

type DeliverySchedule = {
  cutOffDay: string;
  cutOffTime: string;
  deliveryDay: string;
};

type SupplierConfig = {
  schedules: DeliverySchedule[];
  safetyMultiplier: number;
};

function defaultSchedule(): DeliverySchedule {
  return {
    cutOffDay: "Friday",
    cutOffTime: "10:00",
    deliveryDay: "Monday",
  };
}

function defaultSupplierConfig(): SupplierConfig {
  return {
    schedules: [defaultSchedule()],
    safetyMultiplier: 1.2,
  };
}

function normalizeSchedule(raw: any): DeliverySchedule | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    cutOffDay: String(raw.cutOffDay || "Friday"),
    cutOffTime: String(raw.cutOffTime || "10:00"),
    deliveryDay: String(raw.deliveryDay || "Monday"),
  };
}

function normalizeSupplierConfig(raw: any): SupplierConfig {
  const fallback = defaultSupplierConfig();
  if (!raw || typeof raw !== "object") return fallback;

  const multiplier = Number(raw.safetyMultiplier);
  const safetyMultiplier =
    Number.isFinite(multiplier) && multiplier > 0 ? multiplier : fallback.safetyMultiplier;

  if (Array.isArray(raw.schedules) && raw.schedules.length > 0) {
    const schedules = raw.schedules
      .map(normalizeSchedule)
      .filter((s: DeliverySchedule | null): s is DeliverySchedule => s !== null);
    return {
      schedules: schedules.length > 0 ? schedules : [defaultSchedule()],
      safetyMultiplier,
    };
  }

  if (raw.cutOffDay || raw.deliveryDay || raw.cutOffTime) {
    return {
      schedules: [
        {
          cutOffDay: String(raw.cutOffDay || "Friday"),
          cutOffTime: String(raw.cutOffTime || "10:00"),
          deliveryDay: String(raw.deliveryDay || "Monday"),
        },
      ],
      safetyMultiplier,
    };
  }

  return { schedules: [defaultSchedule()], safetyMultiplier };
}

function getSupplierConfigs(): Record<string, SupplierConfig> {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    const out: Record<string, SupplierConfig> = {};
    for (const [id, cfg] of Object.entries(raw || {})) {
      out[id] = normalizeSupplierConfig(cfg);
    }
    return out;
  } catch {
    return {};
  }
}

function saveSupplierConfigs(configs: Record<string, SupplierConfig>) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2));
}

function getStarredMap(): Record<string, number[]> {
  if (!fs.existsSync(STARRED_FILE)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(STARRED_FILE, "utf8"));
    const out: Record<string, number[]> = {};
    for (const [id, list] of Object.entries(raw || {})) {
      if (!Array.isArray(list)) continue;
      out[id] = [...new Set(list.map((n) => Number(n)).filter((n) => Number.isFinite(n)))];
    }
    return out;
  } catch {
    return {};
  }
}

function saveStarredMap(map: Record<string, number[]>) {
  fs.writeFileSync(STARRED_FILE, JSON.stringify(map, null, 2));
}

function getStarredForSupplier(supplierId: string): number[] {
  return getStarredMap()[String(supplierId)] || [];
}

function ensurePhotoDir() {
  if (!fs.existsSync(PHOTO_DIR)) fs.mkdirSync(PHOTO_DIR, { recursive: true });
}

function getPhotoMap(): Record<string, string> {
  if (!fs.existsSync(PHOTO_MAP_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(PHOTO_MAP_FILE, "utf8")) || {};
  } catch {
    return {};
  }
}

function savePhotoMap(map: Record<string, string>) {
  fs.writeFileSync(PHOTO_MAP_FILE, JSON.stringify(map, null, 2));
}

function getPhotoUrl(productId: number | string): string | null {
  const map = getPhotoMap();
  const file = map[String(productId)];
  if (!file) return null;
  const full = path.join(PHOTO_DIR, file);
  if (!fs.existsSync(full)) return null;
  const mtime = fs.statSync(full).mtimeMs;
  return `/product-photos/${encodeURIComponent(file)}?v=${mtime}`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));
  ensurePhotoDir();
  app.use("/product-photos", express.static(PHOTO_DIR));

  // Store connection config in memory for the session
  // IMPORTANT: IdealPOS is read-only. All SELECTs only — never INSERT/UPDATE/DELETE IdealPOS data.
  // KwikOrder metadata (supplier configs, starred products, photos) is stored in local files only.
  let dbConfig: sql.config | null = null;
  let pool: sql.ConnectionPool | null = null;

  // API Routes
  app.post("/api/settings", async (req, res) => {
    try {
      const { server, database, user, password, domain } = req.body;

      // Support named instances: "localhost\IDEALSQL" or "host,port"
      const rawServer = (server || "localhost\\IDEALSQL").trim();
      let host = rawServer;
      let instanceName: string | undefined;
      let port: number | undefined;

      if (rawServer.includes(",")) {
        const [h, p] = rawServer.split(",");
        host = h.trim();
        port = Number(p.trim()) || undefined;
      } else if (rawServer.includes("\\")) {
        const [h, inst] = rawServer.split("\\");
        host = h.trim();
        instanceName = inst.trim() || undefined;
      }

      const config: sql.config = {
        server: host,
        database: database || "IPSTransaction",
        port,
        options: {
          encrypt: false,
          trustServerCertificate: true,
          enableArithAbort: true,
          ...(instanceName ? { instanceName } : {}),
        },
      };

      if (user && password) {
        config.user = user;
        config.password = password;
        if (domain) {
          config.domain = domain;
        }
      } else {
        // Windows Auth needs msnodesqlv8; tedious requires a SQL login.
        // Keep empty credentials so the connection attempt returns a clear error.
        config.user = "";
        config.password = "";
      }

      dbConfig = {
        ...config,
        // Keep original label for UI status (includes instance / port)
        server: rawServer,
      } as sql.config;

      // Test connection
      if (pool) {
        await pool.close();
      }
      
      try {
        // Connect with parsed host/instance/port config (not the display label)
        pool = await new sql.ConnectionPool(config).connect();
        res.json({ success: true, message: "Connected successfully to " + rawServer });
      } catch (err: any) {
        console.error("Connection failed:", err);
        res.status(500).json({ success: false, message: "Connection failed: " + err.message });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/status", async (req, res) => {
    if (!pool || !dbConfig) {
      return res.json({ connected: false, server: null, database: null });
    }
    
    try {
      // Test if still connected
      await pool.request().query("SELECT 1");
      res.json({ 
        connected: true, 
        server: dbConfig.server, 
        database: dbConfig.database 
      });
    } catch (err) {
      res.json({ connected: false, server: dbConfig.server, database: dbConfig.database, error: String(err) });
    }
  });

  app.get("/api/databases", async (req, res) => {
    if (!pool) return res.status(400).json({ error: "Not connected to a server" });
    try {
      const result = await pool.request().query("SELECT name FROM sys.databases WHERE state_desc = 'ONLINE'");
      res.json({ databases: result.recordset.map(r => r.name) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/tables", async (req, res) => {
    if (!pool) return res.status(400).json({ error: "Not connected to a server" });
    const db = req.query.database as string;
    
    try {
      if (db && db !== dbConfig?.database) {
        // Switch database context if possible, or just list tables using DB.. prefix
        const result = await pool.request().query(`SELECT TABLE_NAME FROM [${db}].INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`);
        res.json({ tables: result.recordset.map(r => r.TABLE_NAME) });
      } else {
        const result = await pool.request().query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`);
        res.json({ tables: result.recordset.map(r => r.TABLE_NAME) });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/table/:tableName", async (req, res) => {
    if (!pool) return res.status(400).json({ error: "Not connected to a server" });
    
    const tableName = req.params.tableName;
    const dbName = req.query.database as string || dbConfig?.database;
    
    try {
      // Get column info
      const colResult = await pool.request()
        .input('tableName', sql.NVarChar, tableName)
        .query(`
          SELECT COLUMN_NAME, DATA_TYPE 
          FROM [${dbName}].INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = @tableName
        `);
      
      const columns = colResult.recordset.map(r => r.COLUMN_NAME);
      
      // Get count
      const countResult = await pool.request().query(`SELECT COUNT(*) as count FROM [${dbName}].[dbo].[${tableName}]`);
      const count = countResult.recordset[0].count;
      
      // Get top 100 rows
      const rowsResult = await pool.request().query(`SELECT TOP 100 * FROM [${dbName}].[dbo].[${tableName}]`);
      
      res.json({
        tableName,
        database: dbName,
        columns,
        count,
        rows: rowsResult.recordset
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Dashboard Stats
  app.get("/api/dashboard", async (req, res) => {
    if (!pool) return res.status(400).json({ error: "Not connected to a server" });
    
    const dbName = req.query.database as string || dbConfig?.database || 'IPSTransaction';
    
    try {
      // Safe queries that check if tables exist before counting
      let tableCount = 0;
      let productsCount = 0;
      let salesCount = 0;
      let suppliersCount = 0;
      
      try {
        const tablesResult = await pool.request().query(`SELECT COUNT(*) as count FROM [${dbName}].INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'`);
        tableCount = tablesResult.recordset[0].count;
      } catch (e) {}

      try {
        const pResult = await pool.request().query(`SELECT COUNT(*) as count FROM [${dbName}].[dbo].[StockItems]`);
        productsCount = pResult.recordset[0].count;
      } catch (e) {}

      try {
        const sResult = await pool.request().query(`SELECT COUNT(*) as count FROM [${dbName}].[dbo].[Transactions]`);
        salesCount = sResult.recordset[0].count;
      } catch (e) {}

      try {
        const supResult = await pool.request().query(`SELECT COUNT(*) as count FROM [${dbName}].[dbo].[Creditor]`);
        suppliersCount = supResult.recordset[0].count;
      } catch (e) {}

      res.json({
        tables: tableCount,
        products: productsCount,
        sales: salesCount,
        suppliers: suppliersCount
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // IdealPOS schema map (Creditor / StockItems / StockTransaction)
  app.get("/api/schema-map", (_req, res) => {
    res.json({
      database: "IPSTransaction",
      suppliers: { table: "Creditor", id: "ID", name: "Name", code: "Code" },
      products: {
        table: "StockItems",
        id: "ID",
        barcode: "Code",
        description: "Description3 (long) / Description2 / Description",
        supplierId: "CreditorID",
        currentStock: "StkLevel",
        minimumStock: "ReordLevel",
        cost: "LstCst/StdCst",
      },
      sales: {
        table: "StockTransaction",
        stockItemId: "StockItemID",
        quantity: "Quantity",
        date: "Date",
        saleTypeId: 1,
        saleTypeCode: "SAL",
        note: "Sale quantities are stored as negatives; ABS() used for totals",
      },
    });
  });

  // List IdealPOS suppliers (Creditor)
  app.get("/api/suppliers", async (_req, res) => {
    if (!pool) return res.status(400).json({ error: "Not connected to a server" });

    try {
      const result = await pool.request().query(`
        SELECT
          c.ID AS id,
          c.Code AS code,
          c.Name AS name,
          COUNT(si.ID) AS productCount
        FROM Creditor c WITH (NOLOCK)
        LEFT JOIN StockItems si WITH (NOLOCK) ON si.CreditorID = c.ID
        WHERE (c.Deleted IS NULL OR c.Deleted = 0)
        GROUP BY c.ID, c.Code, c.Name
        ORDER BY c.Name
      `);
      res.json({ suppliers: result.recordset });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Only suppliers configured in Settings
  app.get("/api/suppliers/configured", async (_req, res) => {
    if (!pool) return res.status(400).json({ error: "Not connected to a server" });

    try {
      const configs = getSupplierConfigs();
      const ids = Object.keys(configs)
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id));

      if (ids.length === 0) {
        return res.json({ suppliers: [] });
      }

      const starred = getStarredMap();
      const request = pool.request();
      const placeholders = ids.map((id, i) => {
        request.input(`id${i}`, sql.Int, id);
        return `@id${i}`;
      });

      const result = await request.query(`
        SELECT
          c.ID AS id,
          c.Code AS code,
          c.Name AS name,
          COUNT(si.ID) AS productCount
        FROM Creditor c WITH (NOLOCK)
        LEFT JOIN StockItems si WITH (NOLOCK) ON si.CreditorID = c.ID
        WHERE c.ID IN (${placeholders.join(",")})
        GROUP BY c.ID, c.Code, c.Name
        ORDER BY c.Name
      `);

      const suppliers = result.recordset.map((row: any) => ({
        ...row,
        starredCount: (starred[String(row.id)] || []).length,
        config: configs[String(row.id)],
      }));

      res.json({ suppliers });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Products for a supplier (with starred flag)
  app.get("/api/suppliers/:supplierId/products", async (req, res) => {
    if (!pool) return res.status(400).json({ error: "Not connected to a server" });

    const supplierId = String(req.params.supplierId || "");
    if (!supplierId) return res.status(400).json({ error: "Supplier ID is required" });

    try {
      const starredSet = new Set(getStarredForSupplier(supplierId));
      const result = await pool.request()
        .input("supplierId", sql.Int, Number(supplierId))
        .query(`
          SELECT
            si.ID AS productId,
            si.Code AS barcode,
            ${PRODUCT_DISPLAY_NAME_SQL} AS description,
            CAST(COALESCE(si.StkLevel, 0) AS float) AS currentStock,
            CAST(COALESCE(si.ReordLevel, 0) AS float) AS minimumStock,
            CAST(COALESCE(NULLIF(si.LstCst, 0), si.StdCst, 0) AS float) AS cost,
            si.DepartmentCode AS departmentCode,
            COALESCE(d.Description, CAST(si.DepartmentCode AS varchar(20)), 'Unassigned') AS departmentName
          FROM StockItems si WITH (NOLOCK)
          LEFT JOIN Departments d WITH (NOLOCK) ON d.Code = si.DepartmentCode
          WHERE si.CreditorID = @supplierId
          ORDER BY COALESCE(d.Description, 'Unassigned'), ${PRODUCT_DISPLAY_NAME_SQL}
        `);

      const products = result.recordset.map((p: any) => ({
        ...p,
        photoUrl: getPhotoUrl(p.productId),
        starred: starredSet.has(Number(p.productId)),
      }));
      products.sort((a: any, b: any) => {
        const dept = String(a.departmentName || "").localeCompare(String(b.departmentName || ""));
        if (dept !== 0) return dept;
        return compareByPackSize(String(a.description || ""), String(b.description || ""));
      });

      res.json({
        supplierId: Number(supplierId),
        products,
        starredCount: products.filter((p: any) => p.starred).length,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/starred-products", (req, res) => {
    const supplierId = req.query.supplierId as string | undefined;
    const map = getStarredMap();
    if (supplierId) {
      return res.json({ supplierId, productIds: map[String(supplierId)] || [] });
    }
    res.json({ starred: map });
  });

  app.post("/api/starred-products", (req, res) => {
    try {
      const { supplierId, productId, starred, productIds } = req.body;
      if (supplierId === undefined || supplierId === null || supplierId === "") {
        return res.status(400).json({ success: false, message: "supplierId is required" });
      }

      const map = getStarredMap();
      const key = String(supplierId);

      if (Array.isArray(productIds)) {
        map[key] = [...new Set(productIds.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n)))];
      } else if (productId !== undefined && productId !== null) {
        const id = Number(productId);
        if (!Number.isFinite(id)) {
          return res.status(400).json({ success: false, message: "Invalid productId" });
        }
        const current = new Set(map[key] || []);
        if (starred) current.add(id);
        else current.delete(id);
        map[key] = [...current];
      } else {
        return res.status(400).json({ success: false, message: "productId or productIds required" });
      }

      if (map[key].length === 0) delete map[key];
      saveStarredMap(map);
      res.json({ success: true, productIds: map[key] || [] });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Local product photos only (never written to IdealPOS)
  app.post("/api/product-photos", (req, res) => {
    try {
      const { productId, mimeType, data } = req.body;
      const id = Number(productId);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ success: false, message: "productId is required" });
      }
      if (!data || typeof data !== "string") {
        return res.status(400).json({ success: false, message: "Image data is required" });
      }

      const mime = String(mimeType || "image/jpeg").toLowerCase();
      const ext =
        mime.includes("png") ? "png" :
        mime.includes("webp") ? "webp" :
        mime.includes("gif") ? "gif" :
        "jpg";

      const base64 = data.includes(",") ? data.split(",")[1] : data;
      const buffer = Buffer.from(base64, "base64");
      if (!buffer.length || buffer.length > 8 * 1024 * 1024) {
        return res.status(400).json({ success: false, message: "Image must be under 8MB" });
      }

      ensurePhotoDir();
      const map = getPhotoMap();
      const old = map[String(id)];
      if (old) {
        const oldPath = path.join(PHOTO_DIR, old);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      const fileName = `${id}.${ext}`;
      fs.writeFileSync(path.join(PHOTO_DIR, fileName), buffer);
      map[String(id)] = fileName;
      savePhotoMap(map);

      res.json({ success: true, photoUrl: getPhotoUrl(id) });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/product-photos/:productId", (req, res) => {
    try {
      const id = String(req.params.productId || "");
      if (!id) return res.status(400).json({ success: false, message: "productId required" });
      const map = getPhotoMap();
      const file = map[id];
      if (file) {
        const full = path.join(PHOTO_DIR, file);
        if (fs.existsSync(full)) fs.unlinkSync(full);
        delete map[id];
        savePhotoMap(map);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Supplier ordering configurations (local JSON)
  app.get("/api/supplier-configs", (_req, res) => {
    res.json(getSupplierConfigs());
  });

  app.post("/api/supplier-configs", (req, res) => {
    try {
      const { supplierId, schedules, cutOffDay, cutOffTime, deliveryDay, safetyMultiplier } = req.body;
      if (supplierId === undefined || supplierId === null || supplierId === "") {
        return res.status(400).json({ success: false, message: "supplierId is required" });
      }

      const configs = getSupplierConfigs();
      const normalized = normalizeSupplierConfig({
        schedules,
        cutOffDay,
        cutOffTime,
        deliveryDay,
        safetyMultiplier,
      });
      configs[String(supplierId)] = normalized;
      saveSupplierConfigs(configs);
      res.json({ success: true, message: "Configuration saved successfully", config: normalized });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/supplier-configs/:supplierId", (req, res) => {
    try {
      const supplierId = String(req.params.supplierId || "");
      if (!supplierId) {
        return res.status(400).json({ success: false, message: "supplierId is required" });
      }
      const configs = getSupplierConfigs();
      if (!configs[supplierId]) {
        return res.status(404).json({ success: false, message: "Supplier config not found" });
      }
      delete configs[supplierId];
      saveSupplierConfigs(configs);
      res.json({ success: true, message: "Configuration removed" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Automated order recommendations for starred products only
  app.get("/api/orders/recommend", async (req, res) => {
    if (!pool) return res.status(400).json({ error: "Not connected to database" });

    const supplierId = req.query.supplierId as string;
    if (!supplierId) return res.status(400).json({ error: "Supplier ID is required" });

    try {
      const configs = getSupplierConfigs();
      if (!configs[supplierId]) {
        return res.status(400).json({
          error: "Supplier is not configured. Add them in Server Settings → Supplier Config.",
        });
      }

      const config = configs[supplierId];
      const scheduleIndex = Math.min(
        Math.max(0, Number(req.query.scheduleIndex) || 0),
        Math.max(0, config.schedules.length - 1)
      );
      const schedule = config.schedules[scheduleIndex] || config.schedules[0];
      const coverageDays = getCoverageDays(schedule.cutOffDay, schedule.deliveryDay).filter((d) =>
        VALID_WEEKDAYS.has(d)
      );

      if (coverageDays.length === 0) {
        return res.status(400).json({ error: "Invalid cut-off / delivery schedule" });
      }

      const starredIds = getStarredForSupplier(supplierId);
      if (starredIds.length === 0) {
        return res.json({
          success: true,
          supplier: null,
          config,
          schedule,
          scheduleIndex,
          coverageDays,
          weeksAnalyzed: 4,
          starredCount: 0,
          recommendations: [],
          message:
            "No starred products. Open the product list and star the items you order regularly.",
        });
      }

      const supplierResult = await pool.request()
        .input("supplierId", sql.Int, Number(supplierId))
        .query(`
          SELECT TOP 1
            c.ID AS id,
            c.Code AS code,
            c.Name AS name,
            (SELECT COUNT(*) FROM StockItems si WITH (NOLOCK) WHERE si.CreditorID = c.ID) AS productCount
          FROM Creditor c WITH (NOLOCK)
          WHERE c.ID = @supplierId
        `);

      const supplier = supplierResult.recordset[0] || null;

      // Build safe IN lists for weekdays and starred product IDs
      const request = pool.request().input("supplierId", sql.Int, Number(supplierId));
      const dayPlaceholders = coverageDays.map((day, i) => {
        request.input(`day${i}`, sql.NVarChar, day);
        return `@day${i}`;
      });
      const productPlaceholders = starredIds.map((id, i) => {
        request.input(`pid${i}`, sql.Int, id);
        return `@pid${i}`;
      });

      // Coverage sales: only Fri/Sat/Sun (etc.) over last 4 and 12 weeks
      const productsResult = await request.query(`
        WITH coverage AS (
          SELECT
            st.StockItemID,
            SUM(CASE WHEN st.Date >= DATEADD(week, -4, GETDATE()) THEN ABS(st.Quantity) ELSE 0 END) AS coverageTotal4,
            SUM(CASE WHEN st.Date >= DATEADD(week, -12, GETDATE()) THEN ABS(st.Quantity) ELSE 0 END) AS coverageTotal12
          FROM StockTransaction st WITH (NOLOCK)
          INNER JOIN StockItems si2 WITH (NOLOCK) ON si2.ID = st.StockItemID
          WHERE si2.CreditorID = @supplierId
            AND st.StockItemID IN (${productPlaceholders.join(",")})
            AND st.StockTransactionTypeID = 1
            AND st.Date >= DATEADD(week, -12, GETDATE())
            AND DATENAME(weekday, st.Date) IN (${dayPlaceholders.join(",")})
          GROUP BY st.StockItemID
        )
        SELECT
          si.ID AS productId,
          si.Code AS barcode,
          ${PRODUCT_DISPLAY_NAME_SQL} AS description,
          CAST(COALESCE(NULLIF(si.LstCst, 0), si.StdCst, 0) AS float) AS cost,
          CAST(COALESCE(si.StkLevel, 0) AS float) AS currentStock,
          CAST(COALESCE(si.ReordLevel, 0) AS float) AS minimumStock,
          si.DepartmentCode AS departmentCode,
          COALESCE(d.Description, CAST(si.DepartmentCode AS varchar(20)), 'Unassigned') AS departmentName,
          CAST(COALESCE(c.coverageTotal4, 0) AS float) AS coverageTotal4,
          CAST(COALESCE(c.coverageTotal12, 0) AS float) AS coverageTotal12
        FROM StockItems si WITH (NOLOCK)
        LEFT JOIN Departments d WITH (NOLOCK) ON d.Code = si.DepartmentCode
        LEFT JOIN coverage c ON c.StockItemID = si.ID
        WHERE si.CreditorID = @supplierId
          AND si.ID IN (${productPlaceholders.join(",")})
        ORDER BY COALESCE(d.Description, 'Unassigned'), ${PRODUCT_DISPLAY_NAME_SQL}
      `);

      const recommendations = productsResult.recordset.map((prod: any) => {
        const coverageTotal4 = Number(prod.coverageTotal4) || 0;
        const coverageTotal12 = Number(prod.coverageTotal12) || 0;
        const currentStock = Number(prod.currentStock) || 0;
        const minimumStock = Number(prod.minimumStock) || 0;

        const coverageAvg4 = coverageTotal4 / 4;
        const coverageAvg12 = coverageTotal12 / 12;
        const coverageAvg = coverageAvg4 > 0 ? coverageAvg4 : coverageAvg12;

        // Target = expected usage until delivery (coverage period avg) + safety + min stock
        const targetStock = Math.ceil(coverageAvg * config.safetyMultiplier + minimumStock);
        const effectiveStock = Math.max(0, currentStock);
        const recommendedQty = Math.max(0, Math.ceil(targetStock - effectiveStock));

        const dayLabel = coverageDays.map((d) => d.slice(0, 3)).join("/");
        let reason = "Stock Levels Sufficient";
        if (recommendedQty > 0) {
          if (currentStock < 0) {
            reason = `Negative stock + ${dayLabel} avg + Safety`;
          } else if (coverageAvg4 > 0) {
            reason = `4-wk ${dayLabel} avg + Safety Buffer`;
          } else if (coverageAvg12 > 0) {
            reason = `12-wk ${dayLabel} avg + Safety Buffer`;
          } else if (minimumStock > effectiveStock) {
            reason = "Below minimum stock";
          } else {
            reason = `${dayLabel} coverage + Safety Buffer`;
          }
        }

        return {
          productId: prod.productId,
          description: prod.description,
          barcode: prod.barcode,
          cost: Number(prod.cost) || 0,
          currentStock,
          minimumStock,
          departmentCode: prod.departmentCode ?? null,
          departmentName: prod.departmentName || "Unassigned",
          photoUrl: getPhotoUrl(prod.productId),
          coverageAvg: Math.round(coverageAvg * 100) / 100,
          coverageAvg4: Math.round(coverageAvg4 * 100) / 100,
          coverageAvg12: Math.round(coverageAvg12 * 100) / 100,
          coverageTotal4,
          coverageTotal12,
          targetStock,
          recommendedQty,
          reason,
        };
      });

      recommendations.sort((a: any, b: any) => {
        const dept = String(a.departmentName || "").localeCompare(String(b.departmentName || ""));
        if (dept !== 0) return dept;
        return compareByPackSize(String(a.description || ""), String(b.description || ""));
      });

      res.json({
        success: true,
        supplier,
        config,
        schedule,
        scheduleIndex,
        coverageDays,
        weeksAnalyzed: 4,
        starredCount: starredIds.length,
        recommendations,
      });
    } catch (err: any) {
      console.error("Order recommend failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
