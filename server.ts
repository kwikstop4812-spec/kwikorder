import express from "express";
import path from "path";
import sql from "mssql";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Store connection config in memory for the session
  let dbConfig: sql.config | null = null;
  let pool: sql.ConnectionPool | null = null;

  // API Routes
  app.post("/api/settings", async (req, res) => {
    try {
      const { server, database, user, password, domain } = req.body;
      
      const config: sql.config = {
        server: server || "localhost",
        database: database || "IdealPOS",
        options: {
          encrypt: false,
          trustServerCertificate: true,
        },
      };

      if (user && password) {
        config.user = user;
        config.password = password;
        if (domain) {
          config.domain = domain;
        }
      } else {
        // Note: For Windows Auth locally, we would typically use msnodesqlv8 
        // driver, but we'll try to establish a connection without credentials 
        // if none provided, which might work if SQL Server is configured loosely 
        // or we just want to save the settings for now.
        config.user = "";
        config.password = "";
      }

      dbConfig = config;
      
      // Test connection
      if (pool) {
        await pool.close();
      }
      
      try {
        pool = await sql.connect(dbConfig);
        res.json({ success: true, message: "Connected successfully to " + server });
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
    
    const dbName = req.query.database as string || dbConfig?.database || 'IdealPOS';
    
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
        const pResult = await pool.request().query(`SELECT COUNT(*) as count FROM [${dbName}].[dbo].[Products]`);
        productsCount = pResult.recordset[0].count;
      } catch (e) {}

      try {
        const sResult = await pool.request().query(`SELECT COUNT(*) as count FROM [${dbName}].[dbo].[Sales]`);
        salesCount = sResult.recordset[0].count;
      } catch (e) {}

      try {
        const supResult = await pool.request().query(`SELECT COUNT(*) as count FROM [${dbName}].[dbo].[Suppliers]`);
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
