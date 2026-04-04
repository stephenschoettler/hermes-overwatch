'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3, Hash, MessageSquare, Wrench, Clock, TrendingUp,
} from 'lucide-react';

interface DailyRow {
  day: string;
  sessions: number;
  messages: number;
  tool_calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
}

interface DailySourceRow {
  day: string;
  source: string;
  sessions: number;
}

interface DailyModelRow {
  day: string;
  model: string;
  sessions: number;
  input_tokens: number;
  output_tokens: number;
}

interface HourlyRow {
  hour: string;
  sessions: number;
  messages: number;
}

interface Totals {
  sessions: number;
  messages: number;
  tool_calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cost: number;
}

interface AvgPerDay {
  avg_sessions: number;
  avg_messages: number;
  avg_tools: number;
  avg_input_tokens: number;
  avg_output_tokens: number;
}

interface AnalyticsData {
  daily: DailyRow[];
  dailyBySource: DailySourceRow[];
  dailyByModel: DailyModelRow[];
  hourly: HourlyRow[];
  totals: Totals;
  avgPerDay: AvgPerDay;
}

function formatTokens(n: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

function shortModel(m: string): string {
  return m.replace('claude-', '').replace('gpt-', 'gpt');
}

const MODEL_COLORS: Record<string, string> = {
  'claude-opus-4-6':  'bg-violet-500/70',
  'claude-sonnet-4-6':'bg-blue-400/70',
  'gpt-5.4':          'bg-emerald-400/70',
};

const SOURCE_COLORS: Record<string, string> = {
  cli:      'bg-purple-500/70',
  cron:     'bg-amber-400/70',
  telegram: 'bg-sky-400/70',
};

const BAR_COLORS: Record<string, { bar: string; hover: string }> = {
  blue:   { bar: 'bg-blue-500/50',   hover: 'hover:bg-blue-500/70' },
  violet: { bar: 'bg-violet-500/50', hover: 'hover:bg-violet-500/70' },
  green:  { bar: 'bg-emerald-500/50',hover: 'hover:bg-emerald-500/70' },
  amber:  { bar: 'bg-amber-400/50',  hover: 'hover:bg-amber-400/70' },
  indigo: { bar: 'bg-indigo-500/50', hover: 'hover:bg-indigo-500/70' },
  purple: { bar: 'bg-violet-500/50', hover: 'hover:bg-violet-500/70' },
};

function BarChart({ data, barKey, label, color = 'indigo' }: {
  data: { label: string; value: number }[];
  barKey: string;
  label: string;
  color?: string;
}) {
  if (!data.length) return <p className="text-neutral-600 text-xs">No data</p>;
  const max = Math.max(1, ...data.map(d => d.value));
  const barMaxPx = 80;
  const colors = BAR_COLORS[color] || BAR_COLORS.indigo;

  return (
    <div>
      <div className="flex items-end gap-1" style={{ height: barMaxPx + 24 }}>
        {data.map(d => {
          const barH = Math.max(2, Math.round((d.value / max) * barMaxPx));
          return (
            <div key={d.label} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
              <span className="text-[8px] text-neutral-600">{d.value > 0 ? formatTokens(d.value) : ''}</span>
              <div
                className={`w-full ${colors.bar} ${colors.hover} rounded-sm transition-all cursor-default`}
                style={{ height: `${barH}px` }}
                title={`${d.label}: ${d.value.toLocaleString()}`}
              />
              <span className="text-[9px] text-neutral-600">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StackedBars({ daily, byGroup, groupColors, groupLabel }: {
  daily: DailyRow[];
  byGroup: { day: string; group: string; value: number }[];
  groupColors: Record<string, string>;
  groupLabel: (g: string) => string;
}) {
  const days = daily.map(d => d.day);
  const groups = Array.from(new Set(byGroup.map(r => r.group)));
  const maxPerDay = new Map<string, number>();
  for (const day of days) {
    const total = byGroup.filter(r => r.day === day).reduce((a, r) => a + r.value, 0);
    maxPerDay.set(day, total);
  }
  const max = Math.max(1, ...Array.from(maxPerDay.values()));
  const barMaxPx = 80;

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-2">
        {groups.map(g => (
          <div key={g} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-sm ${groupColors[g] || 'bg-neutral-500/50'}`} />
            <span className="text-[10px] text-neutral-500">{groupLabel(g)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-1" style={{ height: barMaxPx + 24 }}>
        {days.map(day => {
          const dayGroups = byGroup.filter(r => r.day === day);
          const total = dayGroups.reduce((a, r) => a + r.value, 0);
          const totalH = Math.max(2, Math.round((total / max) * barMaxPx));

          return (
            <div key={day} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
              <div className="w-full flex flex-col-reverse rounded-sm overflow-hidden" style={{ height: `${totalH}px` }} title={`${day}: ${total}`}>
                {dayGroups.map(g => {
                  const pct = total > 0 ? (g.value / total) * 100 : 0;
                  return (
                    <div
                      key={g.group}
                      className={`w-full ${groupColors[g.group] || 'bg-neutral-500/50'}`}
                      style={{ height: `${pct}%`, minHeight: g.value > 0 ? '1px' : '0' }}
                    />
                  );
                })}
              </div>
              <span className="text-[9px] text-neutral-600">{day.slice(5)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HourlyChart({ data }: { data: HourlyRow[] }) {
  // Fill all 24 hours
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const map = new Map(data.map(d => [d.hour, d]));
  const max = Math.max(1, ...data.map(d => d.sessions));
  const barMaxPx = 50;

  return (
    <div className="flex items-end gap-px" style={{ height: barMaxPx + 20 }}>
      {hours.map(h => {
        const row = map.get(h);
        const val = row?.sessions || 0;
        const barH = val > 0 ? Math.max(2, Math.round((val / max) * barMaxPx)) : 0;
        return (
          <div key={h} className="flex-1 flex flex-col items-center justify-end gap-0.5 h-full">
            <div
              className={`w-full rounded-sm ${val > 0 ? 'bg-amber-400/50' : 'bg-white/[0.02]'}`}
              style={{ height: `${barH}px` }}
              title={`${h}:00 — ${val} sessions`}
            />
            {parseInt(h) % 3 === 0 && (
              <span className="text-[8px] text-neutral-700">{h}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch('/api/analytics');
        setData(await res.json());
      } catch {}
      setLoading(false);
    };
    fetchAnalytics();
  }, []);

  if (loading || !data) {
    return (
      <div className="max-w-5xl mx-auto animate-pulse">
        <div className="h-8 bg-white/[0.04] rounded-lg w-48 mb-6" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-white/[0.03] rounded-xl" />)}
        </div>
      </div>
    );
  }

  const t = data.totals;
  const avg = data.avgPerDay;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <div className="flex items-center gap-3"><BarChart3 size={20} className="text-purple-400" /><h1 className="text-xl font-bold text-white">Analytics</h1></div>
        <p className="text-sm text-neutral-500 mt-0.5">
          {data.daily.length} days tracked · {t.sessions} sessions
        </p>
      </div>

      {/* All-time totals */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <TotalCard label="Sessions"      value={String(t.sessions)}               sub={`${avg.avg_sessions}/day avg`}                     color="blue" />
        <TotalCard label="Messages"      value={formatTokens(t.messages)}         sub={`${avg.avg_messages}/day`}                         color="green" />
        <TotalCard label="Tool Calls"    value={formatTokens(t.tool_calls)}       sub={`${avg.avg_tools}/day`}                            color="amber" />
        <TotalCard label="Input Tokens"  value={formatTokens(t.input_tokens)}     sub={`${formatTokens(avg.avg_input_tokens)}/day`}       color="violet" />
        <TotalCard label="Output Tokens" value={formatTokens(t.output_tokens)}    sub={`${formatTokens(avg.avg_output_tokens)}/day`}      color="cyan" />
        <TotalCard label="Cache Read"    value={formatTokens(t.cache_read_tokens)}sub="all time"                                          color="sky" />
      </div>

      {/* Charts row 1: Sessions + Tokens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-xs font-medium text-neutral-400 mb-3">Sessions per Day</p>
          <BarChart
            data={data.daily.map(d => ({ label: d.day.slice(5), value: d.sessions }))}
            color="blue"
            barKey="sessions"
            label="Sessions"
          />
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-xs font-medium text-neutral-400 mb-3">Output Tokens per Day</p>
          <BarChart
            data={data.daily.map(d => ({ label: d.day.slice(5), value: d.output_tokens }))}
            barKey="output_tokens"
            label="Output Tokens"
            color="violet"
          />
        </div>
      </div>

      {/* Charts row 2: By Source + By Model */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-xs font-medium text-neutral-400 mb-3">Sessions by Source</p>
          <StackedBars
            daily={data.daily}
            byGroup={data.dailyBySource.map(r => ({ day: r.day, group: r.source, value: r.sessions }))}
            groupColors={SOURCE_COLORS}
            groupLabel={g => g}
          />
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-xs font-medium text-neutral-400 mb-3">Sessions by Model</p>
          <StackedBars
            daily={data.daily}
            byGroup={data.dailyByModel.map(r => ({ day: r.day, group: r.model, value: r.sessions }))}
            groupColors={MODEL_COLORS}
            groupLabel={shortModel}
          />
        </div>
      </div>

      {/* Charts row 3: Messages + Hourly */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-xs font-medium text-neutral-400 mb-3">Messages per Day</p>
          <BarChart
            data={data.daily.map(d => ({ label: d.day.slice(5), value: d.messages }))}
            barKey="messages"
            label="Messages"
            color="green"
          />
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-xs font-medium text-neutral-400 mb-3">Activity by Hour (non-cron)</p>
          <HourlyChart data={data.hourly} />
        </div>
      </div>
    </div>
  );
}

const TOTAL_CARD_COLORS: Record<string, { value: string; border: string }> = {
  blue:   { value: 'text-blue-400',   border: 'border-t-blue-500/60' },
  green:  { value: 'text-emerald-400',border: 'border-t-emerald-500/60' },
  amber:  { value: 'text-amber-400',  border: 'border-t-amber-400/60' },
  violet: { value: 'text-violet-400', border: 'border-t-violet-500/60' },
  cyan:   { value: 'text-cyan-400',   border: 'border-t-cyan-400/60' },
  sky:    { value: 'text-sky-400',    border: 'border-t-sky-400/60' },
};

function TotalCard({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  const c = (color && TOTAL_CARD_COLORS[color]) || { value: 'text-white', border: '' };
  return (
    <div className={`rounded-xl border border-white/[0.06] border-t-2 ${c.border} bg-white/[0.02] p-3`}>
      <p className="text-[9px] text-neutral-600 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${c.value}`}>{value}</p>
      <p className="text-[10px] text-neutral-600 mt-0.5">{sub}</p>
    </div>
  );
}
