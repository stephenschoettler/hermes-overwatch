'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Monitor, Search, ChevronLeft, ChevronRight, X, RefreshCw, Clock,
} from 'lucide-react';

interface Session {
  id: string;
  source: string;
  model: string;
  title: string;
  started_at: string;
  ended_at: string | null;
  message_count: number;
  tool_call_count: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  estimated_cost_usd: number;
  end_reason: string;
  parent_session_id: string | null;
}

interface ActiveSession {
  id: string;
  source: string;
  model: string;
  title: string;
  started_at: string;
  message_count: number;
  tool_call_count: number;
  input_tokens: number;
  output_tokens: number;
}

interface SessionsData {
  sessions: Session[];
  activeSessions: ActiveSession[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  stats: { active: number; idle24h: number; total24h: number };
  filters: { models: string[]; sources: string[] };
}

/* ─── helpers ─── */

function formatTokens(n: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function shortModel(m: string): string {
  if (!m) return '—';
  // Extract the friendly name: "claude-3.5-sonnet" → "Claude Sonnet"
  // "claude-opus-4" → "Claude Opus"
  const lower = m.toLowerCase();
  if (lower.includes('opus')) return 'Claude Opus';
  if (lower.includes('sonnet')) return 'Claude Sonnet';
  if (lower.includes('haiku')) return 'Claude Haiku';
  if (lower.includes('gpt-4')) return 'GPT-4';
  if (lower.includes('gpt-3')) return 'GPT-3.5';
  return m.replace('claude-', '').replace('gpt-', 'GPT-');
}

function contextWindow(model: string): number {
  const lower = (model || '').toLowerCase();
  if (lower.includes('gpt-3')) return 16384;
  if (lower.includes('gpt-4o')) return 128000;
  if (lower.includes('gpt-4')) return 128000;
  return 200000; // Claude models default
}

function contextFillPct(inputTokens: number, outputTokens: number, model: string): number {
  const total = inputTokens + outputTokens;
  const window = contextWindow(model);
  return Math.min(100, Math.round((total / window) * 100));
}

function sourceType(source: string): { label: string; color: string } {
  switch (source) {
    case 'cli': return { label: 'MAIN', color: 'bg-blue-400/20 text-blue-400 border-blue-400/30' };
    case 'telegram': return { label: 'TELEGRAM', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' };
    case 'cron': return { label: 'CRON', color: 'bg-indigo-500/[0.15] text-purple-400 border-indigo-500/20' };
    case 'discord': return { label: 'DISCORD', color: 'bg-indigo-500/[0.15] text-purple-400 border-indigo-500/20' };
    default:
      if (source === 'subagent' || source === 'delegation') {
        return { label: 'SUBAGENT', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' };
      }
      return { label: source.toUpperCase(), color: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30' };
  }
}

function sourceAvatar(source: string): { emoji: string; bg: string } {
  switch (source) {
    case 'cli': return { emoji: '💻', bg: 'from-blue-600 to-blue-800' };
    case 'telegram': return { emoji: '✈️', bg: 'from-teal-500 to-teal-700' };
    case 'cron': return { emoji: '⏰', bg: 'from-purple-500 to-purple-700' };
    case 'discord': return { emoji: '🎮', bg: 'from-indigo-500 to-indigo-700' };
    default:
      if (source === 'subagent' || source === 'delegation') {
        return { emoji: '🤖', bg: 'from-teal-500 to-teal-700' };
      }
      return { emoji: '📡', bg: 'from-neutral-500 to-neutral-700' };
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
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function LiveClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="text-sm text-neutral-500 font-mono">{time}</span>;
}

/* ─── page ─── */

export default function SessionsPage() {
  const [data, setData] = useState<SessionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [source, setSource] = useState('');
  const [model, setModel] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (source) params.set('source', source);
    if (model) params.set('model', model);
    if (search) params.set('q', search);

    try {
      const res = await fetch(`/api/sessions?${params}`);
      setData(await res.json());
    } catch {}
    setLoading(false);
  }, [page, source, model, search]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const doSearch = () => { setSearch(searchInput); setPage(1); };
  const clearFilters = () => { setSource(''); setModel(''); setSearch(''); setSearchInput(''); setPage(1); };
  const hasFilters = source || model || search;

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSessions();
    setRefreshing(false);
  };

  const stats = data?.stats || { active: 0, idle24h: 0, total24h: 0 };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Monitor size={20} className="text-purple-400" />
          <h1 className="text-xl font-bold text-white">Sessions</h1>
        </div>
        <div className="flex items-center gap-3">
          <LiveClock />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-all text-xs"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Active */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-400 pulse-dot" />
            <p className="text-xs text-neutral-500 font-medium">Active</p>
          </div>
          <p className="text-3xl font-bold text-white">{stats.active}</p>
        </div>
        {/* Idle 24h */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-neutral-500" />
            <p className="text-xs text-neutral-500 font-medium">Idle (24h)</p>
          </div>
          <p className="text-3xl font-bold text-white">{stats.idle24h}</p>
        </div>
        {/* Total 24h */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <Monitor size={12} className="text-purple-400" />
            <p className="text-xs text-neutral-500 font-medium">Total (24h)</p>
          </div>
          <p className="text-3xl font-bold text-white">{stats.total24h}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg overflow-hidden">
          <Search size={13} className="text-neutral-600 ml-2.5" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="Search messages..."
            className="bg-transparent text-sm text-white placeholder:text-neutral-600 px-2 py-1.5 w-48 focus:outline-none"
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }} className="text-neutral-600 hover:text-neutral-400 pr-2">
              <X size={13} />
            </button>
          )}
        </div>

        <select
          value={source}
          onChange={e => { setSource(e.target.value); setPage(1); }}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-neutral-300 px-2.5 py-1.5 focus:outline-none focus:border-indigo-500/20 appearance-none cursor-pointer"
        >
          <option value="">All sources</option>
          {data?.filters.sources.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={model}
          onChange={e => { setModel(e.target.value); setPage(1); }}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-neutral-300 px-2.5 py-1.5 focus:outline-none focus:border-indigo-500/20 appearance-none cursor-pointer"
        >
          <option value="">All models</option>
          {data?.filters.models.map(m => (
            <option key={m} value={m}>{shortModel(m)}</option>
          ))}
        </select>

        {hasFilters && (
          <button onClick={clearFilters} className="text-[11px] text-neutral-500 hover:text-neutral-300 px-2 py-1">
            Clear filters
          </button>
        )}
      </div>

      {/* Sessions table */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        {/* Table header */}
        <div className="hidden sm:grid grid-cols-[1fr_140px_180px_80px_100px_100px] gap-3 px-4 py-2.5 border-b border-white/[0.06] text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
          <div>Agent</div>
          <div>Model</div>
          <div>Context Fill</div>
          <div className="text-right">Tokens</div>
          <div className="text-center">Type</div>
          <div className="text-right">Last Active</div>
        </div>

        {loading && !data ? (
          <div className="p-8 text-center text-sm text-neutral-500">Loading...</div>
        ) : data?.sessions.length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-500">
            {hasFilters ? 'No sessions match your filters' : 'No sessions found'}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {data?.sessions.map(s => {
              const avatar = sourceAvatar(s.source);
              const type = sourceType(s.source);
              const pct = contextFillPct(s.input_tokens, s.output_tokens, s.model);
              const totalTokens = s.input_tokens + s.output_tokens;
              const isActive = !s.ended_at;

              return (
                <Link
                  key={s.id}
                  href={`/session/${s.id}`}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_140px_180px_80px_100px_100px] gap-1 sm:gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors items-center group"
                >
                  {/* Agent */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${avatar.bg} flex items-center justify-center text-sm flex-shrink-0`}>
                      {avatar.emoji}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-200 truncate group-hover:text-white transition-colors">
                        {s.title || s.id.slice(0, 12)}
                      </p>
                      <p className="text-[10px] text-neutral-600 truncate">
                        {s.id.slice(0, 8)} · {s.message_count} msgs · {s.tool_call_count} tools
                      </p>
                    </div>
                    {isActive && (
                      <div className="w-2 h-2 rounded-full bg-green-400 pulse-dot flex-shrink-0" />
                    )}
                  </div>

                  {/* Model */}
                  <div className="hidden sm:block text-sm text-neutral-500 truncate">
                    {shortModel(s.model)}
                  </div>

                  {/* Context Fill */}
                  <div className="hidden sm:block">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-400 transition-all"
                          style={{ width: `${Math.max(pct, 1)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-green-400 w-8 text-right">{pct}%</span>
                    </div>
                  </div>

                  {/* Tokens */}
                  <div className="hidden sm:block text-right text-sm text-neutral-400 font-mono">
                    {formatTokens(totalTokens)}
                  </div>

                  {/* Type badge */}
                  <div className="hidden sm:flex justify-center">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded border ${type.color}`}>
                      {type.label}
                    </span>
                  </div>

                  {/* Last Active */}
                  <div className="hidden sm:flex items-center justify-end gap-1.5 text-sm text-neutral-500">
                    <Clock size={11} className="text-neutral-600" />
                    {timeAgo(s.started_at)}
                  </div>

                  {/* Mobile summary */}
                  <div className="sm:hidden flex items-center gap-2 text-[10px] text-neutral-600">
                    <span className={`font-bold px-1.5 py-0.5 rounded border ${type.color}`}>{type.label}</span>
                    <span>{shortModel(s.model)}</span>
                    <span>·</span>
                    <span>{formatTokens(totalTokens)}</span>
                    <span>·</span>
                    <span>{timeAgo(s.started_at)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-[11px] text-neutral-600">
            Page {data.page} of {data.pages} · {data.total} total
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/[0.1] disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(data.pages, p + 1))}
              disabled={page >= data.pages}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/[0.1] disabled:opacity-30 transition-all"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
