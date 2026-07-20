export interface ConnectionStatus {
  connected: boolean;
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
