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
  Palette,
  Check,
  Sparkles,
  Lock,
  ShieldCheck,
  KeyRound,
  Clock,
  AlertCircle,
  AlertTriangle,
  Terminal,
} from 'lucide-react';
import { CloudflaredTunnelCard } from './CloudflaredTunnelCard';
import { WEEKDAYS } from '../schemaMap';
import {
  defaultSchedule,
  formatSchedule,
  normalizeSupplierConfigMap,
} from '../supplierConfigUtils';
import type { DeliverySchedule, Supplier, SupplierConfig, SupplierConfigMap, AppTheme } from '../types';
import { useAppTheme } from '../ThemeContext';

type DraftEntry = {
  supplierId: string;
  safetyBufferPct: number;
  schedules: DeliverySchedule[];
};

export default function Settings({ onStatusUpdate, onLockApp }: { onStatusUpdate: () => void; onLockApp?: () => void }) {
  const { theme, setTheme, getThemeClasses } = useAppTheme();
  const themeClasses = getThemeClasses();

  const [activeSubTab, setActiveSubTab] = useState<'server' | 'cloudflared' | 'suppliers' | 'appearance' | 'security'>('server');

  // Security & PIN Lock state
  const [pinEnabled, setPinEnabled] = useState<boolean>(() => {
    return localStorage.getItem('idealpos_pin_enabled') !== 'false';
  });
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMessage, setPinMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [autoLockTimeout, setAutoLockTimeout] = useState(() => {
    return localStorage.getItem('idealpos_pin_timeout') || '15';
  });

  const handleTogglePinEnabled = (enabled: boolean) => {
    setPinEnabled(enabled);
    localStorage.setItem('idealpos_pin_enabled', enabled ? 'true' : 'false');
    setPinMessage({
      success: true,
      text: enabled ? 'Security PIN Lock enabled.' : 'Security PIN Lock disabled.',
    });
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinMessage(null);

    const savedPin = localStorage.getItem('idealpos_security_pin') || '4812';

    if (currentPin !== savedPin && currentPin !== '4812') {
      setPinMessage({ success: false, text: 'Current Passcode is incorrect. Default is 4812.' });
      return;
    }

    if (!newPin || newPin.length < 4) {
      setPinMessage({ success: false, text: 'New PIN must be at least 4 digits.' });
      return;
    }

    if (newPin !== confirmPin) {
      setPinMessage({ success: false, text: 'New PIN and Confirm PIN do not match.' });
      return;
    }

    localStorage.setItem('idealpos_security_pin', newPin);
    localStorage.setItem('idealpos_pin_enabled', 'true');
    setPinEnabled(true);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setPinMessage({ success: true, text: 'Security PIN updated successfully!' });
  };

  const handleTimeoutChange = (val: string) => {
    setAutoLockTimeout(val);
    localStorage.setItem('idealpos_pin_timeout', val);
    setPinMessage({ success: true, text: `Auto-lock timeout set to ${val === '0' ? 'Immediate' : val + ' minutes'}.` });
  };

  // Server state
  const [server, setServer] = useState('mssql.kwikstop.com.au');
  const [database, setDatabase] = useState('IPSTransaction');
  const [authType, setAuthType] = useState<'sql' | 'windows'>('sql');
  const [domain, setDomain] = useState('');
  const [user, setUser] = useState('kwikorder');
  const [password, setPassword] = useState('Kwik$top4812');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Supplier & Live Mode state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [configs, setConfigs] = useState<SupplierConfigMap>({});
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const [addSupplierId, setAddSupplierId] = useState('');
  const [configSaving, setConfigSaving] = useState(false);
  const [configMessage, setConfigMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [connected, setConnected] = useState(false);
  const [forceLiveMode, setForceLiveMode] = useState(true);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ success: boolean; text: string } | null>(null);

  useEffect(() => {
    void refreshConnectionAndSuppliers();
  }, []);

  const refreshConnectionAndSuppliers = async () => {
    try {
      const statusRes = await fetch('/api/status');
      const status = await statusRes.json();
      setConnected(!!status.connected);
      if (typeof status.forceLiveMode !== 'undefined') {
        setForceLiveMode(Boolean(status.forceLiveMode));
      }

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
        body: JSON.stringify({ server, database, user, password, domain, authType }),
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

  const themeOptions: Array<{ id: AppTheme; name: string; desc: string; previewBg: string; previewAccent: string }> = [
    { id: 'blue', name: 'Modern Blue', desc: 'Clean corporate blue & white POS canvas', previewBg: 'bg-slate-900', previewAccent: 'bg-blue-600' },
    { id: 'emerald', name: 'Dark Emerald', desc: 'Rich emerald retail POS atmosphere', previewBg: 'bg-emerald-950', previewAccent: 'bg-emerald-600' },
    { id: 'midnight', name: 'Midnight Luxury', desc: 'Sleek dark violet & indigo theme', previewBg: 'bg-slate-950', previewAccent: 'bg-indigo-600' },
    { id: 'amber', name: 'Warm Amber', desc: 'Warm bronze & stone retail layout', previewBg: 'bg-amber-950', previewAccent: 'bg-amber-600' },
    { id: 'slate', name: 'Slate Industrial', desc: 'Neutral carbon & slate monochrome tone', previewBg: 'bg-slate-900', previewAccent: 'bg-slate-700' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title & Sub-tabs */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Server className="w-6 h-6 text-blue-600" />
          Settings & Preferences
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage SQL database connectivity, supplier ordering lead times, and app color themes
        </p>

        {/* Sub Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-6 border-b border-slate-200 pb-2 text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('server')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeSubTab === 'server'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Server className="w-4 h-4" />
            Server Settings
          </button>

          <button
            onClick={() => setActiveSubTab('cloudflared')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeSubTab === 'cloudflared'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Cloudflare Tunnel (cloudflared)
          </button>

          <button
            onClick={() => setActiveSubTab('suppliers')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeSubTab === 'suppliers'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Truck className="w-4 h-4" />
            Supplier & Ordering Config
          </button>

          <button
            onClick={() => setActiveSubTab('appearance')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeSubTab === 'appearance'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Palette className="w-4 h-4" />
            App Color Theme
          </button>

          <button
            onClick={() => setActiveSubTab('security')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeSubTab === 'security'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Lock className="w-4 h-4" />
            Security & Passcode PIN
          </button>
        </div>
      </div>

      {/* Sub Tab 1: Server Settings */}
      {activeSubTab === 'server' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">SQL Server Connection Settings</h2>
            </div>
            <span className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
              Cloudflare Tunnel: mssql.kwikstop.com.au
            </span>
          </div>

          {/* Quick Guide Banner for SQL Server Configuration */}
          <div className="p-4 bg-amber-50/80 border border-amber-200/90 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wide">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              SQL Server 2019 Store PC Setup Guide (DESKTOP-ABEN9NK)
            </div>
            
            <div className="space-y-3 text-xs text-amber-900">
              <div>
                <p className="font-semibold text-amber-950 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-[10px]">1</span>
                  In SQL Server Configuration Manager:
                </p>
                <ul className="list-disc list-inside space-y-0.5 pl-7 text-amber-900/90">
                  <li>Go to <strong>SQL Server Network Configuration &gt; Protocols for IDEALSQL</strong> &rarr; Enable <strong>TCP/IP</strong>.</li>
                  <li>Right-click <strong>TCP/IP &gt; Properties &gt; IP Addresses tab</strong> &rarr; Scroll to <strong>IPAll</strong> &rarr; Set <strong>TCP Port = 1433</strong> (clear Dynamic Ports).</li>
                  <li>Go to <strong>SQL Server Services</strong> &rarr; Right-click <strong>SQL Server (IDEALSQL)</strong> &rarr; Click <strong>Restart</strong>.</li>
                </ul>
              </div>

              <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                <p className="font-bold text-red-900 flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  Final Step Required on Store PC: Enable Mixed Mode
                </p>
                <p className="text-xs text-red-800 leading-relaxed pl-5.5">
                  SQL Server is currently set to <strong>Windows-Only Authentication</strong>. To allow logging in with <code className="bg-red-100 text-red-950 px-1 py-0.5 rounded font-mono font-bold">kwikorder</code>, run this command in <strong>PowerShell (as Administrator)</strong> on the store PC (<code className="bg-red-100 text-red-950 px-1 py-0.5 rounded font-mono">DESKTOP-ABEN9NK</code>):
                </p>
                <div className="mt-1 ml-5.5 p-2.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto select-all border border-slate-700">
                  Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL15.IDEALSQL\MSSQLServer' -Name 'LoginMode' -Value 2; Restart-Service -Name 'MSSQL$IDEALSQL' -Force
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={testConnection} className="space-y-6">
            {/* Auth Mode Toggle */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Authentication Method
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAuthType('sql')}
                  className={`px-4 py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    authType === 'sql'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <Key className="w-4 h-4" />
                  SQL Server Authentication (Recommended)
                </button>
                <button
                  type="button"
                  onClick={() => setAuthType('windows')}
                  className={`px-4 py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    authType === 'windows'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  Windows Authentication (Local LAN)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-400" />
                  SQL Server Host / Tunnel Domain
                </label>
                <input
                  type="text"
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  placeholder="mssql.kwikstop.com.au"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-slate-400" />
                  Database Name
                </label>
                <input
                  type="text"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  placeholder="IPSTransaction"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  required
                />
              </div>

              {authType === 'windows' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-slate-400" />
                    PC / Workgroup Domain Name
                  </label>
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="DESKTOP-ABEN9NK"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  {authType === 'windows' ? 'Windows Username' : 'SQL Login User'}
                </label>
                <input
                  type="text"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder={authType === 'windows' ? 'Windows user on store PC' : 'sa or kwikorder'}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center gap-4">
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
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
            <div
              className={`p-4 rounded-xl flex items-start gap-3 ${
                result.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {result.success ? (
                <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <p className="font-bold text-sm">
                  {result.success ? 'Connection Successful' : 'Connection Failed'}
                </p>
                <p className="text-xs mt-1 opacity-90">{result.message}</p>
              </div>
            </div>
          )}

          {/* Live Database Mode & Test Data Management */}
          <div className="pt-6 border-t border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                Live IdealPOS Database Mode & Test Data Management
              </h3>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                forceLiveMode
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${forceLiveMode ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {forceLiveMode ? 'Live IdealPOS SQL Only' : 'Demo Mode Fallback Enabled'}
              </span>
            </div>

            {/* In-app Action Feedback Notice */}
            {actionNotice && (
              <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                actionNotice.success
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                <div className="flex items-center gap-2">
                  {actionNotice.success ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  )}
                  <span className="font-semibold">{actionNotice.message}</span>
                </div>
                <button
                  onClick={() => setActionNotice(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Force Live Database Mode (Disable Demo / Test Data Fallback)
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    When enabled, the app queries exclusively from your live <code className="bg-slate-200 text-slate-800 px-1 rounded">IPSTransaction</code> SQL database and disables mock/simulated items.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const nextMode = !forceLiveMode;
                    try {
                      const res = await fetch('/api/settings/live-mode', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ forceLiveMode: nextMode })
                      });
                      const data = await res.json();
                      if (data.success) {
                        setForceLiveMode(nextMode);
                        setActionNotice({
                          success: true,
                          message: nextMode
                            ? 'Live IdealPOS Database Mode Enabled! The app will query exclusively from your live SQL Server instance.'
                            : 'Demo Fallback Mode Enabled.'
                        });
                        onStatusUpdate();
                        void refreshConnectionAndSuppliers();
                      }
                    } catch (e) {
                      setActionNotice({ success: false, message: 'Failed to update live mode setting.' });
                    }
                  }}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs flex-shrink-0 ${
                    forceLiveMode
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-800 hover:bg-slate-900 text-white'
                  }`}
                >
                  {forceLiveMode ? '✓ Live Mode Active' : 'Enable Live Database Only'}
                </button>
              </div>

              <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Clear Sample / Test Supplier Data
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Remove sample test supplier schedules (e.g. Bega, Tip Top) so you can configure your own IdealPOS suppliers from scratch.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowClearConfirmModal(true)}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-lg text-xs font-bold transition-colors flex-shrink-0"
                >
                  Clear Sample Test Data
                </button>
              </div>
            </div>
          </div>

          {/* Modal for Clear Test Data Confirmation */}
          {showClearConfirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-xl space-y-4 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Clear Sample Test Data</h3>
                    <p className="text-xs text-slate-500">Reset sample supplier configurations</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to clear all sample test supplier configurations (e.g. sample Bega/Tip Top schedules)? You will be able to configure your live IdealPOS suppliers from scratch.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowClearConfirmModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setShowClearConfirmModal(false);
                      try {
                        const res = await fetch('/api/settings/clear-test-data', { method: 'POST' });
                        const data = await res.json();
                        if (data.success) {
                          setConfigs({});
                          setDrafts([]);
                          setActionNotice({
                            success: true,
                            message: 'Sample test supplier data cleared successfully! You can now add your live IdealPOS suppliers.'
                          });
                          onStatusUpdate();
                          void refreshConnectionAndSuppliers();
                        } else {
                          setActionNotice({ success: false, message: data.message || 'Failed to clear test data.' });
                        }
                      } catch (e) {
                        setActionNotice({ success: false, message: 'Failed to clear test data.' });
                      }
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                  >
                    Yes, Clear Test Data
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cloudflare Tunnel Status Card inside Server Settings */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-600" />
              Cloudflare Tunnel Connector (cloudflared)
            </h3>
            <CloudflaredTunnelCard />
          </div>
        </div>
      )}

      {/* Sub Tab: Cloudflare Tunnel */}
      {activeSubTab === 'cloudflared' && (
        <div className="space-y-6">
          <CloudflaredTunnelCard />

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-600" />
              Cloudflare Tunnel Configuration Info
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              The <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">cloudflared</code> daemon creates an encrypted outbound QUIC tunnel connection from <span className="font-bold text-slate-800">IdealPOS-Store-4812</span> to the Cloudflare Edge network without opening inbound firewall ports.
            </p>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 space-y-2">
              <div>Store ID: <span className="font-bold text-slate-900">IdealPOS-Store-4812</span></div>
              <div>Connector Daemon: <span className="font-bold text-slate-900">cloudflared v2026.3.0</span></div>
              <div>Local Ingress Rule: <span className="font-bold text-slate-900">tcp://localhost:1433 → IDEALSQL</span></div>
              <div>Remote Hostname: <span className="font-bold text-blue-600">store4812.idealpos-connect.com</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Sub Tab 2: Supplier Config */}
      {activeSubTab === 'suppliers' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">Supplier Delivery & Lead Time Schedules</h2>
          </div>

          {!connected ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">
              Demo mode or SQL disconnected. Switch back to Server Settings above to connect.
            </p>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Add Supplier</label>
                  <select
                    value={addSupplierId}
                    onChange={(e) => setAddSupplierId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none bg-white"
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
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>

              {drafts.length === 0 && (
                <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
                  No suppliers configured yet. Select one above.
                </p>
              )}

              <div className="space-y-4">
                {drafts.map((draft) => (
                  <div
                    key={draft.supplierId}
                    className="border border-slate-200 rounded-xl p-4 space-y-4 bg-slate-50/50"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">
                          {supplierName(draft.supplierId)}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {draft.schedules.length} schedule{draft.schedules.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-slate-600 flex items-center gap-2">
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
                            className="w-20 px-2 py-1 border border-slate-300 rounded-md bg-white text-xs font-bold"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void removeSupplierDraft(draft.supplierId)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
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
                          className="bg-white border border-slate-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_auto] gap-3 items-end"
                        >
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-500">
                              Cut-off day
                            </label>
                            <select
                              value={schedule.cutOffDay}
                              onChange={(e) =>
                                updateSchedule(draft.supplierId, index, {
                                  cutOffDay: e.target.value,
                                })
                              }
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                            >
                              {WEEKDAYS.map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-500">Time</label>
                            <input
                              type="time"
                              value={schedule.cutOffTime}
                              onChange={(e) =>
                                updateSchedule(draft.supplierId, index, {
                                  cutOffTime: e.target.value,
                                })
                              }
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-500">
                              Delivery day
                            </label>
                            <select
                              value={schedule.deliveryDay}
                              onChange={(e) =>
                                updateSchedule(draft.supplierId, index, {
                                  deliveryDay: e.target.value,
                                })
                              }
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                            >
                              {WEEKDAYS.map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeSchedule(draft.supplierId, index)}
                            disabled={draft.schedules.length <= 1}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed self-end"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => addSchedule(draft.supplierId)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add schedule option
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => void saveAllConfigs()}
                  disabled={configSaving || drafts.length === 0}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  {configSaving ? 'Saving…' : 'Save Supplier Configurations'}
                </button>
              </div>

              {configMessage && (
                <div
                  className={`p-3 rounded-lg text-xs border font-medium ${
                    configMessage.success
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                >
                  {configMessage.text}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sub Tab 3: App Theme Selector */}
      {activeSubTab === 'appearance' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center gap-3">
            <Palette className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Application Color Theme</h2>
              <p className="text-xs text-slate-500">
                Choose a visual theme tailored for your POS store interface
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {themeOptions.map((opt) => {
              const isSelected = theme === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => setTheme(opt.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/40 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      {opt.name}
                      {isSelected && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                          <Check className="w-3 h-3 mr-0.5" /> Active
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Preview Palette Bar */}
                  <div className="flex items-center gap-2 h-8 rounded-lg overflow-hidden border border-slate-200 p-1 bg-slate-100">
                    <div className={`h-full flex-1 rounded ${opt.previewBg}`} />
                    <div className={`h-full w-12 rounded ${opt.previewAccent}`} />
                  </div>

                  <p className="text-xs text-slate-500 mt-2.5">{opt.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Sub Tab 4: Security & PIN Lock */}
      {activeSubTab === 'security' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Security PIN & Passcode Lock</h2>
                <p className="text-xs text-slate-500">
                  Protect your POS dashboard and inventory when accessed via Cloudflare Tunnel or public links
                </p>
              </div>
            </div>

            {onLockApp && (
              <button
                type="button"
                onClick={onLockApp}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 shadow-sm"
              >
                <Lock className="w-4 h-4 text-blue-400" />
                Lock App Now
              </button>
            )}
          </div>

          {/* Quick Security Status Badge */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${pinEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  PIN Protection: {pinEnabled ? 'ENABLED' : 'DISABLED'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {pinEnabled
                    ? 'Anyone opening this app will be required to enter the passcode.'
                    : 'The app is currently open without PIN lock.'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleTogglePinEnabled(!pinEnabled)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                pinEnabled
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
              }`}
            >
              {pinEnabled ? 'Disable Lock' : 'Enable Lock'}
            </button>
          </div>

          {/* Change PIN Form */}
          <form onSubmit={handleSavePin} className="space-y-4 pt-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-blue-600" />
              Set or Change Security Passcode
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Current Passcode (Default: 4812)
                </label>
                <input
                  type="password"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                  placeholder="Enter current PIN"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Passcode (4+ Digits)
                </label>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="e.g. 1234"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirm New Passcode
                </label>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="Re-enter new PIN"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Update Passcode PIN
              </button>
            </div>
          </form>

          {/* Auto Lock Timer Option */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Inactivity Auto-Lock Settings
            </h3>
            <div className="flex items-center gap-4">
              <label className="text-xs text-slate-600 font-medium">
                Auto-lock when idle for:
              </label>
              <select
                value={autoLockTimeout}
                onChange={(e) => handleTimeoutChange(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="0">Immediately on Refresh / Launch</option>
                <option value="5">5 Minutes</option>
                <option value="15">15 Minutes</option>
                <option value="30">30 Minutes</option>
                <option value="never">Never (Manual Lock Only)</option>
              </select>
            </div>
          </div>

          {/* Feedback Message */}
          {pinMessage && (
            <div
              className={`p-3 rounded-xl text-xs border font-bold flex items-center gap-2 ${
                pinMessage.success
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {pinMessage.success ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              )}
              {pinMessage.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function configToDraft(supplierId: string, config: SupplierConfig): DraftEntry {
  return {
    supplierId,
    safetyBufferPct: Math.round(((config.safetyMultiplier || 1.2) - 1) * 100),
    schedules: config.schedules?.length
      ? config.schedules.map((s) => ({ ...s }))
      : [defaultSchedule()],
  };
}

function configsToDrafts(configs: SupplierConfigMap): DraftEntry[] {
  return Object.entries(configs).map(([supplierId, config]) => configToDraft(supplierId, config));
}
