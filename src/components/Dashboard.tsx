import React from 'react';
import { Database, Server, Activity, Users, FileText, FileDown } from 'lucide-react';
import { ConnectionStatus, DashboardStats } from '../types';

interface DashboardProps {
  status: ConnectionStatus | null;
  stats: DashboardStats | null;
}

export default function Dashboard({ status, stats }: DashboardProps) {
  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full ${status?.connected ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Server Status</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${status?.connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {status?.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
        
        {status?.connected && (
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 bg-gray-50 px-6 py-3 rounded-lg border border-gray-100">
            <div>
              <span className="block text-xs text-gray-500 font-medium mb-1">Server</span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <Server className="w-4 h-4 text-gray-400" /> {status.server}
              </span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 font-medium mb-1">Database</span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <Database className="w-4 h-4 text-gray-400" /> {status.database}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      {status?.connected ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Tables" 
            value={stats?.tables ?? '-'} 
            icon={<Database className="w-6 h-6 text-blue-600" />} 
            color="bg-blue-50 border-blue-100" 
          />
          <StatCard 
            title="Products" 
            value={stats?.products?.toLocaleString() ?? '-'} 
            icon={<FileText className="w-6 h-6 text-purple-600" />} 
            color="bg-purple-50 border-purple-100" 
          />
          <StatCard 
            title="Sales" 
            value={stats?.sales?.toLocaleString() ?? '-'} 
            icon={<FileDown className="w-6 h-6 text-green-600" />} 
            color="bg-green-50 border-green-100" 
          />
          <StatCard 
            title="Suppliers" 
            value={stats?.suppliers?.toLocaleString() ?? '-'} 
            icon={<Users className="w-6 h-6 text-orange-600" />} 
            color="bg-orange-50 border-orange-100" 
          />
        </div>
      ) : (
        <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-100 text-center">
          <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Waiting for Connection</h3>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">Go to the Server Settings tab to connect to the IdealPOS SQL instance (<span className="font-mono text-sm">IPSTransaction</span>).</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: string | number, icon: React.ReactNode, color: string }) {
  return (
    <div className={`p-6 rounded-xl border ${color} bg-white shadow-sm flex items-center justify-between`}>
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
      </div>
      <div className={`p-3 rounded-full ${color.replace('border-', 'bg-').replace('50', '100')} border-none`}>
        {icon}
      </div>
    </div>
  );
}
