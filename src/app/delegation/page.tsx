'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users, GitBranch, Layers, Settings, ChevronDown, ChevronRight,
  ArrowRight,
} from 'lucide-react';

interface DelegationCall {
  session_id: string;
  session_title: string;
  timestamp: string;
  goal: string;
  tasks: { goal: string; toolsets?: string[] }[];
  toolsets: string[];
  context_preview: string;
  mode: 'single' | 'batch';
}

interface SubagentSession {
  id: string;
  title: string;
  model: string;
  started_at: string;
  message_count: number;
  tool_call_count: number;
  end_reason: string;
  parent_title: string;
  parent_id: string;
}

interface DelegationData {
  delegations: DelegationCall[];
  totalCalls: number;
  batchCalls: number;
  singleCalls: number;
  toolsetUsage: Record<string, number>;
  subagentSessions: SubagentSession[];
  subagentCount: number;
  config: Record<string, unknown>;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function DelegationCard({ d }: { d: DelegationCall }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-ctp-surface0 bg-ctp-surface0/30 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ctp-surface0/30 transition-colors text-left"
      >
        <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
          d.mode === 'batch' ? 'bg-ctp-yellow/10 border border-ctp-yellow/20' : 'bg-ctp-mauve/10 border border-ctp-mauve/30'
        }`}>
          {d.mode === 'batch' ? <Layers size={11} className="text-ctp-yellow" /> : <GitBranch size={11} className="text-ctp-mauve" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-ctp-subtext1 truncate">{d.goal}</p>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-ctp-overlay0">
            <span>{d.mode === 'batch' ? `${d.tasks.length} parallel tasks` : 'single task'}</span>
            {d.toolsets.length > 0 && <span>· {d.toolsets.join(', ')}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-ctp-overlay0">{timeAgo(d.timestamp)}</span>
          {expanded ? <ChevronDown size={12} className="text-ctp-overlay0" /> : <ChevronRight size={12} className="text-ctp-overlay0" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-ctp-surface0/50 pt-3 space-y-3">
          {/* Batch tasks */}
          {d.tasks.length > 0 && (
            <div>
              <p className="text-[10px] text-ctp-overlay0 uppercase tracking-wider mb-1.5">Tasks</p>
              <div className="space-y-1.5">
                {d.tasks.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 px-2.5 py-1.5 rounded bg-ctp-surface0/30 border border-ctp-surface0/50">
                    <span className="text-[10px] text-ctp-surface2 font-mono mt-0.5">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-ctp-subtext0">{t.goal}</p>
                      {t.toolsets && t.toolsets.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {t.toolsets.map(ts => (
                            <span key={ts} className="text-[9px] px-1 py-0.5 rounded bg-ctp-surface0/50 text-ctp-overlay1">{ts}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Context */}
          {d.context_preview && (
            <div>
              <p className="text-[10px] text-ctp-overlay0 uppercase tracking-wider mb-1">Context</p>
              <p className="text-[11px] text-ctp-overlay2 bg-black/20 rounded px-2.5 py-1.5">{d.context_preview}{d.context_preview.length >= 200 ? '...' : ''}</p>
            </div>
          )}

          {/* Link to session */}
          <Link href={`/session/${d.session_id}`} className="flex items-center gap-1 text-[11px] text-ctp-mauve hover:text-ctp-lavender">
            {d.session_title} <ArrowRight size={10} />
          </Link>
        </div>
      )}
    </div>
  );
}

function ConfigViewer({ config }: { config: Record<string, unknown> }) {
  const entries = Object.entries(config).filter(([, v]) => v !== '' && v !== null);
  if (entries.length === 0) return <p className="text-xs text-ctp-overlay0">Default config</p>;

  return (
    <div className="space-y-1">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between">
          <span className="text-[11px] text-ctp-overlay1 font-mono">{key}</span>
          <span className="text-[11px] text-ctp-subtext0 font-mono">
            {Array.isArray(value) ? (value as string[]).join(', ') : String(value) || '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DelegationPage() {
  const [data, setData] = useState<DelegationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDelegation = async () => {
      try {
        const res = await fetch('/api/delegation');
        setData(await res.json());
      } catch {}
      setLoading(false);
    };
    fetchDelegation();
  }, []);

  if (loading || !data) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse">
        <div className="h-8 bg-ctp-surface0/50 rounded-lg w-48 mb-6" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-ctp-surface0/40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const sortedToolsets = Object.entries(data.toolsetUsage).sort((a, b) => b[1] - a[1]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-5">
        <div className="flex items-center gap-3"><Users size={20} className="text-ctp-mauve" /><h1 className="text-xl font-bold text-ctp-text">Delegation</h1></div>
        <p className="text-sm text-ctp-overlay1 mt-0.5">
          {data.totalCalls} delegation{data.totalCalls !== 1 ? 's' : ''} · {data.subagentCount} subagent session{data.subagentCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total" value={String(data.totalCalls)} icon={<Users size={13} className="text-ctp-mauve" />} />
        <StatCard label="Single" value={String(data.singleCalls)} icon={<GitBranch size={13} className="text-ctp-blue" />} />
        <StatCard label="Batch" value={String(data.batchCalls)} icon={<Layers size={13} className="text-ctp-yellow" />} />
        <StatCard label="Subagents" value={String(data.subagentCount)} icon={<Users size={13} className="text-ctp-green" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Delegation history (2 cols) */}
        <div className="lg:col-span-2">
          <p className="text-xs font-medium text-ctp-overlay2 mb-3">Delegation History</p>
          {data.delegations.length === 0 ? (
            <div className="rounded-xl border border-ctp-surface0 bg-ctp-surface0/30 p-8 text-center">
              <Users size={24} className="text-ctp-overlay0 mx-auto mb-2" />
              <p className="text-ctp-overlay1 text-sm">No delegations yet</p>
              <p className="text-ctp-overlay0 text-xs mt-1">Hermes uses delegate_task automatically for complex subtasks</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {data.delegations.map((d, i) => (
                <DelegationCard key={`${d.session_id}-${i}`} d={d} />
              ))}
            </div>
          )}

          {/* Subagent sessions */}
          {data.subagentSessions.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-medium text-ctp-overlay2 mb-3">Subagent Sessions</p>
              <div className="rounded-xl border border-ctp-surface0 bg-ctp-surface0/30 overflow-hidden">
                <div className="divide-y divide-ctp-surface0/50">
                  {data.subagentSessions.map(s => (
                    <Link key={s.id} href={`/session/${s.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-ctp-surface1/30 transition-colors">
                      <GitBranch size={12} className="text-ctp-mauve flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-ctp-subtext1 truncate">{s.title || s.id}</p>
                        <p className="text-[10px] text-ctp-overlay0">from {s.parent_title || s.parent_id} · {s.message_count} msgs · {s.model}</p>
                      </div>
                      <span className="text-[10px] text-ctp-overlay0">{timeAgo(s.started_at)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Toolset usage */}
          <div className="rounded-xl border border-ctp-surface0 bg-ctp-surface0/30 p-4">
            <p className="text-xs font-medium text-ctp-overlay2 mb-3">Toolset Usage</p>
            {sortedToolsets.length === 0 ? (
              <p className="text-xs text-ctp-overlay0">No toolset data</p>
            ) : (
              <div className="space-y-1.5">
                {sortedToolsets.map(([ts, count]) => (
                  <div key={ts} className="flex items-center justify-between">
                    <span className="text-[11px] text-ctp-subtext0">{ts}</span>
                    <span className="text-[11px] text-ctp-overlay1 font-mono">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Config */}
          <div className="rounded-xl border border-ctp-surface0 bg-ctp-surface0/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Settings size={12} className="text-ctp-overlay1" />
              <p className="text-xs font-medium text-ctp-overlay2">Config</p>
            </div>
            <ConfigViewer config={data.config as Record<string, unknown>} />
          </div>

          {/* Info */}
          <div className="rounded-xl border border-ctp-surface0 bg-ctp-surface0/30 p-4">
            <p className="text-xs font-medium text-ctp-overlay2 mb-2">How it works</p>
            <div className="space-y-1.5 text-[11px] text-ctp-overlay1">
              <p>• Parent spawns isolated child agents</p>
              <p>• Up to 3 concurrent tasks (batch mode)</p>
              <p>• Max depth: 2 (no grandchildren)</p>
              <p>• 50 turns per subagent (default)</p>
              <p>• Only final summary returns to parent</p>
              <p>• Blocked: delegation, clarify, memory</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ctp-surface0 bg-ctp-surface0/30 p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] text-ctp-overlay0 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-bold text-ctp-text">{value}</p>
    </div>
  );
}
