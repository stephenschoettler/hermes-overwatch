'use client';

import { useState, useEffect } from 'react';
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
    case 'cli': return 'text-ctp-blue bg-ctp-blue/10 border-ctp-blue/20';
    case 'telegram': return 'text-ctp-sky bg-ctp-sky/10 border-ctp-sky/20';
    case 'cron': return 'text-ctp-yellow bg-ctp-yellow/10 border-ctp-yellow/20';
    default: return 'text-ctp-overlay2 bg-ctp-overlay2/10 border-ctp-overlay2/20';
  }
}

function eventIcon(type: string) {
  switch (type) {
    case 'session_start': return <Play size={11} className="text-ctp-green" />;
    case 'session_end': return <Square size={11} className="text-ctp-overlay1" />;
    case 'cron_run': return <Zap size={11} className="text-ctp-yellow" />;
    case 'gateway_start': return <Radio size={11} className="text-ctp-mauve" />;
    default: return <Activity size={11} className="text-ctp-overlay1" />;
  }
}

function eventColor(type: string): string {
  switch (type) {
    case 'session_start': return 'border-ctp-green/20';
    case 'session_end': return 'border-ctp-overlay1/10';
    case 'cron_run': return 'border-ctp-yellow/20';
    case 'gateway_start': return 'border-ctp-mauve/30';
    default: return 'border-ctp-surface0';
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
  const [data, setData] = useState<ActivityData | null>(null);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/activity?hours=${hours}&limit=150`);
        setData(await res.json());
      } catch {}
      setLoading(false);
    };
    fetchActivity();
    const iv = setInterval(fetchActivity, 30000);
    return () => clearInterval(iv);
  }, [hours]);

  const grouped = data ? groupByDay(data.events) : new Map();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-3"><Activity size={20} className="text-ctp-mauve" /><h1 className="text-xl font-bold text-ctp-text">Activity</h1></div>
          <p className="text-sm text-ctp-overlay1 mt-0.5">
            {data ? `${data.total} events` : 'Loading...'}
          </p>
        </div>
        <div className="flex rounded-lg bg-ctp-surface0/50 p-0.5">
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
                  ? 'bg-ctp-mauve/20 text-ctp-lavender'
                  : 'text-ctp-overlay1 hover:text-ctp-subtext0'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="animate-pulse space-y-2">
          {[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-ctp-surface0/40 rounded-lg" />)}
        </div>
      ) : data?.events.length === 0 ? (
        <div className="rounded-xl border border-ctp-surface0 bg-ctp-surface0/30 p-8 text-center">
          <p className="text-ctp-overlay1 text-sm">No activity in the last {hours}h</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([day, events]: [string, ActivityEvent[]]) => (
            <div key={day}>
              <p className="text-[11px] font-medium text-ctp-overlay0 uppercase tracking-wider mb-2 px-1">
                {formatDay(day)}
              </p>
              <div className="space-y-1">
                {events.map((e, i) => (
                  <div
                    key={`${e.session_id}-${e.type}-${i}`}
                    className={`flex items-start gap-3 px-3 py-2 rounded-lg border bg-ctp-surface0/20 hover:bg-ctp-surface1/30 transition-colors ${eventColor(e.type)}`}
                  >
                    <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 bg-ctp-surface0/40">
                      {eventIcon(e.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {e.session_id ? (
                          <Link href={`/session/${e.session_id}`} className="text-sm text-ctp-subtext1 hover:text-ctp-text truncate">
                            {e.title}
                          </Link>
                        ) : (
                          <span className="text-sm text-ctp-subtext1 truncate">{e.title}</span>
                        )}
                        <span className={`text-[9px] font-medium px-1 py-0.5 rounded border flex-shrink-0 ${sourceColor(e.source)}`}>
                          {e.source}
                        </span>
                      </div>
                      <p className="text-[11px] text-ctp-overlay0 mt-0.5">{e.detail}</p>
                    </div>
                    <span className="text-[10px] text-ctp-overlay0 font-mono flex-shrink-0 mt-0.5">
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
