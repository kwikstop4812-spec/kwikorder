# Cursor AI Implementation Guide: Stages 3 & 4 (Supplier Config & Automated Ordering)

This document is designed to guide **Cursor AI** in implementing **Stage 3 (Schema Discovery & Supplier Settings)** and **Stage 4 (Automated Ordering Engine)** directly on your Shop PC with your IdealPOS database.

---

## 📅 Roadmap Overview
1. **Supplier Configurations Panel (Settings Tab):** Create a section in the UI to manage delivery settings (Order Cut-off day/time, Delivery day) for each supplier.
2. **Dynamic Supplier Dropdown (Main Dashboard):** Add a dropdown on the main screen to select a supplier for ordering.
3. **Automated Ordering Engine (Backend & Frontend):** 
   - Analyze IdealPOS historical sales (last week, last 4 weeks, last 12 weeks).
   - Compare historical sales against current stock and minimum stock levels.
   - Suggest order quantities with clear reasons (e.g., "Average + Safety Stock").
   - Allow inline edits to recommended quantities.
   - Export to CSV / Excel / Printable layout.

---

## 💾 Step 1: SQL Schema Discovery (IdealPOS Table Mapping)
IdealPOS databases might use different column/table names depending on your specific version. Have Cursor run these schema discovery queries first to map your database:

### Query to find Supplier columns:
```sql
-- Find table names containing "Supplier"
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%Supplier%';

-- Inspect columns of the selected Supplier table (e.g., 'Suppliers')
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Suppliers';
```

### Query to find Product columns:
```sql
-- Find table names containing "Product" or "Stock"
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%Product%' OR TABLE_NAME LIKE '%Stock%';

-- Inspect columns of the Products table (usually 'StockItems' or 'Products')
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Products';
```

---

## 🛠️ Step 2: Backend API Additions (`server.ts`)
Add the following endpoint skeletons to your local `server.ts` to manage supplier configurations and generate orders.

### 1. Endpoint: Save/Get Supplier Configurations
We need to persist supplier ordering parameters (cutoff time, delivery day, etc.). Since this is metadata unique to KwikOrder, we can persist it to a local JSON file (`supplier_configs.json`) in the project root:

```typescript
import fs from 'fs';

const CONFIG_FILE = path.join(process.cwd(), 'supplier_configs.json');

// Helper to read configs
function getSupplierConfigs() {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

// Get all configurations
app.get("/api/supplier-configs", (req, res) => {
  res.json(getSupplierConfigs());
});

// Save configuration for a specific supplier
app.post("/api/supplier-configs", (req, res) => {
  const { supplierId, cutOffDay, cutOffTime, deliveryDay, safetyMultiplier } = req.body;
  const configs = getSupplierConfigs();
  
  configs[supplierId] = {
    cutOffDay,
    cutOffTime,
    deliveryDay,
    safetyMultiplier: safetyMultiplier || 1.2 // 20% safety buffer by default
  };
  
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2));
  res.json({ success: true, message: "Configuration saved successfully" });
});
```

### 2. Endpoint: Generate Automated Order Recommendation
Have the backend query the IdealPOS SQL database to compute daily/weekly sales averages for products of the selected supplier. Here's a sample SQL pattern:

```typescript
app.get("/api/orders/recommend", async (req, res) => {
  if (!pool) return res.status(400).json({ error: "Not connected to database" });
  
  const { supplierId } = req.query;
  if (!supplierId) return res.status(400).json({ error: "Supplier ID is required" });
  
  try {
    const configs = getSupplierConfigs();
    const config = configs[supplierId as string] || { safetyMultiplier: 1.2 };
    
    // Fetch products belonging to this supplier
    // (Ensure table/column names match your IdealPOS schema found in Step 1)
    const productsResult = await pool.request()
      .input('supplierId', sql.VarChar, supplierId)
      .query(`
        SELECT ProductID, Description, Barcode, Cost, CurrentStock, MinimumStock
        FROM Products 
        WHERE SupplierID = @supplierId
      `);
      
    const products = productsResult.recordset;
    const recommendations = [];

    for (const prod of products) {
      // Query sales for this specific product in the last 7 days, 28 days, and 84 days
      const salesResult = await pool.request()
        .input('productId', sql.VarChar, prod.ProductID)
        .query(`
          SELECT 
            COALESCE(SUM(CASE WHEN SaleDate >= DATEADD(day, -7, GETDATE()) THEN Qty ELSE 0 END), 0) as salesLastWeek,
            COALESCE(SUM(CASE WHEN SaleDate >= DATEADD(day, -28, GETDATE()) THEN Qty ELSE 0 END), 0) as salesLastMonth,
            COALESCE(SUM(CASE WHEN SaleDate >= DATEADD(day, -84, GETDATE()) THEN Qty ELSE 0 END), 0) as salesLastQuarter
          FROM Sales
          WHERE ProductID = @productId
        `);
        
      const sales = salesResult.recordset[0];
      const avgSalesWeekly = Math.round(sales.salesLastMonth / 4);
      
      // Recommended calculation:
      // Target stock = (Weekly sales average * Safety Multiplier) + Minimum Stock requirement
      const targetStock = Math.ceil((avgSalesWeekly * config.safetyMultiplier) + (prod.MinimumStock || 0));
      const recommendedQty = Math.max(0, targetStock - prod.CurrentStock);
      
      recommendations.push({
        productId: prod.ProductID,
        description: prod.Description,
        barcode: prod.Barcode,
        cost: prod.Cost,
        currentStock: prod.CurrentStock,
        minimumStock: prod.MinimumStock,
        salesLastWeek: sales.salesLastWeek,
        avgSalesWeekly: avgSalesWeekly,
        recommendedQty: recommendedQty,
        reason: recommendedQty > 0 ? "Sales Trend + Safety Buffer" : "Stock Levels Sufficient"
      });
    }

    res.json({ success: true, recommendations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
```

---

## 🎨 Step 3: Frontend Additions

### 1. Supplier Configuration in `src/components/Settings.tsx`
Create a clean form inside settings allowing the user to select any existing supplier retrieved from `/api/tables` and set:
- **Cut-off Day:** (Monday - Sunday)
- **Cut-off Time:** (e.g. `10:00 AM`)
- **Delivery Day:** (Monday - Sunday)
- **Safety Stock Buffer %:** (e.g. `20%`)

### 2. Main Order Generation Panel (`src/components/OrderEngine.tsx`)
Create a new tab on the dashboard navigation or a primary action on the Dashboard page:
- **Supplier Selector:** A dropdown populating list of suppliers from the database.
- **Delivery Timeline Indicator:** Dynamically displays the scheduled cut-off and delivery days based on the chosen supplier settings (e.g., *"Pauls milk order is due by Friday 10:00 AM for Monday Delivery"*).
- **Interactive Order Grid:**
  - Shows product details, current stock, average sales, recommended order quantity.
  - Interactive input field allowing user to adjust the order quantity before saving.
- **Export Actions:**
  - **Export PDF:** Clean layout for printing or emailing.
  - **Export CSV/Excel:** Fast spreadsheet upload format.
