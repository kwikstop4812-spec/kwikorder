import { useState, useEffect } from 'react';
import { Database, Server, LayoutDashboard, Settings as SettingsIcon } from 'lucide-react';
import Dashboard from './components/Dashboard';
import DatabaseExplorer from './components/DatabaseExplorer';
import Settings from './components/Settings';
import { ConnectionStatus, DashboardStats } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'explorer' | 'settings'>('dashboard');
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setStatus(data);
      if (data.connected) {
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      if (!data.error) {
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Database className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">KwikOrder <span className="text-blue-600">Analytics</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
              <div className={`w-2 h-2 rounded-full ${status?.connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`} />
              <span className="font-medium text-gray-600">{status?.connected ? 'Connected to SQL Server' : 'Disconnected'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Navigation */}
        <nav className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'dashboard' 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <LayoutDashboard className={`w-5 h-5 ${activeTab === 'dashboard' ? 'text-blue-600' : 'text-gray-400'}`} />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('explorer')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'explorer' 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Database className={`w-5 h-5 ${activeTab === 'explorer' ? 'text-blue-600' : 'text-gray-400'}`} />
              Database Explorer
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'settings' 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <SettingsIcon className={`w-5 h-5 ${activeTab === 'settings' ? 'text-blue-600' : 'text-gray-400'}`} />
              Server Settings
            </button>
          </div>
          
          <div className="mt-6 px-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Development Stage</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center border border-green-200 text-[10px] font-bold">1</div>
                Database Connection
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center border border-green-200 text-[10px] font-bold">2</div>
                Database Explorer
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 text-[10px] font-bold">3</div>
                Schema Discovery
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 text-[10px] font-bold">4</div>
                Ordering Engine
              </div>
            </div>
          </div>
        </nav>

        {/* Tab Content */}
        <main className="flex-1 min-w-0">
          {activeTab === 'dashboard' && <Dashboard status={status} stats={stats} />}
          {activeTab === 'explorer' && <DatabaseExplorer activeDatabase={status?.database || null} />}
          {activeTab === 'settings' && <Settings onStatusUpdate={fetchStatus} />}
        </main>

      </div>
    </div>
  );
}
