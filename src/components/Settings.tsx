import React, { useEffect, useMemo, useState } from 'react';
import {
  Database,
  Server,
  User,
  Key,
  CheckCircle,
  XCircle,
  Truck,
  Save,
  Plus,
  Trash2,
} from 'lucide-react';
import { WEEKDAYS } from '../schemaMap';
import {
  defaultSchedule,
  formatSchedule,
  normalizeSupplierConfigMap,
} from '../supplierConfigUtils';
import type { DeliverySchedule, Supplier, SupplierConfig, SupplierConfigMap } from '../types';

type DraftEntry = {
  supplierId: string;
  safetyBufferPct: number;
  schedules: DeliverySchedule[];
};

export default function Settings({ onStatusUpdate }: { onStatusUpdate: () => void }) {
  const [server, setServer] = useState('localhost\\IDEALSQL');
  const [database, setDatabase] = useState('IPSTransaction');
  const [user, setUser] = useState('kwikorder');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [configs, setConfigs] = useState<SupplierConfigMap>({});
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const [addSupplierId, setAddSupplierId] = useState('');
  const [configSaving, setConfigSaving] = useState(false);
  const [configMessage, setConfigMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    void refreshConnectionAndSuppliers();
  }, []);

  const refreshConnectionAndSuppliers = async () => {
    try {
      const statusRes = await fetch('/api/status');
      const status = await statusRes.json();
      setConnected(!!status.connected);
      if (!status.connected) return;

      const [supRes, cfgRes] = await Promise.all([
        fetch('/api/suppliers'),
        fetch('/api/supplier-configs'),
      ]);
      const supData = await supRes.json();
      const cfgData = normalizeSupplierConfigMap(await cfgRes.json());
      if (!supData.error) setSuppliers(supData.suppliers || []);
      setConfigs(cfgData);
      setDrafts(configsToDrafts(cfgData));
    } catch {
      setConnected(false);
    }
  };

  const unconfiguredSuppliers = useMemo(() => {
    const configured = new Set(drafts.map((d) => d.supplierId));
    return suppliers.filter((s) => !configured.has(String(s.id)));
  }, [suppliers, drafts]);

  const testConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server, database, user, password }),
      });
      const data = await response.json();
      setResult(data);
      onStatusUpdate();
      if (data.success) {
        await refreshConnectionAndSuppliers();
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Failed to connect' });
    } finally {
      setLoading(false);
    }
  };

  const addSupplierDraft = () => {
    if (!addSupplierId) return;
    if (drafts.some((d) => d.supplierId === addSupplierId)) return;
    const existing = configs[addSupplierId];
    setDrafts((prev) => [
      ...prev,
      existing
        ? configToDraft(addSupplierId, existing)
        : {
            supplierId: addSupplierId,
            safetyBufferPct: 20,
            schedules: [defaultSchedule()],
          },
    ]);
    setAddSupplierId('');
    setConfigMessage(null);
  };

  const updateDraft = (supplierId: string, patch: Partial<DraftEntry>) => {
    setDrafts((prev) =>
      prev.map((d) => (d.supplierId === supplierId ? { ...d, ...patch } : d))
    );
  };

  const updateSchedule = (
    supplierId: string,
    index: number,
    patch: Partial<DeliverySchedule>
  ) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.supplierId !== supplierId) return d;
        const schedules = d.schedules.map((s, i) => (i === index ? { ...s, ...patch } : s));
        return { ...d, schedules };
      })
    );
  };

  const addSchedule = (supplierId: string) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.supplierId === supplierId
          ? { ...d, schedules: [...d.schedules, defaultSchedule()] }
          : d
      )
    );
  };

  const removeSchedule = (supplierId: string, index: number) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.supplierId !== supplierId) return d;
        if (d.schedules.length <= 1) return d;
        return { ...d, schedules: d.schedules.filter((_, i) => i !== index) };
      })
    );
  };

  const removeSupplierDraft = async (supplierId: string) => {
    const wasSaved = !!configs[supplierId];
    if (wasSaved) {
      const res = await fetch(`/api/supplier-configs/${encodeURIComponent(supplierId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        setConfigMessage({ success: false, text: data.message || 'Failed to remove supplier' });
        return;
      }
      setConfigs((prev) => {
        const next = { ...prev };
        delete next[supplierId];
        return next;
      });
    }
    setDrafts((prev) => prev.filter((d) => d.supplierId !== supplierId));
    setConfigMessage({ success: true, text: 'Supplier removed from config.' });
  };

  const saveAllConfigs = async () => {
    if (drafts.length === 0) {
      setConfigMessage({ success: false, text: 'Add at least one supplier to save.' });
      return;
    }
    setConfigSaving(true);
    setConfigMessage(null);

    try {
      const nextConfigs: SupplierConfigMap = { ...configs };
      for (const draft of drafts) {
        if (!draft.schedules.length) {
          throw new Error(`Add at least one schedule for ${supplierName(draft.supplierId)}`);
        }
        const payload = {
          supplierId: draft.supplierId,
          schedules: draft.schedules,
          safetyMultiplier: 1 + Math.max(0, Number(draft.safetyBufferPct) || 0) / 100,
        };
        const response = await fetch('/api/supplier-configs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Save failed');
        nextConfigs[draft.supplierId] = data.config || {
          schedules: draft.schedules,
          safetyMultiplier: payload.safetyMultiplier,
        };
      }
      setConfigs(nextConfigs);
      setDrafts(configsToDrafts(nextConfigs));
      setConfigMessage({
        success: true,
        text: `Saved ${drafts.length} supplier configuration${drafts.length === 1 ? '' : 's'}.`,
      });
    } catch (err: any) {
      setConfigMessage({ success: false, text: err.message || 'Failed to save configurations' });
    } finally {
      setConfigSaving(false);
    }
  };

  const supplierName = (id: string) =>
    suppliers.find((s) => String(s.id) === id)?.name || `Supplier ${id}`;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <Server className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-semibold text-gray-900">Server Settings</h2>
        </div>

        <form onSubmit={testConnection} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Server className="w-4 h-4 text-gray-400" />
                SQL Server
              </label>
              <input
                type="text"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                placeholder="localhost\IDEALSQL"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Database className="w-4 h-4 text-gray-400" />
                Database
              </label>
              <input
                type="text"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                placeholder="IPSTransaction"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                Username (Optional)
              </label>
              <input
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="kwikorder (SQL login)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Key className="w-4 h-4 text-gray-400" />
                Password (Optional)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center gap-4">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Testing...
                </>
              ) : (
                'Test Connection & Save'
              )}
            </button>
          </div>
        </form>

        {result && (
          <div className={`mt-6 p-4 rounded-lg flex items-start gap-3 ${result.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {result.success ? <CheckCircle className="w-5 h-5 mt-0.5" /> : <XCircle className="w-5 h-5 mt-0.5" />}
            <div>
              <p className="font-medium">{result.success ? 'Connection Successful' : 'Connection Failed'}</p>
              <p className="text-sm mt-1 opacity-90">{result.message}</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-2">
          <Truck className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-semibold text-gray-900">Supplier Config</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Configure multiple suppliers. Each supplier can have several cut-off / delivery schedules.
        </p>

        {!connected ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
            Connect to SQL Server above to load suppliers.
          </p>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium text-gray-700">Add supplier</label>
                <select
                  value={addSupplierId}
                  onChange={(e) => setAddSupplierId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Select supplier to add…</option>
                  {unconfiguredSuppliers.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name} ({s.productCount} products)
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={addSupplierDraft}
                disabled={!addSupplierId}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {drafts.length === 0 && (
              <p className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-4">
                No suppliers configured yet. Add one or more above.
              </p>
            )}

            <div className="space-y-4">
              {drafts.map((draft) => (
                <div
                  key={draft.supplierId}
                  className="border border-gray-200 rounded-xl p-4 space-y-4 bg-gray-50/40"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{supplierName(draft.supplierId)}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {draft.schedules.length} schedule{draft.schedules.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-gray-600 flex items-center gap-2">
                        Safety buffer %
                        <input
                          type="number"
                          min={0}
                          max={200}
                          step={5}
                          value={draft.safetyBufferPct}
                          onChange={(e) =>
                            updateDraft(draft.supplierId, {
                              safetyBufferPct: Number(e.target.value),
                            })
                          }
                          className="w-20 px-2 py-1 border border-gray-300 rounded-md bg-white"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void removeSupplierDraft(draft.supplierId)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Remove supplier"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {draft.schedules.map((schedule, index) => (
                      <div
                        key={index}
                        className="bg-white border border-gray-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_auto] gap-3 items-end"
                      >
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-500">Cut-off day</label>
                          <select
                            value={schedule.cutOffDay}
                            onChange={(e) =>
                              updateSchedule(draft.supplierId, index, {
                                cutOffDay: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                          >
                            {WEEKDAYS.map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-500">Time</label>
                          <input
                            type="time"
                            value={schedule.cutOffTime}
                            onChange={(e) =>
                              updateSchedule(draft.supplierId, index, {
                                cutOffTime: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-500">Delivery day</label>
                          <select
                            value={schedule.deliveryDay}
                            onChange={(e) =>
                              updateSchedule(draft.supplierId, index, {
                                deliveryDay: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                          >
                            {WEEKDAYS.map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                        <p className="text-xs text-gray-500 pb-2 md:hidden col-span-full">
                          {formatSchedule(schedule)}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeSchedule(draft.supplierId, index)}
                          disabled={draft.schedules.length <= 1}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed self-end"
                          title="Remove schedule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => addSchedule(draft.supplierId)}
                    className="text-sm text-blue-700 hover:text-blue-800 font-medium flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Add cut-off / delivery schedule
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => void saveAllConfigs()}
                disabled={configSaving || drafts.length === 0}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {configSaving ? 'Saving…' : 'Save All Supplier Configs'}
              </button>
            </div>

            {configMessage && (
              <div className={`p-3 rounded-lg text-sm border ${configMessage.success ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                {configMessage.text}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function configToDraft(supplierId: string, config: SupplierConfig): DraftEntry {
  return {
    supplierId,
    safetyBufferPct: Math.round(((config.safetyMultiplier || 1.2) - 1) * 100),
    schedules: config.schedules?.length ? config.schedules.map((s) => ({ ...s })) : [defaultSchedule()],
  };
}

function configsToDrafts(configs: SupplierConfigMap): DraftEntry[] {
  return Object.entries(configs).map(([supplierId, config]) => configToDraft(supplierId, config));
}
