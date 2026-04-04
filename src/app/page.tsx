'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Monitor, Zap, Puzzle, Brain, MessageSquare, Wrench,
  ArrowRight, Clock, Radio, Server, Play, Square,
 LayoutDashboard,} from 'lucide-react';

interface Stats {
  totals: {
    total_sessions: number;
    total_messages: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cache_read: number;
    total_cost: number;
  };
  today: { sessions: number; messages: number; tool_calls: number; input_tokens: number; output_tokens: number; cost: number };
  week: { sessions: number; messages: number; tool_calls: number; cost: number };
  models: { model: string; count: number }[];
  sources: { source: string; count: number }[];
  dailyActivity: { day: string; sessions: number; messages: number; tool_calls: number }[];
  recentSessions: {
    id: string; source: string; model: string; title: string;
    started_at: string; message_count: number; tool_call_count: number;
    input_tokens: number; output_tokens: number; end_reason: string;
  }[];
  gateway: {
    state: string;
    pid: number | null;
    platforms: Record<string, { state?: string; error_message?: string }>;
    process: { uptime?: string; rss_mb?: number } | null;
  };
  crons: {
    total: number;
    enabled: number;
    jobs: { name: string; schedule: string; enabled: boolean; lastStatus: string; lastRunAt: string; nextRunAt: string }[];
  };
  config: {
    model: string;
    provider: string;
    personality: string;
    mcpServers: string[];
  };
  activeSessions: {
    id: string; source: string; model: string; title: string;
    started_at: string; message_count: number; tool_call_count: number;
  }[];
  liveSessions: Record<string, {
    session_key?: string; display_name?: string; platform?: string;
    last_prompt_tokens?: number; estimated_cost_usd?: number;
  }>;
  skillsCount: number;
  hermesVersion: string;
  dbSizeMb: number;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

function shortModel(m: string): string {
  if (!m) return '?';
  return m.replace('claude-', '').replace('gpt-', 'gpt');
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function sourceColor(source: string): string {
  switch (source) {
    case 'cli': return 'text-purple-400 bg-indigo-500/10 border-indigo-400/20';
    case 'telegram': return 'text-sky-400 bg-sky-400/10 border-sky-400/20';
    case 'cron': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    default: return 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20';
  }
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <div className={`w-2 h-2 rounded-full ${ok ? 'bg-green-400 pulse-dot' : 'bg-red-500'}`} />
  );
}

// Simple bar chart for daily activity
function ActivityBars({ data }: { data: Stats['dailyActivity'] }) {
  if (!data.length) return <p className="text-neutral-600 text-xs">No data</p>;
  const max = Math.max(1, ...data.map(d => d.messages));
  const barMaxPx = 56; // max bar height in pixels

  return (
    <div className="flex items-end gap-1.5" style={{ height: barMaxPx + 20 }}>
      {data.map(d => {
        const barH = Math.max(3, Math.round((d.messages / max) * barMaxPx));
        const dayLabel = d.day.slice(5); // MM-DD
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
            <div
              className="w-full bg-indigo-500/40 hover:bg-indigo-500/60 rounded-sm transition-all cursor-default"
              style={{ height: `${barH}px` }}
              title={`${d.day}: ${d.sessions} sessions, ${d.messages} messages, ${d.tool_calls} tools`}
            />
            <span className="text-[9px] text-neutral-600">{dayLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats');
        if (!res.ok) throw new Error('Failed to fetch');
        setStats(await res.json());
      } catch (e) {
        setError(String(e));
      }
    };
    fetchStats();
    const iv = setInterval(fetchStats, 30000);
    return () => clearInterval(iv);
  }, []);

  if (error) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="max-w-5xl mx-auto animate-pulse">
        <div className="h-8 bg-white/[0.04] rounded-lg w-48 mb-6" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-white/[0.03] rounded-xl" />)}
        </div>
      </div>
    );
  }

  const gatewayOk = stats.gateway.state === 'running';

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header with config info */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3"><LayoutDashboard size={20} className="text-purple-400" /><h1 className="text-xl font-bold text-white">Overview</h1></div>
          <p className="text-sm text-neutral-500 mt-0.5">
            {stats.config.model} · {stats.config.provider}
          </p>
        </div>

      </div>

      {/* Top metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Active Sessions"
          value={String(stats.activeSessions.length)}
          sub={stats.activeSessions.length > 0
            ? stats.activeSessions.slice(0, 2).map(s => s.title || s.source).join(', ')
            : 'none running'}
          icon={<Radio size={15} />}
          color="green"
        />
        <MetricCard
          label="Sessions Today"
          value={String(stats.today.sessions)}
          sub={`${stats.today.messages} messages · ${stats.today.tool_calls} tools`}
          icon={<Clock size={15} />}
          color="indigo"
        />
        <MetricCard
          label="Tokens Today"
          value={formatTokens(stats.today.input_tokens + stats.today.output_tokens)}
          sub={`${formatTokens(stats.today.input_tokens)} in · ${formatTokens(stats.today.output_tokens)} out`}
          icon={<MessageSquare size={15} />}
          color="purple"
        />
        <MetricCard
          label="Skills"
          value={String(stats.skillsCount)}
          sub={`${stats.crons.enabled} cron jobs active`}
          icon={<Puzzle size={15} />}
          color="green"
        />
      </div>

      {/* Middle row: Activity + Models + Crons + Sources */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Daily activity */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-xs font-medium text-neutral-400 mb-3">Daily Activity</p>
          <ActivityBars data={stats.dailyActivity} />
        </div>

        {/* Models */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-neutral-400">Models</p>
            <Link href="/models" className="text-[10px] text-purple-400 hover:text-indigo-300 flex items-center gap-1">
              View all <ArrowRight size={9} />
            </Link>
          </div>
          <div className="space-y-2">
            {stats.models.map(m => {
              const pct = Math.round((m.count / stats.totals.total_sessions) * 100);
              return (
                <div key={m.model} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-neutral-300 truncate">{shortModel(m.model)}</span>
                      <span className="text-[10px] text-neutral-500">{m.count}</span>
                    </div>
                    <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500/50 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Crons */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-neutral-400">Crons</p>
            <Link href="/automation" className="text-[10px] text-purple-400 hover:text-indigo-300 flex items-center gap-1">
              Manage <ArrowRight size={9} />
            </Link>
          </div>
          <div className="space-y-2">
            {stats.crons.jobs.map(j => (
              <div key={j.name} className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-neutral-300 truncate">{j.name}</p>
                  <p className="text-[10px] text-neutral-600">{j.schedule}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className={`w-1.5 h-1.5 rounded-full ${j.lastStatus === 'ok' ? 'bg-green-400' : j.lastStatus === 'error' ? 'bg-red-500' : 'bg-neutral-600'}`} />
                  <span className="text-[10px] text-neutral-500">{j.lastStatus || '—'}</span>
                </div>
              </div>
            ))}
            {stats.crons.jobs.length === 0 && (
              <p className="text-xs text-neutral-600">No cron jobs</p>
            )}
          </div>
        </div>

        {/* Sources */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-xs font-medium text-neutral-400 mb-3">Sources</p>
          <div className="space-y-2">
            {stats.sources.map(s => (
              <div key={s.source} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${sourceColor(s.source)}`}>
                    {s.source}
                  </span>
                </div>
                <span className="text-sm font-mono text-neutral-300">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row: Recent activity + Recent sessions + System */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Recent activity */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-neutral-400">Recent Activity</p>
            <Link href="/activity" className="text-[10px] text-purple-400 hover:text-indigo-300 flex items-center gap-1">
              View all <ArrowRight size={10} />
            </Link>
          </div>
          <RecentActivity />
        </div>

        {/* Recent sessions */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-neutral-400">Recent Sessions</p>
            <Link href="/sessions" className="text-[10px] text-purple-400 hover:text-indigo-300 flex items-center gap-1">
              View all <ArrowRight size={10} />
            </Link>
          </div>
          <div className="space-y-1">
            {stats.recentSessions.slice(0, 6).map(s => (
              <Link
                key={s.id}
                href={`/session/${s.id}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                <span className={`text-[9px] font-medium px-1 py-0.5 rounded border flex-shrink-0 ${sourceColor(s.source)}`}>
                  {s.source}
                </span>
                <span className="text-xs text-neutral-300 truncate flex-1 min-w-0">
                  {s.title || s.id}
                </span>
                <span className="text-[10px] text-neutral-500 flex-shrink-0">
                  {timeAgo(s.started_at)}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* System panel */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-xs font-medium text-neutral-400 mb-3">System</p>
          <div className="space-y-2.5 text-xs">
            <SysRow label="Gateway" value={gatewayOk ? `PID ${stats.gateway.pid}` : 'offline'} ok={gatewayOk} />
            {stats.gateway.process?.uptime && (
              <SysRow label="Uptime" value={stats.gateway.process.uptime} />
            )}
            {stats.hermesVersion && stats.hermesVersion !== 'unknown' && (
              <SysRow label="Version" value={`v${stats.hermesVersion}`} />
            )}
            {stats.gateway.process?.rss_mb && (
              <SysRow label="Memory" value={`${stats.gateway.process.rss_mb} MB`} />
            )}
            {Object.entries(stats.gateway.platforms).map(([name, info]) => (
              <SysRow key={name} label={name} value={info.state || 'unknown'} ok={info.state === 'connected'} />
            ))}
            <div className="border-t border-white/[0.06]/50 pt-2 mt-2" />
            <SysRow label="MCP Servers" value={String(stats.config.mcpServers.length)} />
            <SysRow label="state.db" value={`${stats.dbSizeMb} MB`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub: string;
  icon: React.ReactNode; color: string;
}) {
  const colors: Record<string, string> = {
    indigo: 'text-purple-400 bg-indigo-400/10',
    blue: 'text-blue-400 bg-blue-400/10',
    purple: 'text-purple-400 bg-indigo-500/10',
    green: 'text-green-400 bg-green-400/10',
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
        <span className="text-[11px] font-medium text-neutral-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-[11px] text-neutral-500 mt-0.5">{sub}</p>
    </div>
  );
}

interface ActivityEvent {
  type: string;
  timestamp: string;
  source: string;
  title: string;
  detail: string;
  session_id: string | null;
}

function RecentActivity() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch('/api/activity?hours=24&limit=8');
        const data = await res.json();
        setEvents(data.events || []);
      } catch {}
    };
    fetchActivity();
    const iv = setInterval(fetchActivity, 30000);
    return () => clearInterval(iv);
  }, []);

  if (events.length === 0) {
    return <p className="text-neutral-600 text-xs">No recent activity</p>;
  }

  return (
    <div className="space-y-1">
      {events.map((e, i) => (
        <div key={`${e.session_id}-${e.type}-${i}`} className="flex items-center gap-2 px-1 py-1">
          <span className="flex-shrink-0">
            {e.type === 'session_start' ? <Play size={9} className="text-green-400" /> :
             e.type === 'session_end' ? <Square size={9} className="text-neutral-600" /> :
             e.type === 'cron_run' ? <Zap size={9} className="text-amber-400" /> :
             <Radio size={9} className="text-neutral-600" />}
          </span>
          {e.session_id ? (
            <Link href={`/session/${e.session_id}`} className="text-[11px] text-neutral-400 hover:text-neutral-200 truncate flex-1">
              {e.title}
            </Link>
          ) : (
            <span className="text-[11px] text-neutral-400 truncate flex-1">{e.title}</span>
          )}
          <span className="text-[9px] text-neutral-600 font-mono flex-shrink-0">
            {e.timestamp.split(' ')[1]?.slice(0, 5) || ''}
          </span>
        </div>
      ))}
    </div>
  );
}

function SysRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-500">{label}</span>
      <div className="flex items-center gap-1.5">
        {ok !== undefined && <StatusDot ok={ok} />}
        <span className="text-neutral-300 font-mono text-[11px]">{value}</span>
      </div>
    </div>
  );
}
