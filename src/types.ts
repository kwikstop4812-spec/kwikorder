export interface ConnectionStatus {
  connected: boolean;
  isDemoMode?: boolean;
  server: string | null;
  database: string | null;
  error?: string;
}

export interface DashboardStats {
  tables: number;
  products: number;
  sales: number;
  suppliers: number;
}

export interface DeliverySchedule {
  cutOffDay: string;
  cutOffTime: string;
  deliveryDay: string;
}

export interface SupplierConfig {
  schedules: DeliverySchedule[];
  safetyMultiplier: number;
}

export interface SupplierConfigMap {
  [supplierId: string]: SupplierConfig;
}

export interface Supplier {
  SupplierID: string;
  SupplierName: string;
  SupplierCode?: string;
  Phone?: string;
  Email?: string;
}

export interface SupplierProduct {
  productId: number | string;
  description: string;
  barcode?: string;
  department?: string;
  cost?: number;
  currentStock?: number;
  minimumStock?: number;
  starred?: boolean;
  photoUrl?: string;
}

export interface OrderRecommendation {
  productId: number | string;
  description: string;
  barcode?: string;
  department?: string;
  cost?: number;
  currentStock: number;
  minimumStock: number;
  salesLastWeek: number;
  avgSalesWeekly: number;
  avgSalesForCoverage: number;
  recommendedQty: number;
  reason: string;
  starred?: boolean;
  photoUrl?: string;
}

/* ==========================================================================
   POS SPECIFIC TYPES (Dashboard, Inventory, Reports, Theme)
   ========================================================================== */

export interface HourlySalesPoint {
  hour: string;
  todaySales: number;
  lastWeekSales: number;
  todayCustomers: number;
  lastWeekCustomers: number;
}

export interface SalesBreakdownItem {
  name: string;
  amount: number;
  percentage: number;
  quantityOrTxn: number;
}

export interface POSDashboardData {
  // Tile 1: Current Session
  sessionSales: number;
  sessionSalesLastWeekSameTime: number;
  sessionSalesLastWeekSameDayTotal: number;
  sessionCustomers: number;
  sessionCustomersLastWeekSameTime: number;
  sessionCustomersLastWeekSameDayTotal: number;

  // Tile 2: Week to Date (WTD)
  wtdSales: number;
  wtdSalesLastWeekSameTime: number;
  wtdSalesLastWeekTotal: number;
  wtdCustomers: number;
  wtdCustomersLastWeekSameTime: number;
  wtdCustomersLastWeekTotal: number;

  // Tile 3: Month to Date (MTD)
  mtdSales: number;
  mtdSalesLastMonthSameTime: number;
  mtdSalesLastMonthTotal: number;
  mtdCustomers: number;
  mtdCustomersLastMonthSameTime: number;
  mtdCustomersLastMonthTotal: number;

  // Additional Summary Metrics
  todaySales: number;
  currentSales: number;
  lastWeekSameTimeSales: number;
  totalSales: number;
  lastMonthSameTimeSales: number;
  totalMonthSales: number;
  customerCount: number;
  lastWeekCustomerCount: number;
  avgBasketValue: number;

  hourlyTrend: HourlySalesPoint[];
  departmentSales: SalesBreakdownItem[];
  categorySales: SalesBreakdownItem[];
  tenderSales: SalesBreakdownItem[];
}

export interface InventoryItem {
  productId: number;
  itemCode: string;
  scanCode: string;
  longDescription: string;
  departmentName: string;
  departmentCode: number;
  sellingPrice: number;
  costPrice: number;
  currentStock: number;
  minimumStock: number;
  photoUrl?: string;
}

export interface StockMovement {
  id: string;
  dateTime: string;
  type: 'Sale' | 'Goods Received' | 'Adjustment' | 'Stock Return' | 'Transfer';
  changeQty: number;
  balanceAfter: number;
  reference: string;
  user: string;
}

export interface SalesHistoryPoint {
  period: string;
  qtySold: number;
  revenue: number;
}

export interface ProductSalesHistory {
  weekly: SalesHistoryPoint[];
  monthly: SalesHistoryPoint[];
  yearly: SalesHistoryPoint[];
}

export interface ReportSummaryKpi {
  label: string;
  value: string | number;
  subtext?: string;
}

export interface POSReport {
  id: string;
  title: string;
  category: 'Sales' | 'Department' | 'Finance' | 'Product' | 'Hourly';
  periodText: string;
  generatedAt: string;
  kpis: ReportSummaryKpi[];
  chartData: Array<{ label: string; value: number; secondary?: number }>;
  chartType: 'bar' | 'line' | 'pie';
  tableHeaders: string[];
  tableRows: Array<Record<string, string | number>>;
}

export type AppTheme = 'blue' | 'emerald' | 'midnight' | 'amber' | 'slate';
