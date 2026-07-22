import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Package,
  TrendingDown,
  TrendingUp,
  X,
  Clock,
  BarChart2,
  Calendar,
  AlertTriangle,
  ArrowUpDown,
  FileText,
  DollarSign,
  Tag,
  Layers,
  HelpCircle,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { InventoryItem, StockMovement, ProductSalesHistory } from '../types';
import { useAppTheme } from '../ThemeContext';

export const InventoryManager: React.FC = () => {
  const { getThemeClasses } = useAppTheme();
  const theme = getThemeClasses();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'negative' | 'lowstock'>('all');
  const [sortField, setSortField] = useState<keyof InventoryItem>('longDescription');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Selected Product Modal state
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [productDetails, setProductDetails] = useState<{
    movements: StockMovement[];
    salesHistory: ProductSalesHistory;
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('q', searchQuery);
      if (selectedDepartment !== 'all') params.append('department', selectedDepartment);
      if (stockFilter !== 'all') params.append('filter', stockFilter);

      const res = await fetch(`/api/pos/inventory?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load inventory');
      const json = await res.json();
      setItems(json.items || []);
    } catch (err) {
      console.error('Inventory fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [searchQuery, selectedDepartment, stockFilter]);

  // Load Product Modal details
  const openProductModal = async (item: InventoryItem) => {
    setSelectedProduct(item);
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/pos/inventory/${item.productId}/details`);
      if (!res.ok) throw new Error('Failed to load product movements & sales history');
      const json = await res.json();
      setProductDetails(json);
    } catch (err) {
      console.error('Failed to load details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Unique department list
  const departments = Array.from(new Set(items.map((i) => i.departmentName))).filter(Boolean);

  // Client-side sorting
  const sortedItems = [...items].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (typeof valA === 'string') {
      valA = (valA as string).toLowerCase();
      valB = (valB as string).toLowerCase();
    }

    if (valA! < valB!) return sortDirection === 'asc' ? -1 : 1;
    if (valA! > valB!) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSort = (field: keyof InventoryItem) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600" />
            POS Inventory & Stock Control
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            View stock levels, scan codes, stock movements, and wildcard description lookup
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold">
          <div className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg">
            Total Items: <span className="font-bold text-slate-900">{items.length}</span>
          </div>
          <div className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg">
            Negative Stock:{' '}
            <span className="font-bold">{items.filter((i) => i.currentStock < 0).length}</span>
          </div>
        </div>
      </div>

      {/* Search Bar, Wildcard Help & Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Wildcard Search Field */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search description (e.g. *milk, 2L*), scan code, or item code..."
              className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Department Filter */}
          <div className="w-full sm:w-56">
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Departments ({departments.length})</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Level Filter */}
          <div className="w-full sm:w-48">
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Stock Levels</option>
              <option value="negative">Negative Stock Only (&lt; 0)</option>
              <option value="lowstock">Low Stock (&le; Reorder)</option>
            </select>
          </div>
        </div>

        {/* Wildcard Hint Banner */}
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-blue-50/60 border border-blue-100 rounded-lg p-2.5">
          <HelpCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span>
            <strong className="text-blue-900">Wildcard Search tip:</strong> Use <code className="bg-white px-1 py-0.5 rounded border border-blue-200 font-mono text-blue-800">*milk</code> to match anything ending with milk, <code className="bg-white px-1 py-0.5 rounded border border-blue-200 font-mono text-blue-800">2L*</code> to match descriptions starting with 2L, or type any phrase to search anywhere.
          </span>
        </div>
      </div>

      {/* POS Inventory Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            <span>Loading inventory database...</span>
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Package className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-base font-semibold text-slate-700">No products matched your search</p>
            <p className="text-xs text-slate-400 mt-1">Try clearing wildcard filters or choosing All Departments</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th
                    onClick={() => toggleSort('itemCode')}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      Code / ID
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('scanCode')}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      Scan Code (Barcode)
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('longDescription')}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      Long Description (Description3)
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('departmentName')}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      Department
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('sellingPrice')}
                    className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Selling Price
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('currentStock')}
                    className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Current Stock Level
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {sortedItems.map((item) => {
                  const isNegative = item.currentStock < 0;
                  const isLow = item.currentStock <= item.minimumStock && !isNegative;

                  return (
                    <tr
                      key={item.productId}
                      onClick={() => openProductModal(item)}
                      className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4 font-mono text-xs text-slate-500 font-semibold">
                        {item.itemCode}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700">
                        {item.scanCode || '—'}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 group-hover:text-blue-700">
                        <div className="flex items-center gap-2">
                          {item.photoUrl ? (
                            <img
                              src={item.photoUrl}
                              alt={item.longDescription}
                              className="w-8 h-8 rounded object-cover border border-slate-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
                              <ImageIcon className="w-4 h-4" />
                            </div>
                          )}
                          <span className="line-clamp-1">{item.longDescription}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                          {item.departmentName}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        ${item.sellingPrice.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                            isNegative
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : isLow
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {isNegative && <AlertTriangle className="w-3 h-3 mr-1" />}
                          {item.currentStock} units
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedProduct.photoUrl ? (
                  <img
                    src={selectedProduct.photoUrl}
                    alt={selectedProduct.longDescription}
                    className="w-12 h-12 rounded-lg object-cover border-2 border-white/20"
                  />
                ) : (
                  <div className="p-3 bg-blue-600/30 rounded-lg text-blue-300">
                    <Package className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold tracking-tight">{selectedProduct.longDescription}</h2>
                  <p className="text-xs text-slate-400 font-mono flex items-center gap-3 mt-0.5">
                    <span>Scan Code: {selectedProduct.scanCode || 'N/A'}</span>
                    <span>Item ID: {selectedProduct.itemCode}</span>
                    <span>Dept: {selectedProduct.departmentName}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setProductDetails(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <span className="text-slate-500 block">Selling Price</span>
                  <span className="text-lg font-extrabold text-slate-900">
                    ${selectedProduct.sellingPrice.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Cost Price</span>
                  <span className="text-lg font-bold text-slate-700">
                    ${selectedProduct.costPrice.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Current Stock</span>
                  <span
                    className={`text-lg font-extrabold ${
                      selectedProduct.currentStock < 0 ? 'text-red-600' : 'text-emerald-700'
                    }`}
                  >
                    {selectedProduct.currentStock} units
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Reorder Minimum</span>
                  <span className="text-lg font-bold text-slate-700">
                    {selectedProduct.minimumStock} units
                  </span>
                </div>
              </div>

              {/* Sales History Visualizer Graph */}
              <div className="border border-slate-200 rounded-xl p-5 bg-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-blue-600" />
                      Sales Quantity & History Visualizer
                    </h3>
                    <p className="text-xs text-slate-500">
                      Sold quantities over time for {selectedProduct.longDescription}
                    </p>
                  </div>

                  {/* Sub-tabs: Weekly, Monthly, Yearly */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                    <button
                      onClick={() => setActiveHistoryTab('weekly')}
                      className={`px-3 py-1 rounded transition-all ${
                        activeHistoryTab === 'weekly'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Weekly (Day)
                    </button>
                    <button
                      onClick={() => setActiveHistoryTab('monthly')}
                      className={`px-3 py-1 rounded transition-all ${
                        activeHistoryTab === 'monthly'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Monthly (Day)
                    </button>
                    <button
                      onClick={() => setActiveHistoryTab('yearly')}
                      className={`px-3 py-1 rounded transition-all ${
                        activeHistoryTab === 'yearly'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Yearly (Month)
                    </button>
                  </div>
                </div>

                {loadingDetails || !productDetails ? (
                  <div className="h-48 flex items-center justify-center text-slate-400 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2 text-blue-600" />
                    Loading sales history graph...
                  </div>
                ) : (
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={
                          activeHistoryTab === 'weekly'
                            ? productDetails.salesHistory.weekly
                            : activeHistoryTab === 'monthly'
                            ? productDetails.salesHistory.monthly
                            : productDetails.salesHistory.yearly
                        }
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                          formatter={(val: any) => [`${val} units sold`, 'Quantity']}
                        />
                        <Bar dataKey="qtySold" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Stock Movement Audit Log List */}
              <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-600" />
                  Stock Movement Log (Audit Trail)
                </h3>

                {loadingDetails || !productDetails ? (
                  <div className="p-6 text-center text-slate-400 text-xs">Loading audit log...</div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Date & Time</th>
                          <th className="py-2.5 px-3">Transaction Type</th>
                          <th className="py-2.5 px-3 text-right">Qty Change</th>
                          <th className="py-2.5 px-3 text-right">Balance After</th>
                          <th className="py-2.5 px-3">Reference / Doc</th>
                          <th className="py-2.5 px-3">User</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {productDetails.movements.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono text-slate-500">{m.dateTime}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  m.type === 'Sale'
                                    ? 'bg-blue-50 text-blue-700'
                                    : m.type === 'Goods Received'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {m.type}
                              </span>
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-bold ${
                                m.changeQty < 0 ? 'text-red-600' : 'text-emerald-600'
                              }`}
                            >
                              {m.changeQty > 0 ? `+${m.changeQty}` : m.changeQty}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              {m.balanceAfter}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">{m.reference}</td>
                            <td className="py-2.5 px-3 text-slate-500">{m.user}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setProductDetails(null);
                }}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition-colors"
              >
                Close Product Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
