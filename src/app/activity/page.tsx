'use client';

import { useState, useEffect, useContext } from 'react';
import { ViewContext } from '../layout';
import Link from 'next/link';
import {
  Activity, Play, Square, Zap, Radio, MessageSquare, Wrench,
} from 'lucide-react';

interface ActivityEvent {
  type: 'session_start' | 'session_end' | 'cron_run' | 'gateway_start';
  timestamp: string;
  epoch: number;
  source: string;
  title: string;
  detail: string;
  session_id: string | null;
  model: string | null;
}

interface ActiveSession {
  id: string;
  source: string;
  model: string;
  title: string;
  started_at: string;
  message_count: number;
  tool_call_count: number;
}

interface ActivityData {
  events: ActivityEvent[];
  total: number;
  hours: number;
  activeSessions: ActiveSession[];
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
    case 'cli': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    case 'telegram': return 'text-sky-400 bg-sky-400/10 border-sky-400/20';
    case 'cron': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    default: return 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20';
  }
}

function eventIcon(type: string) {
  switch (type) {
    case 'session_start': return <Play size={11} className="text-green-400" />;
    case 'session_end': return <Square size={11} className="text-neutral-500" />;
    case 'cron_run': return <Zap size={11} className="text-amber-400" />;
    case 'gateway_start': return <Radio size={11} className="text-purple-400" />;
    default: return <Activity size={11} className="text-neutral-500" />;
  }
}

function eventColor(type: string): string {
  switch (type) {
    case 'session_start': return 'border-green-500/20';
    case 'session_end': return 'border-neutral-500/10';
    case 'cron_run': return 'border-amber-400/20';
    case 'gateway_start': return 'border-indigo-500/20';
    default: return 'border-white/[0.06]';
  }
}

function timeLabel(timestamp: string): string {
  if (!timestamp) return '';
  // Just show HH:MM
  const parts = timestamp.split(' ');
  if (parts.length >= 2) {
    return parts[1].slice(0, 5);
  }
  return timestamp;
}

function groupByDay(events: ActivityEvent[]): Map<string, ActivityEvent[]> {
  const groups = new Map<string, ActivityEvent[]>();
  for (const e of events) {
    const day = e.timestamp.split(' ')[0] || 'Unknown';
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(e);
  }
  return groups;
}

function formatDay(day: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';
  return day;
}

export default function ActivityPage() {
  const { view } = useContext(ViewContext);
  const [data, setData] = useState<ActivityData | null>(null);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/activity?hours=${hours}&limit=150&profile=${encodeURIComponent(view)}`);
        setData(await res.json());
      } catch {}
      setLoading(false);
    };
    fetchActivity();
    const iv = setInterval(fetchActivity, 30000);
    return () => clearInterval(iv);
  }, [hours, view]);

  const grouped = data ? groupByDay(data.events) : new Map();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-3"><Activity size={20} className="text-purple-400" /><h1 className="text-xl font-bold text-white">Activity</h1></div>
          <p className="text-sm text-neutral-500 mt-0.5">
            {data ? `${data.total} events` : 'Loading...'}
          </p>
        </div>
        <div className="flex rounded-lg bg-white/[0.04] p-0.5">
          {[
            { value: 6, label: '6h' },
            { value: 24, label: '24h' },
            { value: 72, label: '3d' },
            { value: 168, label: '7d' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setHours(opt.value)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                hours === opt.value
                  ? 'bg-indigo-500/[0.15] text-indigo-300'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="animate-pulse space-y-2">
          {[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-white/[0.03] rounded-lg" />)}
        </div>
      ) : data?.events.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <p className="text-neutral-500 text-sm">No activity in the last {hours}h</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([day, events]: [string, ActivityEvent[]]) => (
            <div key={day}>
              <p className="text-[11px] font-medium text-neutral-600 uppercase tracking-wider mb-2 px-1">
                {formatDay(day)}
              </p>
              <div className="space-y-1">
                {events.map((e, i) => (
                  <div
                    key={`${e.session_id}-${e.type}-${i}`}
                    className={`flex items-start gap-3 px-3 py-2 rounded-lg border bg-white/[0.02] hover:bg-white/[0.04] transition-colors ${eventColor(e.type)}`}
                  >
                    <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 bg-white/[0.03]">
                      {eventIcon(e.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {e.session_id ? (
                          <Link href={`/session/${e.session_id}`} className="text-sm text-neutral-200 hover:text-white truncate">
                            {e.title}
                          </Link>
                        ) : (
                          <span className="text-sm text-neutral-200 truncate">{e.title}</span>
                        )}
                        <span className={`text-[9px] font-medium px-1 py-0.5 rounded border flex-shrink-0 ${sourceColor(e.source)}`}>
                          {e.source}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-600 mt-0.5">{e.detail}</p>
                    </div>
                    <span className="text-[10px] text-neutral-600 font-mono flex-shrink-0 mt-0.5">
                      {timeLabel(e.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
