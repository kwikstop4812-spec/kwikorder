# IdealPOS Integration & Cloudflare Tunnel Architectural Changes

## Overview
This document summarizes all backend architectural enhancements, SQL schema auto-adaptation mechanisms, Cloudflare Tunnel integration details, and demo database removal updates made to the application.

---

## 1. Demo Database Removal
- **Complete Removal of Mock Fallbacks**: All hardcoded demo suppliers, demo products, and mock fallback stock items have been removed from `server.ts`.
- **Live Database Enforcement**: When the SQL database pool is not connected or returns 0 records, the application strictly returns empty arrays (`[]`) rather than injecting simulated data.
- **Seeding Disabled**: Demo configuration and starred item seeding routines (`seedDemoFilesIfEmpty`) have been completely cleared to guarantee data purity from IdealPOS.

---

## 2. Dynamic Schema Auto-Detection (`getIdealPosSchema`)
IdealPOS database schemas can vary depending on the IdealPOS version, custom table prefixes, or store configuration. To prevent query failures, `server.ts` now features an automated schema inspector (`getIdealPosSchema`) that queries `INFORMATION_SCHEMA`:

### Table & Column Mapping:
- **Department Table**: Dynamically checks for `Departments`, `Department`, or `StockDepartment`.
- **Department Name Column**: Detects `Description`, `Name`, or `DeptName`.
- **Department Code Column**: Detects `Code`, `ID`, or `DeptNo`.
- **Stock Item Department Link**: Detects `DepartmentCode`, `Department`, `DeptCode`, or `DeptID`.
- **Stock Quantity Level**: Detects `StkLevel`, `StockLevel`, `QtyOnHand`, or `Stock`.
- **Reorder / Minimum Level**: Detects `ReordLevel`, `ReorderLevel`, `MinStock`, or `MinLevel`.
- **Last Cost Price**: Detects `LstCst`, `StdCst`, or `CostPrice`.
- **Selling Price**: Detects `Price1`, `SellPrice1`, or `Price`.
- **Supplier Link**: Detects `CreditorID` or `SupplierID`.

---

## 3. Cloudflare Tunnel (`cloudflared`) Integration
To securely bridge Cloud Run / hosted web instances with local Windows SQL Servers running on store PCs, the app utilizes Cloudflare Tunnel TCP hostname routing:

- **Public Hostname**: `mssql.kwikstop.com.au` mapped to `tcp://localhost:1433` on the local store PC (`DESKTOP-ABEN9NK`).
- **Default Database Endpoint**: Updated default server hostname in Settings and `server.ts` from `localhost\IDEALSQL` to `mssql.kwikstop.com.au`.
- **Direct TCP Connection**: The cloud backend connects directly to `mssql.kwikstop.com.au:1433` to query `IPSTransaction` without requiring local-only network access.
- **Status Endpoint (`/api/status`)**: Reports whether the server is successfully connected to `mssql.kwikstop.com.au`.
- **Tunnel Logs Endpoint (`/api/cloudflared/logs`)**: Provides real-time connection telemetry for monitoring tunnel health.

---

## 4. API Endpoint Modifications

| Endpoint | Changes |
| :--- | :--- |
| `GET /api/pos/departments` | Queries the dynamic department table using `INFORMATION_SCHEMA` mappings. Excludes blank/null department names. |
| `GET /api/inventory` | Fetches live stock items with dynamic column resolution for cost, price, department, and stock level. Supports filtering by department code and search term. |
| `GET /api/suppliers` | Queries `Creditor` table linked via the detected supplier column on `StockItems`. |
| `GET /api/suppliers/:id/products` | Retrieves live products for a specific supplier with auto-resolved schema columns. |
| `GET /api/suppliers/:id/order-recommendations` | Calculates 4-week and 12-week sales coverage from `StockTransaction` table for active purchase ordering. |

---

## 5. Troubleshooting: Why Inventory Might Show Empty
If inventory or departments show empty:
1. **Database Connection State**: Ensure a live MS SQL Server instance is connected under **Settings -> Database Connection** or that the `cloudflared` tunnel agent is running on the host machine.
2. **Empty Table in IdealPOS**: If connected to a fresh IdealPOS database, verify that the `StockItems` and `Creditor` tables contain active records.
3. **Permissions**: Ensure the SQL user configured in `Settings` has `SELECT` permissions on `StockItems`, `Creditor`, `StockTransaction`, and `INFORMATION_SCHEMA`.
