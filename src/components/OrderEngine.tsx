import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  Download,
  Printer,
  RefreshCw,
  Truck,
  AlertCircle,
  CheckCircle2,
  Star,
  Package,
  X,
  ShieldCheck,
  LayoutList,
  LayoutGrid,
  ImagePlus,
  Camera,
} from 'lucide-react';
import type {
  DeliverySchedule,
  OrderRecommendation,
  Supplier,
  SupplierConfig,
  SupplierConfigMap,
  SupplierProduct,
} from '../types';
import {
  formatSchedule,
  formatTime,
  getCoverageDays,
  normalizeSupplierConfig,
  normalizeSupplierConfigMap,
  pickNextScheduleIndex,
} from '../supplierConfigUtils';
import { compareByPackSize, formatPackSizeLabel, readFileAsDataUrl } from '../productUtils';

type EditableRow = OrderRecommendation & { orderQty: number };
type ProductViewMode = 'list' | 'thumbnail';
type ProductSortMode = 'size-asc' | 'size-desc' | 'name-asc' | 'name-desc' | 'dept' | 'starred';

type ConfiguredSupplier = Supplier & {
  starredCount?: number;
  config?: SupplierConfig;
};

const DEPT_ROW_COLORS = [
  'bg-sky-50',
  'bg-emerald-50',
  'bg-amber-50',
  'bg-rose-50',
  'bg-violet-50',
  'bg-teal-50',
  'bg-orange-50',
  'bg-indigo-50',
  'bg-lime-50',
  'bg-cyan-50',
  'bg-fuchsia-50',
  'bg-yellow-50',
];

const DEPT_HEADER_COLORS = [
  'bg-sky-100 text-sky-900 border-sky-200',
  'bg-emerald-100 text-emerald-900 border-emerald-200',
  'bg-amber-100 text-amber-900 border-amber-200',
  'bg-rose-100 text-rose-900 border-rose-200',
  'bg-violet-100 text-violet-900 border-violet-200',
  'bg-teal-100 text-teal-900 border-teal-200',
  'bg-orange-100 text-orange-900 border-orange-200',
  'bg-indigo-100 text-indigo-900 border-indigo-200',
  'bg-lime-100 text-lime-900 border-lime-200',
  'bg-cyan-100 text-cyan-900 border-cyan-200',
  'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200',
  'bg-yellow-100 text-yellow-900 border-yellow-200',
];

function departmentColorIndex(code: number | null | undefined, name: string): number {
  const n = Number(code);
  if (Number.isFinite(n)) return Math.abs(n) % DEPT_ROW_COLORS.length;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i) * (i + 1)) % 997;
  return hash % DEPT_ROW_COLORS.length;
}

export default function OrderEngine({ connected }: { connected: boolean }) {
  const [suppliers, setSuppliers] = useState<ConfiguredSupplier[]>([]);
  const [configs, setConfigs] = useState<SupplierConfigMap>({});
  const [supplierId, setSupplierId] = useState('');
  const [scheduleIndex, setScheduleIndex] = useState(0);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [config, setConfig] = useState<SupplierConfig | null>(null);
  const [schedule, setSchedule] = useState<DeliverySchedule | null>(null);
  const [coverageDays, setCoverageDays] = useState<string[]>([]);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [onlyNeedsOrder, setOnlyNeedsOrder] = useState(true);

  const [showProductsModal, setShowProductsModal] = useState(false);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productFilter, setProductFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [productSort, setProductSort] = useState<ProductSortMode>('size-asc');
  const [viewMode, setViewMode] = useState<ProductViewMode>('list');
  const [starredOnly, setStarredOnly] = useState(false);
  const [savingStars, setSavingStars] = useState(false);
  const [uploadingPhotoId, setUploadingPhotoId] = useState<number | null>(null);

  useEffect(() => {
    if (!connected) return;
    void loadConfiguredSuppliers();
  }, [connected]);

  useEffect(() => {
    if (!supplierId) return;
    const cfg = configs[supplierId];
    if (!cfg?.schedules?.length) {
      setScheduleIndex(0);
      return;
    }
    setScheduleIndex(pickNextScheduleIndex(cfg.schedules));
    setRows([]);
    setConfig(null);
    setSchedule(null);
    setCoverageDays([]);
    setSupplier(null);
    setInfo(null);
    setShowProductsModal(false);
    setProducts([]);
  }, [supplierId]);

  const loadConfiguredSuppliers = async () => {
    try {
      const [supRes, cfgRes] = await Promise.all([
        fetch('/api/suppliers/configured'),
        fetch('/api/supplier-configs'),
      ]);
      const supData = await supRes.json();
      const cfgData = normalizeSupplierConfigMap(await cfgRes.json());
      if (supData.error) throw new Error(supData.error);
      setSuppliers(supData.suppliers || []);
      setConfigs(cfgData);
      if (supplierId && !cfgData[supplierId]) {
        setSupplierId('');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load configured suppliers');
    }
  };

  const activeConfig = useMemo(() => {
    if (config) return normalizeSupplierConfig(config);
    if (!supplierId) return null;
    return configs[supplierId] || null;
  }, [config, configs, supplierId]);

  const selectedSchedules = activeConfig?.schedules || [];
  const selectedSchedule =
    schedule || selectedSchedules[scheduleIndex] || selectedSchedules[0] || null;
  const previewCoverage = selectedSchedule
    ? getCoverageDays(selectedSchedule.cutOffDay, selectedSchedule.deliveryDay)
    : [];

  const openProductsModal = async () => {
    if (!supplierId) return;
    setProductsLoading(true);
    setError(null);
    setProductFilter('');
    setDeptFilter('all');
    setStarredOnly(false);
    try {
      const res = await fetch(`/api/suppliers/${encodeURIComponent(supplierId)}/products`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProducts(data.products || []);
      setShowProductsModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load products');
    } finally {
      setProductsLoading(false);
    }
  };

  /** Toggle stars in-memory only; IdealPOS is never written. Saved to local JSON on close. */
  const toggleStarLocal = (productId: number) => {
    setProducts((prev) =>
      prev.map((p) => (p.productId === productId ? { ...p, starred: !p.starred } : p))
    );
  };

  const uploadProductPhoto = async (productId: number, file: File) => {
    setUploadingPhotoId(productId);
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await fetch('/api/product-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          mimeType: file.type || 'image/jpeg',
          data: dataUrl,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Photo upload failed');
      setProducts((prev) =>
        prev.map((p) => (p.productId === productId ? { ...p, photoUrl: data.photoUrl } : p))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo');
    } finally {
      setUploadingPhotoId(null);
    }
  };

  const removeProductPhoto = async (productId: number) => {
    try {
      const res = await fetch(`/api/product-photos/${productId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to remove photo');
      setProducts((prev) =>
        prev.map((p) => (p.productId === productId ? { ...p, photoUrl: null } : p))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to remove photo');
    }
  };

  const closeProductsModal = async () => {
    if (!supplierId) {
      setShowProductsModal(false);
      return;
    }
    setSavingStars(true);
    setError(null);
    try {
      const productIds = products.filter((p) => p.starred).map((p) => p.productId);
      const res = await fetch('/api/starred-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId, productIds }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to save stars');

      setSuppliers((prev) =>
        prev.map((s) =>
          String(s.id) === supplierId
            ? { ...s, starredCount: (data.productIds || []).length }
            : s
        )
      );
      setShowProductsModal(false);
      setInfo(`Saved ${productIds.length} starred product(s) locally (IdealPOS unchanged).`);
    } catch (err: any) {
      setError(err.message || 'Failed to save stars');
    } finally {
      setSavingStars(false);
    }
  };

  const generateOrder = async () => {
    if (!supplierId) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(
        `/api/orders/recommend?supplierId=${encodeURIComponent(supplierId)}&scheduleIndex=${scheduleIndex}`
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to generate order');

      setSupplier(data.supplier);
      setConfig(normalizeSupplierConfig(data.config));
      setSchedule(data.schedule || null);
      setCoverageDays(data.coverageDays || []);
      setRows(
        (data.recommendations || []).map((r: OrderRecommendation) => ({
          ...r,
          orderQty: r.recommendedQty,
        }))
      );
      if (data.message) setInfo(data.message);
      if ((data.starredCount || 0) === 0) {
        void openProductsModal();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate order');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const visibleRows = useMemo(
    () => (onlyNeedsOrder ? rows.filter((r) => r.orderQty > 0 || r.recommendedQty > 0) : rows),
    [rows, onlyNeedsOrder]
  );

  const departmentGroups = useMemo(() => {
    const map = new Map<string, { code: number | null; name: string; rows: EditableRow[] }>();
    for (const row of visibleRows) {
      const name = row.departmentName || 'Unassigned';
      const key = `${row.departmentCode ?? 'x'}::${name}`;
      if (!map.has(key)) {
        map.set(key, { code: row.departmentCode ?? null, name, rows: [] });
      }
      map.get(key)!.rows.push(row);
    }
    return [...map.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((group) => ({
        ...group,
        rows: [...group.rows].sort((a, b) =>
          compareByPackSize(a.description || '', b.description || '')
        ),
      }));
  }, [visibleRows]);

  const departmentOptions = useMemo(() => {
    const names = new Set<string>();
    for (const p of products) names.add(p.departmentName || 'Unassigned');
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const orderLines = useMemo(() => rows.filter((r) => r.orderQty > 0), [rows]);
  const totalUnits = orderLines.reduce((sum, r) => sum + r.orderQty, 0);
  const totalCost = orderLines.reduce((sum, r) => sum + r.orderQty * (r.cost || 0), 0);
  const modalStarredCount = products.filter((p) => p.starred).length;
  const starredCount =
    (showProductsModal ? modalStarredCount : null) ??
    suppliers.find((s) => String(s.id) === supplierId)?.starredCount ??
    0;

  const filteredProducts = useMemo(() => {
    const q = productFilter.trim().toLowerCase();
    let list = products.filter((p) => {
      if (starredOnly && !p.starred) return false;
      if (deptFilter !== 'all' && (p.departmentName || 'Unassigned') !== deptFilter) return false;
      if (!q) return true;
      return (
        (p.description || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        (p.departmentName || '').toLowerCase().includes(q) ||
        String(p.productId).includes(q)
      );
    });

    list = [...list];
    switch (productSort) {
      case 'name-asc':
        list.sort((a, b) => (a.description || '').localeCompare(b.description || ''));
        break;
      case 'name-desc':
        list.sort((a, b) => (b.description || '').localeCompare(a.description || ''));
        break;
      case 'size-desc':
        list.sort((a, b) => compareByPackSize(b.description || '', a.description || ''));
        break;
      case 'dept':
        list.sort((a, b) => {
          const d = (a.departmentName || '').localeCompare(b.departmentName || '');
          if (d !== 0) return d;
          return compareByPackSize(a.description || '', b.description || '');
        });
        break;
      case 'starred':
        list.sort((a, b) => Number(b.starred) - Number(a.starred) || compareByPackSize(a.description || '', b.description || ''));
        break;
      case 'size-asc':
      default:
        list.sort((a, b) => compareByPackSize(a.description || '', b.description || ''));
        break;
    }
    return list;
  }, [products, productFilter, starredOnly, deptFilter, productSort]);

  const updateQty = (productId: number, value: string) => {
    const qty = Math.max(0, Math.floor(Number(value) || 0));
    setRows((prev) => prev.map((r) => (r.productId === productId ? { ...r, orderQty: qty } : r)));
  };

  const exportCsv = () => {
    const header = [
      'DepartmentCode',
      'Department',
      'ProductID',
      'Barcode',
      'Description',
      'CurrentStock',
      'MinimumStock',
      'CoverageAvg',
      'RecommendedQty',
      'OrderQty',
      'Cost',
      'LineTotal',
      'Reason',
    ];
    const lines = orderLines.map((r) =>
      [
        r.departmentCode ?? '',
        csvEscape(r.departmentName),
        r.productId,
        csvEscape(r.barcode),
        csvEscape(r.description),
        r.currentStock,
        r.minimumStock,
        r.coverageAvg,
        r.recommendedQty,
        r.orderQty,
        r.cost,
        (r.orderQty * (r.cost || 0)).toFixed(2),
        csvEscape(r.reason),
      ].join(',')
    );
    const supplierName = supplier?.name || 'supplier';
    downloadBlob(
      [header.join(','), ...lines].join('\n'),
      `kwikorder-${slugify(supplierName)}-${todayStamp()}.csv`,
      'text/csv;charset=utf-8'
    );
  };

  const printOrder = () => {
    const supplierName = supplier?.name || 'Supplier';
    const coverageLabel = (coverageDays.length ? coverageDays : previewCoverage).join(', ');
    const bodyRows = departmentGroups
      .map((group) => {
        const groupLines = group.rows.filter((r) => r.orderQty > 0);
        if (!groupLines.length) return '';
        return `
          <tr><td colspan="6" style="background:#e5e7eb;font-weight:600;padding:8px">${escapeHtml(group.name)} (${group.code ?? '—'})</td></tr>
          ${groupLines
            .map(
              (r) => `<tr>
            <td>${escapeHtml(r.barcode || String(r.productId))}</td>
            <td>${escapeHtml(r.description || '')}</td>
            <td class="num">${r.currentStock}</td>
            <td class="num">${r.coverageAvg}</td>
            <td class="num">${r.orderQty}</td>
            <td>${escapeHtml(r.reason)}</td>
          </tr>`
            )
            .join('')}`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Order - ${escapeHtml(supplierName)}</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; color: #111; margin: 24px; }
    h1 { margin: 0 0 4px; font-size: 22px; }
    .meta { color: #555; margin-bottom: 16px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background: #f3f4f6; }
    td.num, th.num { text-align: right; }
    .totals { margin-top: 16px; font-size: 14px; }
  </style>
</head>
<body>
  <h1>KwikOrder — ${escapeHtml(supplierName)}</h1>
  <div class="meta">
    Generated ${new Date().toLocaleString()}
    ${selectedSchedule ? ` · ${escapeHtml(formatSchedule(selectedSchedule))}` : ''}
    ${coverageLabel ? ` · Coverage days: ${escapeHtml(coverageLabel)}` : ''}
  </div>
  <table>
    <thead>
      <tr>
        <th>Code</th>
        <th>Description</th>
        <th class="num">Stock</th>
        <th class="num">Coverage avg</th>
        <th class="num">Order Qty</th>
        <th>Reason</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="totals"><strong>Lines:</strong> ${orderLines.length} &nbsp;|&nbsp; <strong>Units:</strong> ${totalUnits}</div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
    const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!win) {
      setError('Pop-up blocked. Allow pop-ups to print/export PDF.');
      return;
    }
    win.document.write(html);
    win.document.close();
  };

  if (!connected) {
    return (
      <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-100 text-center">
        <Truck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Connect to IdealPOS first</h3>
        <p className="text-gray-500 mt-2">Open Server Settings and connect before generating orders.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <ClipboardList className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Order Engine</h2>
            <p className="text-sm text-gray-500">
              Starred products only · usage on coverage days until delivery
            </p>
          </div>
        </div>

        <div className="mb-4 flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            IdealPOS is <strong>read-only</strong>. Stars, schedules, and draft orders are stored only in
            KwikOrder local files — nothing is written back to the POS database.
          </span>
        </div>

        {suppliers.length === 0 ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-4">
            No configured suppliers yet. Add schedules under{' '}
            <strong>Server Settings → Supplier Config</strong>, then return here.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Supplier</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Select a configured supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name} · {s.starredCount || 0} starred
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Order schedule</label>
                <select
                  value={scheduleIndex}
                  onChange={(e) => setScheduleIndex(Number(e.target.value))}
                  disabled={!supplierId || selectedSchedules.length === 0}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-gray-50"
                >
                  {selectedSchedules.map((s, i) => (
                    <option key={i} value={i}>
                      {formatSchedule(s)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void openProductsModal()}
                disabled={!supplierId || productsLoading}
                className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
              >
                <Package className="w-4 h-4" />
                {productsLoading ? 'Loading…' : 'Products & Stars'}
              </button>
              <button
                type="button"
                onClick={generateOrder}
                disabled={!supplierId || loading}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {loading ? 'Calculating…' : 'Generate Draft Order'}
              </button>
            </div>
          </div>
        )}

        {supplierId && selectedSchedule && (
          <div className="mt-4 p-4 rounded-lg bg-blue-50 border border-blue-100 text-blue-900 text-sm">
            <p>
              <strong>{suppliers.find((s) => String(s.id) === supplierId)?.name}</strong>
              {' '}— order by{' '}
              <strong>
                {selectedSchedule.cutOffDay} {formatTime(selectedSchedule.cutOffTime)}
              </strong>{' '}
              for <strong>{selectedSchedule.deliveryDay}</strong> delivery.
            </p>
            <p className="mt-1">
              Usage checked for:{' '}
              <strong>{(coverageDays.length ? coverageDays : previewCoverage).join(', ')}</strong>
              {' '}(avg over last 4 weeks, fallback 12 weeks).
            </p>
            <p className="mt-1 text-blue-800">
              Draft includes <strong>starred products only</strong>
              {starredCount > 0 ? ` (${starredCount})` : ''}.
              {' '}Safety buffer {Math.round(((activeConfig?.safetyMultiplier || 1.2) - 1) * 100)}%.
            </p>
          </div>
        )}

        {info && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
            {info}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              {supplier?.name}: {orderLines.length} lines · {totalUnits} units
              {totalCost > 0 && <> · est. ${totalCost.toFixed(2)}</>}
              {' '}· {departmentGroups.length} department{departmentGroups.length === 1 ? '' : 's'}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-600 mr-2">
                <input
                  type="checkbox"
                  checked={onlyNeedsOrder}
                  onChange={(e) => setOnlyNeedsOrder(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Needs order only
              </label>
              <button
                type="button"
                onClick={exportCsv}
                disabled={orderLines.length === 0}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" /> CSV / Excel
              </button>
              <button
                type="button"
                onClick={printOrder}
                disabled={orderLines.length === 0}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print / PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Product</th>
                  <th className="text-right font-medium px-3 py-3">Stock</th>
                  <th className="text-right font-medium px-3 py-3">Min</th>
                  <th className="text-right font-medium px-3 py-3">Cover avg</th>
                  <th className="text-right font-medium px-3 py-3">Suggest</th>
                  <th className="text-right font-medium px-3 py-3">Order</th>
                  <th className="text-left font-medium px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {departmentGroups.map((group) => {
                  const colorIdx = departmentColorIndex(group.code, group.name);
                  const rowBg = DEPT_ROW_COLORS[colorIdx];
                  const headerBg = DEPT_HEADER_COLORS[colorIdx];
                  return (
                    <React.Fragment key={`${group.code}-${group.name}`}>
                      <tr>
                        <td colSpan={7} className={`px-4 py-2.5 border-y ${headerBg} font-semibold`}>
                          {group.name}
                          <span className="ml-2 text-xs font-normal opacity-70">
                            code {group.code ?? '—'} · {group.rows.length} item{group.rows.length === 1 ? '' : 's'}
                          </span>
                        </td>
                      </tr>
                      {group.rows.map((r) => (
                        <tr key={r.productId} className={`${rowBg} border-b border-white/60`}>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-gray-900">{r.description}</div>
                            <div className="text-xs text-gray-500 font-mono">{r.barcode || r.productId}</div>
                          </td>
                          <td className={`text-right px-3 py-2.5 tabular-nums ${r.currentStock < 0 ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                            {fmtNum(r.currentStock)}
                          </td>
                          <td className="text-right px-3 py-2.5 text-gray-600 tabular-nums">{fmtNum(r.minimumStock)}</td>
                          <td className="text-right px-3 py-2.5 text-gray-600 tabular-nums">{fmtNum(r.coverageAvg)}</td>
                          <td className="text-right px-3 py-2.5 text-gray-800 font-medium tabular-nums">{r.recommendedQty}</td>
                          <td className="text-right px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={r.orderQty}
                              onChange={(e) => updateQty(r.productId, e.target.value)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded-md text-right tabular-nums focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[14rem]">{r.reason}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
                {departmentGroups.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                      No starred products need ordering for this schedule.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showProductsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close products popup"
            disabled={savingStars}
            onClick={() => void closeProductsModal()}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="products-stars-title"
            className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-xl shadow-xl border border-gray-200 flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
              <div>
                <h3 id="products-stars-title" className="font-semibold text-gray-900 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  Products &amp; Stars
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {modalStarredCount} starred · closing saves to KwikOrder only (IdealPOS unchanged)
                </p>
              </div>
              <button
                type="button"
                onClick={() => void closeProductsModal()}
                disabled={savingStars}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                title="Close & save"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
              <input
                type="search"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                placeholder="Search products or department…"
                className="flex-1 min-w-[12rem] px-3 py-1.5 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={starredOnly}
                  onChange={(e) => setStarredOnly(e.target.checked)}
                />
                Starred only
              </label>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 sticky top-0">
                  <tr>
                    <th className="text-left font-medium px-4 py-3 w-12">Star</th>
                    <th className="text-left font-medium px-3 py-3">Product</th>
                    <th className="text-left font-medium px-3 py-3">Dept</th>
                    <th className="text-right font-medium px-4 py-3">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProducts.map((p) => (
                    <tr key={p.productId} className={p.starred ? 'bg-amber-50/50' : ''}>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => toggleStarLocal(p.productId)}
                          className="p-1 rounded hover:bg-amber-100"
                          title={p.starred ? 'Unstar' : 'Star for ordering'}
                        >
                          <Star
                            className={`w-5 h-5 ${
                              p.starred ? 'text-amber-500 fill-amber-500' : 'text-gray-300'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{p.description}</div>
                        <div className="text-xs text-gray-400 font-mono">{p.barcode || p.productId}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {p.departmentName || 'Unassigned'}
                      </td>
                      <td
                        className={`text-right px-4 py-2 tabular-nums ${
                          p.currentStock < 0 ? 'text-red-600 font-medium' : 'text-gray-700'
                        }`}
                      >
                        {fmtNum(p.currentStock)}
                      </td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        No products match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3 bg-gray-50">
              <p className="text-xs text-gray-500">Close to save starred list locally.</p>
              <button
                type="button"
                onClick={() => void closeProductsModal()}
                disabled={savingStars}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {savingStars ? 'Saving…' : 'Close & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtNum(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function csvEscape(value: string | number | null | undefined) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'order';
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
