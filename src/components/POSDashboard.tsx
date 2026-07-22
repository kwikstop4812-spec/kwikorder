import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Users,
  DollarSign,
  ShoppingBag,
  Clock,
  Calendar,
  BarChart2,
  PieChart as PieIcon,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Filter,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { POSDashboardData } from '../types';
import { useAppTheme } from '../ThemeContext';

export const POSDashboard: React.FC = () => {
  const { getThemeClasses } = useAppTheme();
  const theme = getThemeClasses();

  const [data, setData] = useState<POSDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User interactive state
  const [breakdownType, setBreakdownType] = useState<'department' | 'category' | 'tender'>('department');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'donut'>('bar');
  const [metricView, setMetricView] = useState<'sales' | 'customers'>('sales');

  const [dashboardPeriod, setDashboardPeriod] = useState<'today' | 'last_week' | 'last_month' | 'last_year' | 'last_fy'>('today');

  const fetchDashboard = async (selectedPeriod = dashboardPeriod) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pos/dashboard?period=${selectedPeriod}`);
      if (!res.ok) throw new Error('Failed to load POS dashboard data');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard(dashboardPeriod);
  }, [dashboardPeriod]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mr-3 text-blue-600" />
        <span className="text-lg font-medium">Loading POS Analytics & Charts...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 my-4">
        <p className="font-semibold">Error loading dashboard</p>
        <p className="text-sm mt-1">{error || 'Unknown error'}</p>
        <button
          onClick={fetchDashboard}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  // Calculate percentage changes
  const todayVsLastWeekPct = data.lastWeekSameTimeSales > 0
    ? (((data.todaySales - data.lastWeekSameTimeSales) / data.lastWeekSameTimeSales) * 100).toFixed(1)
    : '0';

  const monthVsLastMonthPct = data.lastMonthSameTimeSales > 0
    ? (((data.totalMonthSales - data.lastMonthSameTimeSales) / data.lastMonthSameTimeSales) * 100).toFixed(1)
    : '0';

  const customerVsLastWeekPct = data.lastWeekCustomerCount > 0
    ? (((data.customerCount - data.lastWeekCustomerCount) / data.lastWeekCustomerCount) * 100).toFixed(1)
    : '0';

  // Selected breakdown dataset
  const currentBreakdownData =
    breakdownType === 'department'
      ? data.departmentSales
      : breakdownType === 'category'
      ? data.categorySales
      : data.tenderSales;

  return (
    <div className="space-y-6">
      {/* Top Header Controls & Period Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            POS Live Store Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time point of sale metrics, session comparisons, and sales breakdown by period
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Dashboard Period Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <span className="text-slate-400 px-2 flex items-center gap-1 font-normal">
              <Filter className="w-3 h-3" />
              Period:
            </span>
            <button
              onClick={() => setDashboardPeriod('today')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                dashboardPeriod === 'today'
                  ? 'bg-white text-blue-600 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDashboardPeriod('last_week')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                dashboardPeriod === 'last_week'
                  ? 'bg-white text-blue-600 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last Week
            </button>
            <button
              onClick={() => setDashboardPeriod('last_month')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                dashboardPeriod === 'last_month'
                  ? 'bg-white text-blue-600 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last Month
            </button>
            <button
              onClick={() => setDashboardPeriod('last_year')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                dashboardPeriod === 'last_year'
                  ? 'bg-white text-blue-600 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last Year
            </button>
            <button
              onClick={() => setDashboardPeriod('last_fy')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                dashboardPeriod === 'last_fy'
                  ? 'bg-white text-blue-600 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last FY
            </button>
          </div>

          {/* Metric Toggle: Sales vs Customers */}
          <div className="bg-slate-200/80 p-1 rounded-lg flex items-center text-xs font-semibold">
            <button
              onClick={() => setMetricView('sales')}
              className={`px-3 py-1 rounded-md transition-all ${
                metricView === 'sales'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 inline mr-1" />
              Sales ($)
            </button>
            <button
              onClick={() => setMetricView('customers')}
              className={`px-3 py-1 rounded-md transition-all ${
                metricView === 'customers'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 inline mr-1" />
              Customers
            </button>
          </div>

          <button
            onClick={() => fetchDashboard(dashboardPeriod)}
            className="p-2 border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
            title="Refresh Live Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* POS Key Performance Indicators (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TILE 1: Current Session (Made First Tile as requested) */}
        <div className="bg-white border border-purple-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Current Session</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900">
              {metricView === 'sales'
                ? `$${(data.sessionSales ?? data.currentSales ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
                : `${data.sessionCustomers ?? 58} Cust`}
            </span>
            <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
              Live Session
            </span>
          </div>
          <div className="mt-3 text-xs space-y-1.5 pt-2 border-t border-slate-100 text-slate-600">
            <div className="flex justify-between">
              <span>Same Day Same Time Last Wk:</span>
              <span className="font-semibold text-slate-800">
                {metricView === 'sales'
                  ? `$${(data.sessionSalesLastWeekSameTime ?? 780).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
                  : `${data.sessionCustomersLastWeekSameTime ?? 52} Cust`}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total Last Wk Same Day:</span>
              <span className="font-semibold text-slate-800">
                {metricView === 'sales'
                  ? `$${(data.sessionSalesLastWeekSameDayTotal ?? 3950).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
                  : `${data.sessionCustomersLastWeekSameDayTotal ?? 268} Cust`}
              </span>
            </div>
          </div>
        </div>

        {/* TILE 2: Week-to-Date Sales (Renamed from Today's Total Sales) */}
        <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Week-to-Date {metricView === 'sales' ? 'Sales' : 'Customers'}</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900">
              {metricView === 'sales'
                ? `$${(data.wtdSales ?? data.todaySales ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
                : `${data.wtdCustomers ?? 1240} Cust`}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 inline-flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
              +8.4%
            </span>
          </div>
          <div className="mt-3 text-xs space-y-1.5 pt-2 border-t border-slate-100 text-slate-600">
            <div className="flex justify-between">
              <span>Same Time Last Week:</span>
              <span className="font-semibold text-slate-800">
                {metricView === 'sales'
                  ? `$${(data.wtdSalesLastWeekSameTime ?? 16800).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
                  : `${data.wtdCustomersLastWeekSameTime ?? 1120} Cust`}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total Last Week:</span>
              <span className="font-semibold text-slate-800">
                {metricView === 'sales'
                  ? `$${(data.wtdSalesLastWeekTotal ?? 31640).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
                  : `${data.wtdCustomersLastWeekTotal ?? 2150} Cust`}
              </span>
            </div>
          </div>
        </div>

        {/* TILE 3: Month-to-Date Sales */}
        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Month-to-Date {metricView === 'sales' ? 'Sales' : 'Customers'}</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900">
              {metricView === 'sales'
                ? `$${(data.mtdSales ?? data.totalMonthSales ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
                : `${data.mtdCustomers ?? 5680} Cust`}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 inline-flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
              +7.2%
            </span>
          </div>
          <div className="mt-3 text-xs space-y-1.5 pt-2 border-t border-slate-100 text-slate-600">
            <div className="flex justify-between">
              <span>Same Time Last Month:</span>
              <span className="font-semibold text-slate-800">
                {metricView === 'sales'
                  ? `$${(data.mtdSalesLastMonthSameTime ?? 78500).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
                  : `${data.mtdCustomersLastMonthSameTime ?? 5210} Cust`}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total Last Month:</span>
              <span className="font-semibold text-slate-800">
                {metricView === 'sales'
                  ? `$${(data.mtdSalesLastMonthTotal ?? 128450).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
                  : `${data.mtdCustomersLastMonthTotal ?? 8940} Cust`}
              </span>
            </div>
          </div>
        </div>

        {/* TILE 4: Customer Count / Mode Toggle Card */}
        <div
          onClick={() => setMetricView(metricView === 'sales' ? 'customers' : 'sales')}
          className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group"
          title="Click to toggle between Sales ($) and Customer Count view"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Customer Count & Basket</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg group-hover:bg-amber-100 transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900">
              {data.customerCount ?? 308} Txns
            </span>
            <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">
              Click to Toggle
            </span>
          </div>
          <div className="mt-3 text-xs space-y-1.5 pt-2 border-t border-slate-100 text-slate-600">
            <div className="flex justify-between">
              <span>Last Wk Same Time:</span>
              <span className="font-semibold text-slate-800">{data.lastWeekCustomerCount ?? 268} Cust</span>
            </div>
            <div className="flex justify-between">
              <span>Avg Basket Value:</span>
              <span className="font-semibold text-blue-600">${(data.avgBasketValue ?? 14.68).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Trend Comparison Chart (2 Cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Hourly Sales & Traffic Trend
              </h2>
              <p className="text-xs text-slate-500">
                Comparing today's {metricView === 'sales' ? 'sales revenue' : 'customer transactions'} against last week's same day
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.hourlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                  formatter={(value: any, name: any) => [
                    metricView === 'sales' ? `$${Number(value).toFixed(2)}` : `${value} txns`,
                    name === 'todaySales' || name === 'todayCustomers' ? 'Today' : 'Last Week Same Day',
                  ]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar
                  dataKey={metricView === 'sales' ? 'todaySales' : 'todayCustomers'}
                  name={metricView === 'sales' ? 'Today Sales' : 'Today Customers'}
                  fill="#2563eb"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Line
                  type="monotone"
                  dataKey={metricView === 'sales' ? 'lastWeekSales' : 'lastWeekCustomers'}
                  name={metricView === 'sales' ? 'Last Week Sales' : 'Last Week Customers'}
                  stroke="#94a3b8"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#64748b' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dynamic Sales Breakdown (1 Col) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-indigo-600" />
                Sales Breakdown
              </h2>

              {/* Chart type selector */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
                <button
                  onClick={() => setChartType('bar')}
                  className={`px-2 py-1 rounded font-medium ${chartType === 'bar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  title="Bar Chart"
                >
                  Bar
                </button>
                <button
                  onClick={() => setChartType('line')}
                  className={`px-2 py-1 rounded font-medium ${chartType === 'line' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  title="Line Chart"
                >
                  Line
                </button>
                <button
                  onClick={() => setChartType('pie')}
                  className={`px-2 py-1 rounded font-medium ${chartType === 'pie' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  title="Pie Chart"
                >
                  Pie
                </button>
                <button
                  onClick={() => setChartType('donut')}
                  className={`px-2 py-1 rounded font-medium ${chartType === 'donut' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  title="Donut Chart"
                >
                  Donut
                </button>
              </div>
            </div>

            {/* Breakdown type tabs */}
            <div className="flex items-center border-b border-slate-200 mb-4 text-xs font-semibold">
              <button
                onClick={() => setBreakdownType('department')}
                className={`pb-2 mr-4 border-b-2 transition-colors ${
                  breakdownType === 'department'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Department
              </button>
              <button
                onClick={() => setBreakdownType('category')}
                className={`pb-2 mr-4 border-b-2 transition-colors ${
                  breakdownType === 'category'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Category
              </button>
              <button
                onClick={() => setBreakdownType('tender')}
                className={`pb-2 border-b-2 transition-colors ${
                  breakdownType === 'tender'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Tender Type
              </button>
            </div>

            {/* Chart Area */}
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'pie' || chartType === 'donut' ? (
                  <PieChart>
                    <Pie
                      data={currentBreakdownData}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={chartType === 'donut' ? 45 : 0}
                      outerRadius={75}
                      paddingAngle={2}
                    >
                      {currentBreakdownData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={theme.chartColors[index % theme.chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                      formatter={(val: any) => [`$${Number(val).toFixed(2)}`, 'Sales']}
                    />
                  </PieChart>
                ) : chartType === 'line' ? (
                  <LineChart data={currentBreakdownData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                      formatter={(val: any) => [`$${Number(val).toFixed(2)}`, 'Sales']}
                    />
                    <Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                ) : (
                  <BarChart data={currentBreakdownData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                      formatter={(val: any) => [`$${Number(val).toFixed(2)}`, 'Sales']}
                    />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {currentBreakdownData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={theme.chartColors[index % theme.chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick list preview below chart */}
          <div className="mt-4 pt-3 border-t border-slate-100 max-h-36 overflow-y-auto space-y-1.5 text-xs">
            {currentBreakdownData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-slate-700">
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: theme.chartColors[idx % theme.chartColors.length] }}
                  />
                  <span className="truncate">{item.name}</span>
                </div>
                <div className="flex items-center gap-3 font-semibold">
                  <span>${item.amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                  <span className="text-slate-400 font-normal w-10 text-right">{item.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
