'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, RotateCcw, Copy, Check, AlertTriangle, X,
  Server, Cpu, HardDrive, MemoryStick, Clock, Radio,
} from 'lucide-react';

interface SystemStatus {
  gateway: { name: string; status: string; uptime: string };
  gatewayProcess: { pid: number; rss_mb: number; platforms: Record<string, { state?: string; error_message?: string }> } | null;
  cpu: { percent: number } | null;
  ram: { used: number; total: number; percent: number };
  disk: { used: string; total: string; percent: number } | null;
  hermesDisk: string;
  dbSizeMb: number;
  loadAvg: string[];
  systemUptime: string;
  hostname: string;
  platform: string;
  logFiles: { name: string; size: string }[];
  timestamp: string;
}

function StatusDot({ status }: { status: string }) {
  if (status === 'active' || status === 'running' || status === 'connected') {
    return <span className="inline-block w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_#4ade80]" />;
  }
  if (status === 'unknown' || status === 'connecting') {
    return <span className="inline-block w-2 h-2 rounded-full bg-yellow-400" />;
  }
  return <span className="inline-block w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_#f87171]" />;
}

function StatusBadge({ status }: { status: string }) {
  const cls = (status === 'active' || status === 'running' || status === 'connected')
    ? 'bg-green-400/10 text-green-400 border-green-500/20'
    : status === 'unknown'
      ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      : 'bg-red-500/10 text-red-400 border-red-500/20';
  return <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border ${cls}`}>{status}</span>;
}

function UsageBar({ percent, color = 'indigo' }: { percent: number; color?: string }) {
  const barColor = percent > 85 ? 'bg-red-500' : percent > 65 ? 'bg-amber-400' : `bg-${color}-500`;
  return (
    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white/[0.04] border border-white/[0.08]/70 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-neutral-200">{message}</p>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-1.5 rounded-lg text-sm text-neutral-400 hover:text-white hover:bg-white/[0.1] transition-all">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-1.5 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-all">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SystemPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState('');
  const [logsSource, setLogsSource] = useState('journalctl');
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsTs, setLogsTs] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<{ message: string; action: () => void } | null>(null);
  const [restarting, setRestarting] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/system/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus(await res.json());
      setError('');
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, []);

  const fetchLogs = useCallback(async (source?: string) => {
    const src = source || logsSource;
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/system/logs?source=${src}&lines=50`);
      const data = await res.json();
      setLogs(data.logs || '');
      setLogsTs(new Date().toLocaleTimeString());
    } catch {
      setLogs('Failed to load logs');
    }
    setLogsLoading(false);
  }, [logsSource]);

  useEffect(() => {
    fetchStatus();
    fetchLogs();
    const statusIv = setInterval(fetchStatus, 10000);
    const logsIv = setInterval(fetchLogs, 30000);
    return () => { clearInterval(statusIv); clearInterval(logsIv); };
  }, [fetchStatus, fetchLogs]);

  const switchLogSource = (src: string) => {
    setLogsSource(src);
    fetchLogs(src);
  };

  const doRestart = async (service: string) => {
    setRestarting(service);
    try {
      await fetch('/api/system/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service }),
      });
      setTimeout(fetchStatus, 3000);
    } catch {}
    setTimeout(() => setRestarting(null), 2000);
  };

  const askRestart = (service: string, label: string) => {
    setConfirm({
      message: `Restart ${label}?`,
      action: () => { setConfirm(null); doRestart(service); },
    });
  };

  const copyLogs = () => {
    navigator.clipboard.writeText(logs).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-5xl mx-auto">
      {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.action} onCancel={() => setConfirm(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3"><Server size={20} className="text-purple-400" /><h1 className="text-xl font-bold text-white">System</h1></div>
          <p className="text-sm text-neutral-500 mt-0.5">
            {status ? `${status.hostname} · ${status.systemUptime} uptime` : 'Loading...'}
          </p>
        </div>
        <button
          onClick={fetchStatus}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-white hover:bg-white/[0.1] transition-all"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <button
          onClick={() => askRestart('gateway', 'Hermes Gateway')}
          disabled={restarting === 'gateway'}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-sm font-medium text-neutral-200 hover:bg-white/[0.1] hover:border-indigo-500/20 transition-all disabled:opacity-50"
        >
          <RotateCcw size={14} className={restarting === 'gateway' ? 'animate-spin' : ''} />
          Restart Gateway
        </button>
        <button
          onClick={() => {
            setConfirm({
              message: 'Restart Overwatch? The page will reload in a few seconds.',
              action: () => { setConfirm(null); doRestart('overwatch'); setTimeout(() => window.location.reload(), 4000); },
            });
          }}
          disabled={restarting === 'overwatch'}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-sm font-medium text-neutral-200 hover:bg-white/[0.1] hover:border-indigo-500/20 transition-all disabled:opacity-50"
        >
          <RotateCcw size={14} className={restarting === 'overwatch' ? 'animate-spin' : ''} />
          Restart Overwatch
        </button>
        <button
          onClick={fetchStatus}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-sm font-medium text-neutral-400 hover:bg-white/[0.1] transition-all"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-40 bg-white/[0.03] rounded-xl" />
          <div className="h-40 bg-white/[0.03] rounded-xl" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <AlertTriangle size={20} className="text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : status && (
        <>
          {/* Resource gauges */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {/* CPU */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Cpu size={14} className="text-purple-400" />
                <span className="text-[11px] font-medium text-neutral-500">CPU</span>
              </div>
              <p className="text-xl font-bold text-white mb-1">{status.cpu?.percent ?? '—'}%</p>
              {status.cpu && <UsageBar percent={status.cpu.percent} />}
              <p className="text-[10px] text-neutral-600 mt-1.5">Load: {status.loadAvg.join(', ')}</p>
            </div>

            {/* RAM */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-2">
                <MemoryStick size={14} className="text-purple-400" />
                <span className="text-[11px] font-medium text-neutral-500">Memory</span>
              </div>
              <p className="text-xl font-bold text-white mb-1">{status.ram.percent}%</p>
              <UsageBar percent={status.ram.percent} color="purple" />
              <p className="text-[10px] text-neutral-600 mt-1.5">
                {(status.ram.used / 1024).toFixed(1)} / {(status.ram.total / 1024).toFixed(0)} GB
              </p>
            </div>

            {/* Disk */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive size={14} className="text-blue-400" />
                <span className="text-[11px] font-medium text-neutral-500">Disk</span>
              </div>
              <p className="text-xl font-bold text-white mb-1">{status.disk?.percent ?? '—'}%</p>
              {status.disk && <UsageBar percent={status.disk.percent} color="blue" />}
              <p className="text-[10px] text-neutral-600 mt-1.5">
                {status.disk ? `${status.disk.used} / ${status.disk.total}` : '—'}
              </p>
            </div>

            {/* Uptime */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={14} className="text-green-400" />
                <span className="text-[11px] font-medium text-neutral-500">Uptime</span>
              </div>
              <p className="text-xl font-bold text-white mb-1">{status.systemUptime}</p>
              <p className="text-[10px] text-neutral-600 mt-1.5">{status.platform}</p>
            </div>
          </div>

          {/* Services */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] mb-5">
            <div className="px-5 py-3 border-b border-white/[0.06]">
              <h2 className="text-sm font-semibold text-white">Services</h2>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {/* Gateway service */}
              <div className="flex items-center gap-4 px-5 py-3">
                <StatusDot status={status.gateway.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">hermes-gateway</p>
                  <p className="text-[11px] text-neutral-600">
                    systemd · {status.gateway.uptime ? `up ${status.gateway.uptime}` : 'no uptime'}
                    {status.gatewayProcess && ` · PID ${status.gatewayProcess.pid} · ${status.gatewayProcess.rss_mb} MB`}
                  </p>
                </div>
                <StatusBadge status={status.gateway.status} />
                <button
                  onClick={() => askRestart('gateway', 'hermes-gateway')}
                  disabled={restarting === 'gateway'}
                  className="p-1.5 rounded-lg text-neutral-600 hover:text-amber-400 hover:bg-amber-400/[0.08] transition-all disabled:opacity-40"
                  title="Restart"
                >
                  <RotateCcw size={13} className={restarting === 'gateway' ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Platform connections */}
              {status.gatewayProcess?.platforms && Object.entries(status.gatewayProcess.platforms).map(([name, info]) => (
                <div key={name} className="flex items-center gap-4 px-5 py-3">
                  <StatusDot status={info.state || 'unknown'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{name}</p>
                    <p className="text-[11px] text-neutral-600">
                      platform adapter
                      {info.error_message && <span className="text-red-400/70"> · {info.error_message.slice(0, 80)}</span>}
                    </p>
                  </div>
                  <StatusBadge status={info.state || 'unknown'} />
                </div>
              ))}
            </div>
          </div>

          {/* Storage */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] mb-5">
            <div className="px-5 py-3 border-b border-white/[0.06]">
              <h2 className="text-sm font-semibold text-white">Storage</h2>
            </div>
            <div className="px-5 py-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-500">~/.hermes (data)</span>
                <span className="text-neutral-300 font-mono">{status.hermesDisk}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">state.db</span>
                <span className="text-neutral-300 font-mono">{status.dbSizeMb} MB</span>
              </div>
              {status.logFiles.map(f => (
                <div key={f.name} className="flex justify-between">
                  <span className="text-neutral-500">{f.name}</span>
                  <span className="text-neutral-300 font-mono">{f.size}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Logs */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Logs</h2>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Last 50 lines{logsTs && ` · ${logsTs}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Source switcher */}
                <div className="flex rounded-lg bg-white/[0.04] p-0.5">
                  {[
                    { id: 'journalctl', label: 'Journal' },
                    { id: 'gateway-log', label: 'Gateway' },
                    { id: 'errors', label: 'Errors' },
                  ].map(s => (
                    <button
                      key={s.id}
                      onClick={() => switchLogSource(s.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                        logsSource === s.id
                          ? 'bg-indigo-500/[0.15] text-indigo-300'
                          : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <button onClick={copyLogs} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] text-neutral-400 hover:text-white hover:bg-white/[0.1] transition-all">
                  {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <div className="p-4">
              <pre className="text-[11px] font-mono text-neutral-300 bg-black/30 rounded-lg p-4 overflow-auto max-h-96 whitespace-pre-wrap leading-relaxed">
                {logsLoading && !logs ? 'Loading...' : (logs || 'No logs available')}
              </pre>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
