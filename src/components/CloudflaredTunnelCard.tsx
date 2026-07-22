import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Activity,
  Wifi,
  WifiOff,
  RotateCw,
  Play,
  Square,
  ChevronRight,
  ShieldAlert,
  Server
} from 'lucide-react';
import { CloudflaredLogsModal, CloudflaredStatus } from './CloudflaredLogsModal';

interface CloudflaredTunnelCardProps {
  className?: string;
  compact?: boolean;
}

export const CloudflaredTunnelCard: React.FC<CloudflaredTunnelCardProps> = ({
  className = '',
  compact = false
}) => {
  const [status, setStatus] = useState<CloudflaredStatus>({
    storeId: 'IdealPOS-Store-4812',
    service: 'cloudflared',
    status: 'Inactive',
    tunnelId: 'd8f4812a-4812-4cf1-9872-cloudflared',
    errorReason: 'Tunnel connector daemon stopped. Dial connection to local SQL instance timed out.'
  });

  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/cloudflared/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch cloudflared status:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleStatus = async () => {
    setLoading(true);
    const nextAction = status.status === 'Active' ? 'stop' : 'start';
    try {
      const res = await fetch('/api/cloudflared/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: nextAction })
      });
      const data = await res.json();
      if (data.status) setStatus(data.status);
    } catch (err) {
      console.error('Failed to toggle tunnel:', err);
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <>
        <div className={`bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex items-center justify-between gap-3 ${className}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 rounded-lg flex-shrink-0 ${
              status.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
            }`}>
              <Terminal className="w-4 h-4" />
            </div>
            <div className="truncate">
              <span className="font-bold text-xs text-slate-900 block truncate">
                IdealPOS-Store-4812
              </span>
              <span className="text-[11px] text-slate-500 font-mono block">
                cloudflared
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              status.status === 'Active'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : status.status === 'Connecting'
                ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              {status.status}
            </span>

            <button
              onClick={() => setIsLogsModalOpen(true)}
              className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              View logs
            </button>
          </div>
        </div>

        <CloudflaredLogsModal
          isOpen={isLogsModalOpen}
          onClose={() => setIsLogsModalOpen(false)}
          initialStatus={status}
          onStatusChange={setStatus}
        />
      </>
    );
  }

  return (
    <>
      <div className={`bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 ${className}`}>
        {/* Header line */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl border ${
              status.status === 'Active'
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">
                IdealPOS-Store-4812
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1.5">
                <span>cloudflared daemon</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-400">Tunnel #{status.tunnelId.slice(0, 8)}</span>
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              status.status === 'Active'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : status.status === 'Connecting'
                ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                status.status === 'Active'
                  ? 'bg-emerald-500 animate-pulse'
                  : status.status === 'Connecting'
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`} />
              {status.status}
            </span>
          </div>
        </div>

        {/* Details & Info */}
        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200 text-xs space-y-2">
          <div className="flex items-center justify-between text-slate-600 font-mono">
            <span>Target SQL Instance:</span>
            <span className="font-bold text-slate-800">localhost\IDEALSQL:1433</span>
          </div>
          {status.status === 'Active' && (
            <div className="flex items-center justify-between text-slate-600 font-mono">
              <span>Cloudflare Edge:</span>
              <span className="font-bold text-emerald-600">{status.edgeLocation || 'MEL01 (Melbourne)'}</span>
            </div>
          )}
          {status.status === 'Inactive' && (
            <div className="flex items-start gap-2 text-rose-700 pt-1 border-t border-slate-200/60 font-sans">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
              <span>{status.errorReason || 'Connector daemon inactive. Start tunnel to enable secure remote access.'}</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            onClick={() => setIsLogsModalOpen(true)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Terminal className="w-4 h-4 text-slate-600" />
            View logs
          </button>

          <button
            onClick={handleToggleStatus}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
              status.status === 'Active'
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {loading ? (
              <RotateCw className="w-4 h-4 animate-spin" />
            ) : status.status === 'Active' ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                Stop Tunnel
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Start Tunnel
              </>
            )}
          </button>
        </div>
      </div>

      <CloudflaredLogsModal
        isOpen={isLogsModalOpen}
        onClose={() => setIsLogsModalOpen(false)}
        initialStatus={status}
        onStatusChange={setStatus}
      />
    </>
  );
};
