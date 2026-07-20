import React, { useState } from 'react';
import { Database, Server, User, Key, CheckCircle, XCircle } from 'lucide-react';

export default function Settings({ onStatusUpdate }: { onStatusUpdate: () => void }) {
  const [server, setServer] = useState('localhost');
  const [database, setDatabase] = useState('IdealPOS');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

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
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Failed to connect' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
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
                placeholder="localhost or IP"
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
                placeholder="IdealPOS"
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
                placeholder="sa (leave blank for Windows Auth)"
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
              {!result.success && !user && (
                <p className="text-sm mt-2 text-red-700">Note: If you are using Windows Authentication, ensure your local Node.js environment is configured for it, or provide a SQL username and password.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
