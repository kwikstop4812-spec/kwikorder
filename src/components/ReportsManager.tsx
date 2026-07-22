import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  BarChart2,
  PieChart as PieIcon,
  TrendingUp,
  Printer,
  Filter,
  DollarSign,
  Clock,
  Layers,
  CheckCircle,
  RefreshCw,
  Check,
  ChevronDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
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
} from 'recharts';
import { jsPDF } from 'jspdf';
import { POSReport } from '../types';
import { useAppTheme } from '../ThemeContext';

interface DeptItem {
  code: number;
  name: string;
}

export const ReportsManager: React.FC = () => {
  const { getThemeClasses } = useAppTheme();
  const theme = getThemeClasses();

  const [reportType, setReportType] = useState<'sales' | 'department' | 'finance' | 'hourly'>('sales');
  const [period, setPeriod] = useState<
    'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'current_fy' | 'last_fy' | 'custom'
  >('this_week');

  const [startDate, setStartDate] = useState<string>('2026-07-01');
  const [endDate, setEndDate] = useState<string>('2026-07-21');

  // Department Filtering
  const [departmentsList, setDepartmentsList] = useState<DeptItem[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState<boolean>(false);

  const [reportData, setReportData] = useState<POSReport | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch departments list
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await fetch('/api/pos/departments');
        if (res.ok) {
          const json = await res.json();
          if (json.departments) {
            setDepartmentsList(json.departments);
          }
        }
      } catch (err) {
        console.error('Failed to load departments', err);
      }
    };
    fetchDepts();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const deptsQuery = selectedDepts.join(',');
      const url = `/api/pos/reports?type=${reportType}&period=${period}&startDate=${startDate}&endDate=${endDate}&departments=${encodeURIComponent(
        deptsQuery
      )}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load report');
      const json = await res.json();
      setReportData(json);
    } catch (err) {
      console.error('Report fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, period, startDate, endDate, selectedDepts]);

  const toggleDepartment = (deptName: string) => {
    if (selectedDepts.includes(deptName)) {
      setSelectedDepts(selectedDepts.filter((d) => d !== deptName));
    } else {
      setSelectedDepts([...selectedDepts, deptName]);
    }
  };

  const toggleAllDepartments = () => {
    if (selectedDepts.length === departmentsList.length) {
      setSelectedDepts([]);
    } else {
      setSelectedDepts(departmentsList.map((d) => d.name));
    }
  };

  // Export PDF using jsPDF with proper tabular view and graph on the last page!
  const exportPDF = () => {
    if (!reportData) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // --- PAGE 1: REPORT HEADER & TABULAR DATA ---
    // Title Header Banner
    doc.setFillColor(30, 41, 59); // Slate-800
    doc.rect(0, 0, pageWidth, 26, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(reportData.title.toUpperCase(), 14, 14);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`IDEALPOS LIVE SUITE  |  ID: ${reportData.id}`, pageWidth - 14, 14, { align: 'right' });

    // Sub-header metadata bar
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text(`Period: ${reportData.periodText}`, 14, 33);
    doc.text(`Generated At: ${reportData.generatedAt}`, pageWidth - 14, 33, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(14, 36, pageWidth - 14, 36);

    // KPI Summary Section Boxes
    let yPos = 42;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('EXECUTIVE KPI SUMMARY', 14, yPos);
    yPos += 5;

    const kpiBoxWidth = (pageWidth - 28 - (reportData.kpis.length - 1) * 4) / reportData.kpis.length;
    reportData.kpis.forEach((kpi, idx) => {
      const boxX = 14 + idx * (kpiBoxWidth + 4);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(boxX, yPos, kpiBoxWidth, 18, 2, 2, 'FD');

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text(kpi.label.toUpperCase(), boxX + 4, yPos + 5);

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(kpi.value, boxX + 4, yPos + 12);

      if (kpi.subtext) {
        doc.setTextColor(37, 99, 235);
        doc.setFontSize(7);
        doc.text(kpi.subtext, boxX + 4, yPos + 16);
      }
    });

    yPos += 24;

    // Detailed Table View
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DETAILED BREAKDOWN TABLE', 14, yPos);
    yPos += 5;

    const headers = reportData.tableHeaders;
    const colWidth = (pageWidth - 28) / headers.length;

    // Table Header Row
    doc.setFillColor(37, 99, 235); // Blue-600
    doc.rect(14, yPos, pageWidth - 28, 8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    headers.forEach((h, colIdx) => {
      doc.text(h.toUpperCase(), 14 + colIdx * colWidth + 2, yPos + 5.5);
    });

    yPos += 8;

    // Table Rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    reportData.tableRows.forEach((row, rowIdx) => {
      // Check for page overflow
      if (yPos > pageHeight - 25) {
        doc.addPage();
        yPos = 20;

        // Draw header on new page
        doc.setFillColor(37, 99, 235);
        doc.rect(14, yPos, pageWidth - 28, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        headers.forEach((h, colIdx) => {
          doc.text(h.toUpperCase(), 14 + colIdx * colWidth + 2, yPos + 5.5);
        });
        yPos += 8;
        doc.setFont('helvetica', 'normal');
      }

      // Alternating row background
      if (rowIdx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, yPos, pageWidth - 28, 7, 'F');
      }

      doc.setDrawColor(241, 245, 249);
      doc.line(14, yPos + 7, pageWidth - 14, yPos + 7);

      doc.setTextColor(30, 41, 59);
      headers.forEach((h, colIdx) => {
        const cellValue = String(row[h] || '');
        doc.text(cellValue, 14 + colIdx * colWidth + 2, yPos + 5);
      });

      yPos += 7;
    });

    // --- LAST PAGE: GRAPH & CHART VISUALIZATION ---
    doc.addPage();

    // Chart Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('GRAPHICAL DATA VISUALIZATION', 14, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${reportData.title} Analytics Graph`, pageWidth - 14, 15, { align: 'right' });

    // Graph Container Box
    const chartX = 14;
    const chartY = 35;
    const chartW = pageWidth - 28;
    const chartH = 160;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(chartX, chartY, chartW, chartH, 4, 4, 'FD');

    // Chart Title inside Container
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`${reportData.category} Performance Visual Breakdown (${reportData.chartType.toUpperCase()} VIEW)`, chartX + 8, chartY + 12);

    // Render Vector Chart onto PDF canvas
    const dataItems = reportData.chartData;
    const maxVal = Math.max(...dataItems.map((d) => d.value), 1);

    const plotX = chartX + 24;
    const plotY = chartY + 28;
    const plotW = chartW - 36;
    const plotH = chartH - 45;

    // Grid lines & Y Axis
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    for (let i = 0; i <= 4; i++) {
      const gridY = plotY + (plotH / 4) * i;
      doc.line(plotX, gridY, plotX + plotW, gridY);

      const labelVal = Math.round(maxVal - (maxVal / 4) * i);
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(7);
      doc.text(labelVal >= 1000 ? `${(labelVal / 1000).toFixed(1)}k` : `${labelVal}`, plotX - 3, gridY + 1, { align: 'right' });
    }

    if (reportData.chartType === 'line') {
      // Draw Polyline Graph
      const stepX = plotW / Math.max(dataItems.length - 1, 1);
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(1.2);

      for (let i = 0; i < dataItems.length - 1; i++) {
        const x1 = plotX + i * stepX;
        const y1 = plotY + plotH - (dataItems[i].value / maxVal) * plotH;
        const x2 = plotX + (i + 1) * stepX;
        const y2 = plotY + plotH - (dataItems[i + 1].value / maxVal) * plotH;
        doc.line(x1, y1, x2, y2);
      }

      // Draw Data Nodes & Labels
      dataItems.forEach((d, i) => {
        const x = plotX + i * stepX;
        const y = plotY + plotH - (d.value / maxVal) * plotH;

        doc.setFillColor(37, 99, 235);
        doc.circle(x, y, 1.8, 'F');

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(6.5);
        doc.text(`${d.value}`, x, y - 3, { align: 'center' });

        doc.setTextColor(100, 116, 139);
        doc.text(d.label, x, plotY + plotH + 5, { align: 'center' });
      });
    } else {
      // Draw Bar Chart / Pie Representation
      const barCount = dataItems.length;
      const barGap = 6;
      const barW = Math.min((plotW - (barCount + 1) * barGap) / barCount, 22);

      dataItems.forEach((d, i) => {
        const barX = plotX + barGap + i * (barW + barGap);
        const barH = (d.value / maxVal) * plotH;
        const barY = plotY + plotH - barH;

        // Bar Fill Color
        const colors = [
          [37, 99, 235],   // Blue
          [16, 185, 129],  // Emerald
          [139, 92, 246],  // Purple
          [245, 158, 11],  // Amber
          [236, 72, 153],  // Pink
          [14, 165, 233],  // Sky
          [234, 88, 12],   // Orange
        ];
        const [r, g, b] = colors[i % colors.length];

        doc.setFillColor(r, g, b);
        doc.roundedRect(barX, barY, barW, barH, 1, 1, 'F');

        // Value text above bar
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.text(`${d.value}`, barX + barW / 2, barY - 2, { align: 'center' });

        // Category X Label
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        const truncLabel = d.label.length > 10 ? d.label.substring(0, 9) + '..' : d.label;
        doc.text(truncLabel, barX + barW / 2, plotY + plotH + 5, { align: 'center' });
      });
    }

    // PDF Footer Sign-off Note
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(chartX, chartY + chartH + 10, chartW, 20, 2, 2, 'FD');

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text(
      'Official POS Suite Report. All metrics calculated from verified Point-of-Sale store transactions.',
      chartX + 6,
      chartY + chartH + 18
    );
    doc.text(`Report File: ${reportData.id}_${reportType}_${period}.pdf`, chartX + 6, chartY + chartH + 24);

    doc.save(`${reportData.id}_${reportType}_${period}.pdf`);
  };

  // Export CSV
  const exportCSV = () => {
    if (!reportData) return;
    const headers = reportData.tableHeaders.join(',');
    const rows = reportData.tableRows.map((r) =>
      reportData.tableHeaders.map((h) => `"${r[h] || ''}"`).join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${reportData.id}_${reportType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            POS Business & Executive Reports
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Generate, visualize, and export sales, department, finance, and hourly traffic reports
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportPDF}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export PDF (with Chart)
          </button>
          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Report Selector Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 text-xs font-semibold">
          <button
            onClick={() => setReportType('sales')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              reportType === 'sales'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Sales Summary
          </button>

          <button
            onClick={() => setReportType('department')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              reportType === 'department'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            Department & Margin
          </button>

          <button
            onClick={() => setReportType('finance')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              reportType === 'finance'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Finance & Tender
          </button>

          <button
            onClick={() => setReportType('hourly')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              reportType === 'hourly'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            Hourly Traffic & Peak
          </button>
        </div>

        {/* Date Range & Department Multi-Select Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs font-medium text-slate-600">
          {/* Period Selector Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800 flex items-center gap-1 mr-1">
              <Calendar className="w-4 h-4 text-slate-400" />
              Period:
            </span>

            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'this_week', label: 'This Week' },
              { id: 'last_week', label: 'Last Week' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'current_fy', label: 'Current FY' },
              { id: 'last_fy', label: 'Last FY' },
              { id: 'custom', label: 'Custom Range' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as any)}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  period === p.id
                    ? 'bg-slate-900 text-white font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Department Multi-Select Dropdown Filter */}
          <div className="relative">
            <button
              onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-slate-800 font-semibold flex items-center gap-2 transition-colors"
            >
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {selectedDepts.length === 0
                  ? 'All Departments'
                  : `${selectedDepts.length} Dept${selectedDepts.length > 1 ? 's' : ''} Selected`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {isDeptDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-3 space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-800 text-xs">Filter Departments</span>
                  <button
                    onClick={toggleAllDepartments}
                    className="text-[11px] text-blue-600 hover:underline font-semibold"
                  >
                    {selectedDepts.length === departmentsList.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pt-1">
                  {departmentsList.map((dept) => {
                    const isChecked = selectedDepts.includes(dept.name);
                    return (
                      <label
                        key={dept.code}
                        onClick={() => toggleDepartment(dept.name)}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer text-xs text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="truncate">{dept.name}</span>
                      </label>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => setIsDeptDropdownOpen(false)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-[11px] font-semibold hover:bg-blue-700"
                  >
                    Apply Filter
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Custom Date Range Inputs (Shown when period === 'custom') */}
        {period === 'custom' && (
          <div className="flex items-center gap-4 pt-3 border-t border-slate-100 bg-slate-50 p-3 rounded-lg text-xs">
            <span className="font-semibold text-slate-700">Custom Date Selection:</span>
            <div className="flex items-center gap-2">
              <label className="text-slate-500">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-md bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-500">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-md bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={fetchReport}
              className="px-3 py-1.5 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
            >
              Update Report
            </button>
          </div>
        )}
      </div>

      {/* Main Report Output View */}
      {loading || !reportData ? (
        <div className="p-16 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
          <span className="text-base font-medium">Generating POS report...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {reportData.kpis.map((kpi, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  {kpi.label}
                </span>
                <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
                  {kpi.value}
                </span>
                {kpi.subtext && (
                  <span className="text-xs text-blue-600 font-medium mt-1 block">{kpi.subtext}</span>
                )}
              </div>
            ))}
          </div>

          {/* Report Embedded Chart Visualizer */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-blue-600" />
                {reportData.title} — Visual Analytics
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                Report ID: {reportData.id}
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {reportData.chartType === 'pie' ? (
                  <PieChart>
                    <Pie
                      data={reportData.chartData}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={85}
                      label={({ label, percent }) => `${label}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {reportData.chartData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={theme.chartColors[index % theme.chartColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [`$${Number(val).toLocaleString()}`, 'Value']} />
                  </PieChart>
                ) : reportData.chartType === 'line' ? (
                  <LineChart data={reportData.chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                    <Tooltip formatter={(val: any) => [`${val}`, 'Amount']} />
                    <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                ) : (
                  <BarChart data={reportData.chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                    <Tooltip formatter={(val: any) => [`${val}`, 'Value']} />
                    <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Printable Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Breakdown Data Table</h3>
              <span className="text-xs text-slate-500">
                {reportData.tableRows.length} Records
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    {reportData.tableHeaders.map((header) => (
                      <th key={header} className="py-3 px-4">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {reportData.tableRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      {reportData.tableHeaders.map((header) => (
                        <td key={header} className="py-3 px-4 font-medium">
                          {row[header]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
