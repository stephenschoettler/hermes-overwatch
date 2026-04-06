'use client';

import { useState, useEffect, useContext } from 'react';
import { ViewContext } from '../layout';
import Link from 'next/link';
import {
  Cpu, MessageSquare, Wrench, Hash, Star, ArrowRight,
} from 'lucide-react';

interface ModelStats {
  model: string;
  sessions: number;
  messages: number;
  tool_calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cost: number;
  avg_messages: number;
  avg_tools: number;
  last_used: string;
}

interface SourceBreakdown {
  model: string;
  source: string;
  sessions: number;
  messages: number;
  tool_calls: number;
  input_tokens: number;
  output_tokens: number;
}

interface DayEntry {
  day: string;
  model: string;
  sessions: number;
}

interface RecentSession {
  id: string;
  source: string;
  title: string;
  started_at: string;
  message_count: number;
  tool_call_count: number;
}

interface ModelsData {
  models: ModelStats[];
  bySource: Record<string, SourceBreakdown[]>;
  byDay: DayEntry[];
  recentByModel: Record<string, RecentSession[]>;
  defaultModel: string;
}

function formatTokens(n: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

function shortModel(m: string): string {
  if (!m) return '—';
  return m.replace('claude-', '').replace('gpt-', 'gpt');
}

function sourceColor(source: string): string {
  switch (source) {
    case 'cli': return 'text-purple-400 bg-indigo-500/10 border-indigo-400/20';
    case 'telegram': return 'text-sky-400 bg-sky-400/10 border-sky-400/20';
    case 'cron': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    default: return 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20';
  }
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

// Mini bar chart for model usage by day
function ModelSparkline({ model, byDay }: { model: string; byDay: DayEntry[] }) {
  const days = byDay.filter(d => d.model === model);
  if (days.length === 0) return null;

  // Fill in missing days
  const allDays = Array.from(new Set(byDay.map(d => d.day))).sort();
  const dayMap = new Map(days.map(d => [d.day, d.sessions]));
  const max = Math.max(1, ...days.map(d => d.sessions));

  return (
    <div className="flex items-end gap-px h-5">
      {allDays.map(day => {
        const count = dayMap.get(day) || 0;
        const h = count > 0 ? Math.max(2, Math.round((count / max) * 18)) : 0;
        return (
          <div
            key={day}
            className={`w-2 rounded-sm ${count > 0 ? 'bg-indigo-500/50' : 'bg-white/[0.04]'}`}
            style={{ height: `${h}px` }}
            title={`${day}: ${count} sessions`}
          />
        );
      })}
    </div>
  );
}

export default function ModelsPage() {
  const { view } = useContext(ViewContext);
  const [data, setData] = useState<ModelsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch(`/api/models?profile=${encodeURIComponent(view)}`);
        setData(await res.json());
      } catch {}
      setLoading(false);
    };
    fetchModels();
  }, [view]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto animate-pulse">
        <div className="h-8 bg-white/[0.04] rounded-lg w-48 mb-6" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-white/[0.03] rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const totalSessions = data.models.reduce((a, m) => a + m.sessions, 0);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-5">
        <div className="flex items-center gap-3"><Cpu size={20} className="text-purple-400" /><h1 className="text-xl font-bold text-white">Models</h1></div>
        <p className="text-sm text-neutral-500 mt-0.5">
          {data.models.length} models used · default: {shortModel(data.defaultModel)}
        </p>
      </div>

      <div className="space-y-4">
        {data.models.map(m => {
          const pct = Math.round((m.sessions / totalSessions) * 100);
          const isDefault = m.model === data.defaultModel;
          const sources = data.bySource[m.model] || [];
          const recent = data.recentByModel[m.model] || [];

          return (
            <div key={m.model} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              {/* Model header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">{shortModel(m.model)}</h2>
                    {isDefault && (
                      <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/10 text-purple-400 border border-indigo-500/20">
                        <Star size={9} /> default
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-0.5 font-mono">{m.model}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">{pct}%</p>
                  <p className="text-[10px] text-neutral-600">{m.sessions} sessions</p>
                </div>
              </div>

              {/* Usage bar */}
              <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden mb-4">
                <div className="h-full bg-indigo-500/50 rounded-full" style={{ width: `${pct}%` }} />
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
                <Stat icon={<MessageSquare size={11} />} label="Messages" value={formatTokens(m.messages)} />
                <Stat icon={<Wrench size={11} />} label="Tool Calls" value={formatTokens(m.tool_calls)} />
                <Stat icon={<Hash size={11} />} label="Input Tokens" value={formatTokens(m.input_tokens)} />
                <Stat icon={<Hash size={11} />} label="Output Tokens" value={formatTokens(m.output_tokens)} />
                <Stat icon={<MessageSquare size={11} />} label="Avg Msgs" value={String(m.avg_messages)} />
                <Stat icon={<Wrench size={11} />} label="Avg Tools" value={String(m.avg_tools)} />
              </div>

              {/* Source breakdown + Sparkline + Recent */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* By source */}
                <div>
                  <p className="text-[10px] font-medium text-neutral-600 uppercase tracking-wider mb-2">By Source</p>
                  <div className="space-y-1.5">
                    {sources.map((s: SourceBreakdown) => (
                      <div key={s.source} className="flex items-center justify-between">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${sourceColor(s.source)}`}>
                          {s.source}
                        </span>
                        <span className="text-xs text-neutral-400 font-mono">{s.sessions}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Daily sparkline */}
                <div>
                  <p className="text-[10px] font-medium text-neutral-600 uppercase tracking-wider mb-2">Last 7 Days</p>
                  <ModelSparkline model={m.model} byDay={data.byDay} />
                  <p className="text-[9px] text-neutral-700 mt-1">Last used: {timeAgo(m.last_used)}</p>
                </div>

                {/* Recent sessions */}
                <div>
                  <p className="text-[10px] font-medium text-neutral-600 uppercase tracking-wider mb-2">Recent</p>
                  <div className="space-y-1">
                    {recent.map((s: RecentSession) => (
                      <Link
                        key={s.id}
                        href={`/session/${s.id}`}
                        className="block text-[11px] text-neutral-400 hover:text-neutral-200 truncate"
                      >
                        {s.title || s.id}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-neutral-600 mb-0.5">{icon}<span className="text-[9px]">{label}</span></div>
      <p className="text-sm font-bold text-neutral-200">{value}</p>
    </div>
  );
}
