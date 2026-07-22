import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Terminal,
  RefreshCw,
  Play,
  Square,
  RotateCw,
  Copy,
  Download,
  Check,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Activity,
  ShieldAlert,
  Server,
  Radio,
  WifiOff,
  Clock
} from 'lucide-react';

export interface CloudflaredLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  component: string;
  message: string;
}

export interface CloudflaredStatus {
  storeId: string;
  service: string;
  status: 'Active' | 'Inactive' | 'Connecting' | 'Error';
  tunnelId: string;
  edgeLocation?: string;
  uptime?: string;
  latencyMs?: number;
  lastHeartbeat?: string;
  errorReason?: string;
}

interface CloudflaredLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStatus?: CloudflaredStatus;
  onStatusChange?: (newStatus: CloudflaredStatus) => void;
}

export const CloudflaredLogsModal: React.FC<CloudflaredLogsModalProps> = ({
  isOpen,
  onClose,
  initialStatus,
  onStatusChange
}) => {
  const [status, setStatus] = useState<CloudflaredStatus>(initialStatus || {
    storeId: 'IdealPOS-Store-4812',
    service: 'cloudflared',
    status: 'Inactive',
    tunnelId: 'd8f4812a-4812-4cf1-9872-cloudflared',
    errorReason: 'Tunnel connector daemon stopped. Dial connection to local SQL instance timed out.'
  });

  const [logs, setLogs] = useState<CloudflaredLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Fetch tunnel status and logs from server
  const fetchTunnelData = async () => {
    setLoadingLogs(true);
    try {
      const [statusRes, logsRes] = await Promise.all([
        fetch('/api/cloudflared/status'),
        fetch('/api/cloudflared/logs')
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
        if (onStatusChange) onStatusChange(statusData);
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch cloudflared logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTunnelData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    setActionInProgress(true);
    try {
      const res = await fetch('/api/cloudflared/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.status) {
        setStatus(data.status);
        if (onStatusChange) onStatusChange(data.status);
      }
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleCopyLogs = () => {
    const logText = logs
      .map(l => `[${l.timestamp}] [${l.level}] [${l.component}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(logText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLogs = () => {
    const logText = logs
      .map(l => `[${l.timestamp}] [${l.level}] [${l.component}] ${l.message}`)
      .join('\n');
    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cloudflared-IdealPOS-Store-4812-${Date.now()}.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const filteredLogs = logs.filter(log => {
    const matchesLevel = filterLevel === 'ALL' || log.level === filterLevel;
    const matchesSearch = searchQuery === '' || 
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.component.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 text-slate-100 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col border border-slate-800 shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Cloudflare Tunnel Log Diagnostics
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  IdealPOS-Store-4812
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                daemon: cloudflared • tunnel: {status.tunnelId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tunnel Status Pill */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${
              status.status === 'Active' 
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40' 
                : status.status === 'Connecting'
                ? 'bg-amber-950/80 text-amber-400 border-amber-500/40 animate-pulse'
                : 'bg-rose-950/80 text-rose-400 border-rose-500/40'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                status.status === 'Active' 
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' 
                  : status.status === 'Connecting'
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
              }`} />
              <span>{status.status}</span>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tunnel Status Action Banner */}
        <div className="px-6 py-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-blue-400" />
              Ingress Target: <span className="text-slate-100 font-semibold">localhost\IDEALSQL:1433</span>
            </span>
            {status.status === 'Active' && (
              <>
                <span className="flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-emerald-400" />
                  Edge Location: <span className="text-emerald-300">{status.edgeLocation || 'MEL01 (Melbourne)'}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  Latency: <span className="text-amber-300">{status.latencyMs || 24}ms</span>
                </span>
              </>
            )}
            {status.status === 'Inactive' && (
              <span className="flex items-center gap-1.5 text-rose-400 font-sans">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Service Inactive — Remote queries fallback to Demo Mode</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {status.status === 'Inactive' || status.status === 'Error' ? (
              <button
                onClick={() => handleAction('start')}
                disabled={actionInProgress}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {actionInProgress ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Start Tunnel
              </button>
            ) : (
              <button
                onClick={() => handleAction('stop')}
                disabled={actionInProgress}
                className="px-3.5 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionInProgress ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                Stop Tunnel
              </button>
            )}

            <button
              onClick={() => handleAction('restart')}
              disabled={actionInProgress}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${actionInProgress ? 'animate-spin text-blue-400' : ''}`} />
              Restart Daemon
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="px-6 py-2.5 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter logs (e.g., error, tunnel, connection)..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              {['ALL', 'INFO', 'WARN', 'ERROR'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setFilterLevel(lvl)}
                  className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition-colors ${
                    filterLevel === lvl
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchTunnelData}
              disabled={loadingLogs}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
              title="Refresh Logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin text-blue-400' : ''}`} />
            </button>

            <button
              onClick={handleCopyLogs}
              className="px-2.5 py-1.5 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors flex items-center gap-1.5 font-mono text-xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>

            <button
              onClick={handleDownloadLogs}
              className="px-2.5 py-1.5 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors flex items-center gap-1.5 font-mono text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>

            <label className="flex items-center gap-1.5 text-slate-400 text-xs cursor-pointer ml-2">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0"
              />
              Auto-scroll
            </label>
          </div>
        </div>

        {/* Terminal Log Console View */}
        <div className="flex-1 bg-slate-950 p-4 font-mono text-xs overflow-y-auto space-y-1 select-text">
          {filteredLogs.length === 0 ? (
            <div className="text-slate-600 py-12 text-center">
              No logs matched your filter criteria.
            </div>
          ) : (
            filteredLogs.map((log) => {
              let levelColor = 'text-blue-400';
              if (log.level === 'WARN') levelColor = 'text-amber-400';
              if (log.level === 'ERROR') levelColor = 'text-rose-400 font-bold';
              if (log.level === 'DEBUG') levelColor = 'text-slate-500';

              return (
                <div
                  key={log.id}
                  className="hover:bg-slate-900/60 py-0.5 px-2 rounded flex items-start gap-3 leading-relaxed transition-colors"
                >
                  <span className="text-slate-500 select-none text-[11px] min-w-[140px]">
                    {log.timestamp}
                  </span>
                  <span className={`min-w-[55px] uppercase font-bold text-[10px] px-1 py-0.2 rounded ${levelColor}`}>
                    {log.level}
                  </span>
                  <span className="text-slate-400 min-w-[120px] text-[11px]">
                    [{log.component}]
                  </span>
                  <span className={`flex-1 break-all ${log.level === 'ERROR' ? 'text-rose-300' : 'text-slate-200'}`}>
                    {log.message}
                  </span>
                </div>
              );
            })
          )}
          <div ref={logsEndRef} />
        </div>

        {/* Terminal Footer */}
        <div className="px-6 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
          <span>Showing {filteredLogs.length} of {logs.length} log entries</span>
          <span>Cloudflare Tunnel Client v2026.3.0 • Store ID: IdealPOS-Store-4812</span>
        </div>

      </div>
    </div>
  );
};
