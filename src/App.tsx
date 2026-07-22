import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  FileSpreadsheet,
  Database,
  Settings as SettingsIcon,
  Store,
  Menu,
  X,
  Activity,
  Lock,
  Terminal,
} from 'lucide-react';
import { POSDashboard } from './components/POSDashboard';
import { InventoryManager } from './components/InventoryManager';
import { ReportsManager } from './components/ReportsManager';
import OrderEngine from './components/OrderEngine';
import DatabaseExplorer from './components/DatabaseExplorer';
import Settings from './components/Settings';
import { PinLockModal } from './components/PinLockModal';
import { CloudflaredLogsModal, CloudflaredStatus } from './components/CloudflaredLogsModal';
import { ConnectionStatus } from './types';
import { ThemeProvider, useAppTheme } from './ThemeContext';

function AppContent() {
  const { getThemeClasses } = useAppTheme();
  const theme = getThemeClasses();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'orders' | 'reports' | 'explorer' | 'settings'>('dashboard');
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCloudflaredLogsOpen, setIsCloudflaredLogsOpen] = useState(false);
  const [cfStatus, setCfStatus] = useState<CloudflaredStatus>({
    storeId: 'IdealPOS-Store-4812',
    service: 'cloudflared',
    status: 'Inactive',
    tunnelId: 'd8f4812a-4812-4cf1-9872-cloudflared'
  });

  const fetchCloudflaredStatus = async () => {
    try {
      const res = await fetch('/api/cloudflared/status');
      if (res.ok) {
        const data = await res.json();
        setCfStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch cloudflared status:', err);
    }
  };

  useEffect(() => {
    fetchCloudflaredStatus();
    const interval = setInterval(fetchCloudflaredStatus, 20000);
    return () => clearInterval(interval);
  }, []);

  // Security PIN Lock State
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    const pinEnabled = localStorage.getItem('idealpos_pin_enabled');
    return pinEnabled !== 'false';
  });

  const [pin, setPin] = useState<string>(() => {
    return localStorage.getItem('idealpos_security_pin') || '4812';
  });

  const lastActivityRef = useRef<number>(Date.now());

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Inactivity Auto-Lock Effect
  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('click', handleActivity);

    const checkInactivity = setInterval(() => {
      const enabled = localStorage.getItem('idealpos_pin_enabled') !== 'false';
      const timeoutSetting = localStorage.getItem('idealpos_pin_timeout') || '15';

      if (!enabled || timeoutSetting === 'never' || timeoutSetting === '0') return;

      const maxIdleMs = parseInt(timeoutSetting, 10) * 60 * 1000;
      if (Date.now() - lastActivityRef.current > maxIdleMs) {
        setIsLocked(true);
      }
    }, 10000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('click', handleActivity);
      clearInterval(checkInactivity);
    };
  }, []);

  const handleUnlock = () => {
    setIsLocked(false);
    lastActivityRef.current = Date.now();
  };

  const currentPin = localStorage.getItem('idealpos_security_pin') || '4812';

  const handleTabClick = (tab: 'dashboard' | 'inventory' | 'orders' | 'reports' | 'explorer' | 'settings') => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className={`min-h-screen ${theme.bgApp} font-sans transition-colors duration-300 selection:bg-blue-200 selection:text-blue-900 flex flex-col`}>
      {/* PIN Lock Overlay */}
      {isLocked && (
        <PinLockModal
          storedPin={currentPin}
          onUnlock={handleUnlock}
          storeName="Store #4812"
        />
      )}

      {/* Top Header */}
      <header className={`${theme.bgHeader} sticky top-0 z-40 shadow-sm transition-colors duration-300`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Burger Menu Button (Visible on mobile & tablet) */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-white hover:bg-white/10 transition-colors focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-md flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                IdealPOS <span className="text-blue-400 font-extrabold">Suite</span>
              </h1>
              <p className="text-[11px] text-slate-300 font-mono">Store #4812 • POS Management</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Cloudflare Tunnel cloudflared Button */}
            <button
              onClick={() => setIsCloudflaredLogsOpen(true)}
              className={`flex items-center gap-2 text-xs text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full border border-white/10 shadow-xs transition-colors focus:outline-none`}
              title="View Cloudflare Tunnel Logs for IdealPOS-Store-4812"
            >
              <Terminal className="w-3.5 h-3.5 text-blue-300" />
              <span className="font-mono text-[11px] font-semibold hidden md:inline">
                cloudflared
              </span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                cfStatus.status === 'Active'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {cfStatus.status}
              </span>
            </button>

            {/* Lock Button */}
            <button
              onClick={() => setIsLocked(true)}
              className="flex items-center gap-1.5 text-xs text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full border border-white/10 shadow-xs transition-colors focus:outline-none"
              title="Lock App with Security PIN"
            >
              <Lock className="w-3.5 h-3.5 text-blue-300" />
              <span className="font-semibold hidden sm:inline">Lock Screen</span>
            </button>

            {/* Status Pill */}
            <div className="flex items-center gap-2 text-xs text-white bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  status?.connected
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse'
                    : 'bg-amber-400'
                }`}
              />
              <span className="font-semibold tracking-wide hidden sm:inline">
                {status?.connected ? 'SQL Server Connected' : 'Demo Mode Active'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex flex-col md:flex-row gap-8 relative">
        {/* Backdrop for Mobile Drawer */}
        {isMobileMenuOpen && (
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
          />
        )}

        {/* Sliding Navigation Panel (Drawer on Mobile / Sidebar on Desktop) */}
        <aside
          onMouseLeave={() => {
            if (isMobileMenuOpen) setIsMobileMenuOpen(false);
          }}
          className={`
            fixed top-0 left-0 bottom-0 z-50 w-72 bg-white p-4 flex flex-col justify-between shadow-2xl transition-transform duration-300 ease-in-out
            md:static md:z-auto md:w-64 md:flex-shrink-0 md:p-0 md:bg-transparent md:shadow-none md:translate-x-0
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          <div className="space-y-4">
            {/* Mobile Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 md:hidden">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-600" />
                <span className="font-bold text-slate-900 text-sm">Navigation Menu</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs List */}
            <div className={`${theme.bgSidebar} rounded-2xl shadow-sm p-3 space-y-1.5 transition-colors duration-300`}>
              {/* 1. POS Dashboard */}
              <button
                onClick={() => handleTabClick('dashboard')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all ${
                  activeTab === 'dashboard'
                    ? `${theme.primaryBtn} shadow-md`
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                POS Dashboard
              </button>

              {/* 2. Inventory */}
              <button
                onClick={() => handleTabClick('inventory')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all ${
                  activeTab === 'inventory'
                    ? `${theme.primaryBtn} shadow-md`
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Package className="w-5 h-5" />
                Inventory & Items
              </button>

              {/* 3. Draft Orders */}
              <button
                onClick={() => handleTabClick('orders')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all ${
                  activeTab === 'orders'
                    ? `${theme.primaryBtn} shadow-md`
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <ClipboardList className="w-5 h-5" />
                Draft Orders
              </button>

              {/* 4. Reporting */}
              <button
                onClick={() => handleTabClick('reports')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all ${
                  activeTab === 'reports'
                    ? `${theme.primaryBtn} shadow-md`
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-5 h-5" />
                POS Reports
              </button>

              {/* 5. Database Explorer */}
              <button
                onClick={() => handleTabClick('explorer')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all ${
                  activeTab === 'explorer'
                    ? `${theme.primaryBtn} shadow-md`
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Database className="w-5 h-5" />
                Database Explorer
              </button>

              {/* 6. Settings */}
              <button
                onClick={() => handleTabClick('settings')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all ${
                  activeTab === 'settings'
                    ? `${theme.primaryBtn} shadow-md`
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <SettingsIcon className="w-5 h-5" />
                Settings
              </button>
            </div>
          </div>

          {/* Quick System Badge - PLACED AT THE VERY BOTTOM OF THE NAV PANEL */}
          <div className="mt-auto pt-4">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm text-xs text-slate-500 space-y-2">
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-blue-600" />
                  System Status
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <p className="font-semibold text-slate-700">IdealPOS v10.4 Schema Compatible</p>
              <p className="font-mono text-[11px] text-slate-500 bg-slate-200/60 px-2 py-1 rounded">
                Host: {status?.connected ? status?.server : 'DEMO_MODE (Simulated IdealPOS SQL)'}
              </p>
            </div>
          </div>
        </aside>

        {/* Tab Main View Content */}
        <main className="flex-1 min-w-0">
          {activeTab === 'dashboard' && <POSDashboard />}
          {activeTab === 'inventory' && <InventoryManager />}
          {activeTab === 'orders' && <OrderEngine connected={Boolean(status?.connected)} />}
          {activeTab === 'reports' && <ReportsManager />}
          {activeTab === 'explorer' && <DatabaseExplorer activeDatabase={status?.database || null} />}
          {activeTab === 'settings' && <Settings onStatusUpdate={fetchStatus} onLockApp={() => setIsLocked(true)} />}
        </main>

        {/* Cloudflare Tunnel Logs Modal */}
        <CloudflaredLogsModal
          isOpen={isCloudflaredLogsOpen}
          onClose={() => setIsCloudflaredLogsOpen(false)}
          initialStatus={cfStatus}
          onStatusChange={setCfStatus}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

