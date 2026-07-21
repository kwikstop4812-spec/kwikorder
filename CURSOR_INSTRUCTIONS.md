# Cursor AI Instructions for KwikOrder Analytics

This document is designed to be read by **Cursor AI** (or any AI coding assistant) to help you understand the project structure, the local SQL Server database environment, and how to proceed with the next stages of development on the Shop PC.

---

## 🛠️ Project Overview & Architecture
**KwikOrder Analytics** is a full-stack web application designed to run locally on a Shop PC to connect directly to an **IdealPOS SQL Server 2019 (Express Edition)** database, analyze sales/inventory, and generate milk and supplier orders.

- **Frontend:** React 19, Tailwind CSS v4, Lucide Icons, and Motion.
- **Backend:** Node.js, Express, and the `mssql` (tedious) driver.
- **Development setup:**
  - `server.ts` is the Express backend entry point. It hosts API endpoints under `/api/*` and acts as a Vite middleware proxy in development mode.
  - Compiles to `dist/server.cjs` via `esbuild` for production.
  - Configured with package scripts: `npm run dev` to run the development server (runs both backend and frontend on port `3000`), and `npm run build` to build.

---

## 🖥️ Local SQL Server Environment Details
Based on the system properties screenshots from the Shop PC:
1. **Host/Server Computer Name:** `DESKTOP-ABEN9NK`
2. **SQL Server Instance Name:** `IDEALSQL` (Express Edition)
   - *Full Server Name for connections:* `DESKTOP-ABEN9NK\IDEALSQL` (or `localhost\IDEALSQL` when running on the same PC).
3. **Install Directory:** `C:\Program Files\Microsoft SQL Server\MSSQL15.IDEALSQL\MSSQL`
4. **Database Name:** `IdealPOS`

### ⚠️ Crucial Local Connection Checklist (For Cursor to guide user):
- **Enable TCP/IP:** SQL Server Express does *not* enable TCP/IP by default. You must open **SQL Server Configuration Manager**, go to **SQL Server Network Configuration** &rarr; **Protocols for IDEALSQL**, and enable **TCP/IP**. Double-click TCP/IP, go to the **IP Addresses** tab, scroll to **IPAll**, and ensure the port is set to `1433` (or check for dynamic ports). Restart the `SQL Server (IDEALSQL)` service.
- **Mixed Mode Authentication:** To connect simply using a username and password (which is highly recommended for Node.js `mssql` stability), SQL Server must be in **Mixed Mode (SQL Server and Windows Authentication)**.
- **Create a Dedicated SQL Login:** Create a login (e.g., username: `kwikorder`, password: `your_secure_password`), map it to the `IdealPOS` database, and assign the `db_datareader` role.

---

## 🎯 What to Do Next (Cursor Tasks)

### 1. Help the User Run the App Locally
When the user opens this folder in Cursor, help them:
1. Run `npm install` in the Cursor terminal.
2. Verify that they have completed the SQL Server TCP/IP and Authentication configuration.
3. Run `npm run dev` to start the app locally on `http://localhost:3000`.
4. Enter the local credentials in the **Server Settings** tab:
   - **Server:** `localhost\IDEALSQL` or `127.0.0.1\IDEALSQL`
   - **Database:** `IdealPOS`
   - **Username:** `kwikorder` (or your Windows credentials if attempting Windows Auth)
   - **Password:** `[password]`

### 2. Implement Stage 2: Complete the Database Explorer
We have already created the scaffolding:
- `/src/components/DatabaseExplorer.tsx` lists tables, counts records, and shows the first 100 rows.
- `/server.ts` provides `/api/tables` and `/api/table/:tableName` APIs.
- Your job is to refine this and ensure columns are beautifully presented and paginated if the user requests it.

### 3. Implement Stage 3: Schema Discovery & Mapping
Map the relations in the `IdealPOS` database automatically by writing backend queries to discover fields:
- **Products table:** Locate `ProductID`, `Barcode`, `Description`, `Supplier`, `Cost`, `Retail`, `CurrentStock`, `MinimumStock`, etc.
- **Sales table:** Locate `SaleDate`, `ProductID`, `Qty`, `Price`, `Invoice`.
- **Suppliers table:** Locate `SupplierID`, `Supplier Name`, `Supplier Code`.
Create a database mapping utility or admin page showing how these tables relate to each other.

### 4. Implement Stage 4 & 5: Milk & Supplier Ordering Engines
- Build the milk ordering logic based on the delivery calendar (e.g., Monday delivery requires ordering before Friday 10 AM, analyzing sales history over 1-week, 4-week, and 12-week periods).
- Generate draft purchase orders with export options (PDF, Excel, CSV, Print).

---

## ⚙️ Configuration Files Reference
- **Frontend Entry:** `/src/main.tsx` and `/src/App.tsx`
- **Backend Code:** `/server.ts`
- **Database Components:** `/src/components/Dashboard.tsx`, `/src/components/DatabaseExplorer.tsx`, `/src/components/Settings.tsx`
- **Dependencies Configuration:** `/package.json` and `/vite.config.ts`
