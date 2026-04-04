'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Zap, Clock, ChevronDown, ChevronRight,
  CheckCircle, XCircle, Send, Hash, Radio,
  MessageSquare, AlertTriangle, Users, GitBranch, Layers,
  Settings, ArrowRight, Code, FileCode,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────

interface CronJob {
  id: string;
  name: string;
  prompt: string;
  skills: string[];
  model: string | null;
  provider: string | null;
  schedule_display: string;
  repeat: { times: number | null; completed: number };
  enabled: boolean;
  state: string;
  paused_at: string | null;
  paused_reason: string | null;
  created_at: string;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  deliver: string;
}

interface CronOutput {
  file: string;
  content: string;
  date: string;
}

interface CronsData {
  jobs: CronJob[];
  outputs: Record<string, CronOutput[]>;
  updatedAt: string;
}

interface Channel {
  id: string;
  name: string;
  type: string;
  thread_id: string | null;
}

interface ChannelsData {
  channels: Record<string, Channel[]>;
  updatedAt: string | null;
  cronWrapResponse: boolean;
}

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

interface DelegationData {
  delegations: DelegationCall[];
  totalCalls: number;
  batchCalls: number;
  singleCalls: number;
  toolsetUsage: Record<string, number>;
  subagentSessions: { id: string; title: string; model: string; started_at: string; message_count: number; parent_title: string; parent_id: string }[];
  subagentCount: number;
  config: Record<string, unknown>;
}

interface CodeExecCall {
  session_id: string;
  session_title: string;
  source: string;
  timestamp: string;
  line_count: number;
  imports: string[];
  code_preview: string;
}

interface CodeExecData {
  executions: CodeExecCall[];
  totalCalls: number;
  bySource: Record<string, number>;
  byDay: Record<string, number>;
  toolImports: Record<string, number>;
  avgLines: number;
  maxLines: number;
  config: { timeout: number; maxToolCalls: number };
}

// ─── Helpers ─────────────────────────────────────────────

function sourceColor(source: string): string {
  switch (source) {
    case 'cli': return 'text-purple-400 bg-indigo-500/10 border-indigo-400/20';
    case 'telegram': return 'text-sky-400 bg-sky-400/10 border-sky-400/20';
    case 'cron': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    default: return 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20';
  }
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'never';
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

function timeUntil(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  if (diffMs < 0) return 'overdue';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h ${mins % 60}m`;
  return `in ${Math.floor(hrs / 24)}d`;
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === 'ok') {
    return <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-400/10 text-green-400 border border-green-500/20"><CheckCircle size={10} /> ok</span>;
  }
  if (status === 'error') {
    return <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20"><XCircle size={10} /> error</span>;
  }
  return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-500/10 text-neutral-500 border border-neutral-500/20">{status || '—'}</span>;
}

function platformColor(platform: string): string {
  switch (platform) {
    case 'telegram': return 'text-sky-400 bg-sky-400/10 border-sky-400/20';
    case 'discord': return 'text-purple-400 bg-indigo-400/10 border-indigo-400/20';
    case 'whatsapp': return 'text-green-400 bg-green-400/10 border-green-500/20';
    case 'slack': return 'text-purple-400 bg-indigo-500/10 border-indigo-400/20';
    case 'signal': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    case 'email': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    case 'sms': return 'text-pink-400 bg-pink-400/10 border-pink-400/20';
    default: return 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20';
  }
}

// ─── Cron Output Viewer ──────────────────────────────────

function OutputViewer({ outputs }: { outputs: CronOutput[] }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  if (!outputs || outputs.length === 0) {
    return <p className="text-xs text-neutral-600 py-2">No output history</p>;
  }

  const selected = outputs[selectedIdx];
  let displayContent = selected.content;
  const responseMatch = displayContent.match(/## Response\n\n([\s\S]*)/);
  if (responseMatch) displayContent = responseMatch[1].trim();

  return (
    <div>
      {outputs.length > 1 && (
        <div className="flex gap-1 mb-2 overflow-x-auto">
          {outputs.map((o, i) => (
            <button
              key={o.file}
              onClick={() => setSelectedIdx(i)}
              className={`text-[10px] px-2 py-0.5 rounded whitespace-nowrap transition-all ${
                i === selectedIdx ? 'bg-indigo-500/[0.15] text-indigo-300' : 'text-neutral-600 hover:text-neutral-400'
              }`}
            >
              {o.date.slice(0, 16)}
            </button>
          ))}
        </div>
      )}
      <pre className="text-[11px] font-mono text-neutral-300 bg-black/20 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap leading-relaxed">
        {displayContent || '[SILENT]'}
      </pre>
    </div>
  );
}

// ─── Cron Job Card ───────────────────────────────────────

function JobCard({ job, outputs }: { job: CronJob; outputs: CronOutput[] }) {
  const [expanded, setExpanded] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <div className={`rounded-xl border bg-white/[0.02] ${job.enabled ? 'border-white/[0.06]' : 'border-white/[0.06] opacity-60'}`}>
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          job.enabled ? 'bg-amber-400/10 border border-amber-400/20' : 'bg-neutral-500/10 border border-neutral-500/20'
        }`}>
          <Zap size={15} className={job.enabled ? 'text-amber-400' : 'text-neutral-600'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{job.name}</h3>
            {!job.enabled && (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-neutral-500/10 text-neutral-500 border border-neutral-500/20">paused</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-neutral-500">
            <span className="flex items-center gap-1"><Clock size={10} /> {job.schedule_display}</span>
            <span className="flex items-center gap-1"><Send size={10} /> {job.deliver}</span>
            <span className="flex items-center gap-1"><Hash size={10} /> {job.repeat.completed} runs</span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <StatusBadge status={job.last_status} />
          <span className="text-neutral-600">{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-white/[0.06]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4">
            <TimingItem label="Last Run" value={timeAgo(job.last_run_at)} />
            <TimingItem label="Next Run" value={timeUntil(job.next_run_at)} />
            <TimingItem label="Created" value={timeAgo(job.created_at)} />
            <TimingItem label="State" value={job.state} />
          </div>

          {job.last_error && (
            <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-3 mb-3">
              <p className="text-[11px] text-red-400">{job.last_error}</p>
            </div>
          )}

          {job.paused_reason && (
            <div className="rounded-lg bg-amber-400/5 border border-amber-400/20 p-3 mb-3">
              <p className="text-[11px] text-amber-400">Paused: {job.paused_reason}</p>
            </div>
          )}

          {(job.model || job.provider) && (
            <p className="text-[11px] text-neutral-500 mb-3">
              {job.model && `Model: ${job.model}`}
              {job.model && job.provider && ' · '}
              {job.provider && `Provider: ${job.provider}`}
            </p>
          )}

          {job.skills && job.skills.length > 0 && (
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-[10px] text-neutral-600">Skills:</span>
              {job.skills.map(s => (
                <span key={s} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/10 text-purple-400 border border-indigo-400/20">{s}</span>
              ))}
            </div>
          )}

          <div className="mb-4">
            <button
              onClick={() => setShowPrompt(!showPrompt)}
              className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 mb-1"
            >
              {showPrompt ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              Prompt
            </button>
            {showPrompt && (
              <pre className="text-[11px] font-mono text-neutral-400 bg-black/20 rounded-lg p-3 whitespace-pre-wrap leading-relaxed max-h-48 overflow-auto">
                {job.prompt}
              </pre>
            )}
          </div>

          <div>
            <p className="text-[11px] font-medium text-neutral-500 mb-2">Recent Output</p>
            <OutputViewer outputs={outputs} />
          </div>
        </div>
      )}
    </div>
  );
}

function TimingItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] text-neutral-600 uppercase tracking-wider">{label}</p>
      <p className="text-xs text-neutral-300 font-medium mt-0.5">{value}</p>
    </div>
  );
}

// ─── Delivery Tab ────────────────────────────────────────

function DeliveryTab({ channels, cronWrapResponse }: { channels: Record<string, Channel[]>; cronWrapResponse: boolean }) {
  const platforms = Object.entries(channels);
  const totalChannels = platforms.reduce((a, [, chs]) => a + chs.length, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[9px] text-neutral-600 uppercase tracking-wider">Platforms</p>
          <p className="text-lg font-bold text-white mt-0.5">{platforms.length}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[9px] text-neutral-600 uppercase tracking-wider">Channels</p>
          <p className="text-lg font-bold text-white mt-0.5">{totalChannels}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[9px] text-neutral-600 uppercase tracking-wider">Wrap Response</p>
          <p className="text-lg font-bold text-white mt-0.5">{cronWrapResponse ? 'On' : 'Off'}</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white">Channel Directory</h3>
          <p className="text-[10px] text-neutral-600 mt-0.5">Known delivery targets for cron jobs and messages</p>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {platforms.map(([platform, chs]) => (
            <div key={platform} className="px-5 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${platformColor(platform)}`}>
                  {platform}
                </span>
                <span className="text-[10px] text-neutral-600">{chs.length} channel{chs.length !== 1 ? 's' : ''}</span>
              </div>
              {chs.length === 0 ? (
                <p className="text-xs text-neutral-700 pl-1">No channels registered</p>
              ) : (
                <div className="space-y-1.5 pl-1">
                  {chs.map(ch => (
                    <div key={ch.id} className="flex items-center gap-3">
                      <Radio size={10} className="text-neutral-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-neutral-300">{ch.name || ch.id}</p>
                        <p className="text-[10px] text-neutral-600 font-mono">{ch.type} · {ch.id}{ch.thread_id ? ` · thread ${ch.thread_id}` : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-xs font-medium text-neutral-400 mb-2">Delivery Targets</p>
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">origin</span>
            <span className="text-neutral-400">Returns to creating platform</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">local</span>
            <span className="text-neutral-400">Saves to ~/.hermes/cron/output/</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">telegram</span>
            <span className="text-neutral-400">Sends to home channel</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">telegram:&lt;id&gt;</span>
            <span className="text-neutral-400">Sends to specific chat</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delegation Tab ──────────────────────────────────────

function DelegationTab({ data }: { data: DelegationData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Total" value={String(data.totalCalls)} icon={<Users size={13} className="text-purple-400" />} />
        <MiniStat label="Single" value={String(data.singleCalls)} icon={<GitBranch size={13} className="text-blue-400" />} />
        <MiniStat label="Batch" value={String(data.batchCalls)} icon={<Layers size={13} className="text-amber-400" />} />
        <MiniStat label="Subagents" value={String(data.subagentCount)} icon={<Users size={13} className="text-green-400" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {data.delegations.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
              <Users size={24} className="text-neutral-600 mx-auto mb-2" />
              <p className="text-neutral-500 text-sm">No delegations yet</p>
              <p className="text-neutral-600 text-xs mt-1">Hermes uses delegate_task automatically for complex subtasks</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {data.delegations.map((d, i) => (
                <DelegationCard key={`${d.session_id}-${i}`} d={d} />
              ))}
            </div>
          )}

          {data.subagentSessions.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-neutral-400 mb-2">Subagent Sessions</p>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                {data.subagentSessions.map(s => (
                  <Link key={s.id} href={`/session/${s.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors">
                    <GitBranch size={12} className="text-purple-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-neutral-200 truncate">{s.title || s.id}</p>
                      <p className="text-[10px] text-neutral-600">from {s.parent_title || s.parent_id} · {s.message_count} msgs</p>
                    </div>
                    <span className="text-[10px] text-neutral-600">{timeAgo(s.started_at)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {Object.keys(data.toolsetUsage).length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs font-medium text-neutral-400 mb-2">Toolset Usage</p>
              <div className="space-y-1">
                {Object.entries(data.toolsetUsage).sort((a, b) => b[1] - a[1]).map(([ts, cnt]) => (
                  <div key={ts} className="flex items-center justify-between">
                    <span className="text-[11px] text-neutral-300">{ts}</span>
                    <span className="text-[11px] text-neutral-500 font-mono">{cnt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Settings size={11} className="text-neutral-500" />
              <p className="text-xs font-medium text-neutral-400">Config</p>
            </div>
            <div className="space-y-1">
              {Object.entries(data.config).filter(([, v]) => v !== '' && v !== null).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-500 font-mono">{k}</span>
                  <span className="text-[10px] text-neutral-300 font-mono">{Array.isArray(v) ? (v as string[]).join(', ') : String(v)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs font-medium text-neutral-400 mb-2">How it works</p>
            <div className="space-y-1 text-[11px] text-neutral-500">
              <p>• Spawns isolated child agents</p>
              <p>• Up to 3 concurrent (batch)</p>
              <p>• Max depth: 2</p>
              <p>• 50 turns per subagent</p>
              <p>• Only summary returns to parent</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DelegationCard({ d }: { d: DelegationCall }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left">
        <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${d.mode === 'batch' ? 'bg-amber-400/10 border border-amber-400/20' : 'bg-indigo-500/10 border border-indigo-500/20'}`}>
          {d.mode === 'batch' ? <Layers size={11} className="text-amber-400" /> : <GitBranch size={11} className="text-purple-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-neutral-200 truncate">{d.goal}</p>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-600">
            <span>{d.mode === 'batch' ? `${d.tasks.length} parallel tasks` : 'single task'}</span>
            {d.toolsets.length > 0 && <span>· {d.toolsets.join(', ')}</span>}
          </div>
        </div>
        <span className="text-[10px] text-neutral-600 flex-shrink-0">{timeAgo(d.timestamp)}</span>
        {expanded ? <ChevronDown size={12} className="text-neutral-600" /> : <ChevronRight size={12} className="text-neutral-600" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/[0.06] pt-3 space-y-3">
          {d.tasks.length > 0 && (
            <div>
              <p className="text-[10px] text-neutral-600 uppercase tracking-wider mb-1.5">Tasks</p>
              {d.tasks.map((t, i) => (
                <div key={i} className="flex items-start gap-2 px-2.5 py-1.5 rounded bg-white/[0.02] border border-white/[0.06] mb-1">
                  <span className="text-[10px] text-neutral-700 font-mono mt-0.5">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-neutral-300">{t.goal}</p>
                    {t.toolsets && t.toolsets.length > 0 && (
                      <div className="flex gap-1 mt-1">{t.toolsets.map(ts => <span key={ts} className="text-[9px] px-1 py-0.5 rounded bg-white/[0.04] text-neutral-500">{ts}</span>)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {d.context_preview && (
            <div>
              <p className="text-[10px] text-neutral-600 uppercase tracking-wider mb-1">Context</p>
              <p className="text-[11px] text-neutral-400 bg-black/20 rounded px-2.5 py-1.5">{d.context_preview}{d.context_preview.length >= 200 ? '...' : ''}</p>
            </div>
          )}
          <Link href={`/session/${d.session_id}`} className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-indigo-300">
            {d.session_title} <ArrowRight size={10} />
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Code Execution Tab ──────────────────────────────────

function CodeExecTab({ data }: { data: CodeExecData }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Total Runs" value={String(data.totalCalls)} icon={<Code size={13} className="text-amber-400" />} />
        <MiniStat label="Avg Lines" value={String(data.avgLines)} icon={<FileCode size={13} className="text-blue-400" />} />
        <MiniStat label="Max Lines" value={String(data.maxLines)} icon={<FileCode size={13} className="text-purple-400" />} />
        <MiniStat label="Timeout" value={`${data.config.timeout}s`} icon={<Clock size={13} className="text-neutral-400" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <p className="text-xs font-medium text-neutral-400 mb-2">Recent Executions</p>
          {data.executions.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
              <Code size={24} className="text-neutral-600 mx-auto mb-2" />
              <p className="text-neutral-500 text-sm">No code executions yet</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {data.executions.slice(0, 20).map((ex, i) => (
                <div key={`${ex.session_id}-${i}`} className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                  <button
                    onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors text-left"
                  >
                    <Code size={12} className="text-amber-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-neutral-200 truncate">{ex.session_title}</p>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-600">
                        <span>{ex.line_count} lines</span>
                        {ex.imports.length > 0 && <span>· {ex.imports.join(', ')}</span>}
                      </div>
                    </div>
                    <span className={`text-[9px] font-medium px-1 py-0.5 rounded border flex-shrink-0 ${sourceColor(ex.source)}`}>{ex.source}</span>
                    <span className="text-[10px] text-neutral-600 flex-shrink-0">{timeAgo(ex.timestamp)}</span>
                  </button>
                  {expandedIdx === i && (
                    <div className="px-4 pb-3 border-t border-white/[0.06] pt-2">
                      <pre className="text-[10px] font-mono text-neutral-400 bg-black/20 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap leading-relaxed">
                        {ex.code_preview}{ex.code_preview.length >= 300 ? '\n...' : ''}
                      </pre>
                      <Link href={`/session/${ex.session_id}`} className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-indigo-300 mt-2">
                        View session <ArrowRight size={10} />
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {Object.keys(data.toolImports).length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs font-medium text-neutral-400 mb-2">Tool Imports</p>
              <div className="space-y-1">
                {Object.entries(data.toolImports).sort((a, b) => b[1] - a[1]).map(([tool, cnt]) => (
                  <div key={tool} className="flex items-center justify-between">
                    <span className="text-[11px] text-neutral-300 font-mono">{tool}</span>
                    <span className="text-[11px] text-neutral-500 font-mono">{cnt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(data.bySource).length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs font-medium text-neutral-400 mb-2">By Source</p>
              <div className="space-y-1">
                {Object.entries(data.bySource).sort((a, b) => b[1] - a[1]).map(([src, cnt]) => (
                  <div key={src} className="flex items-center justify-between">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${sourceColor(src)}`}>{src}</span>
                    <span className="text-[11px] text-neutral-500 font-mono">{cnt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs font-medium text-neutral-400 mb-2">Limits</p>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between"><span className="text-neutral-500">Timeout</span><span className="text-neutral-300 font-mono">{data.config.timeout}s</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Max tool calls</span><span className="text-neutral-300 font-mono">{data.config.maxToolCalls}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Max stdout</span><span className="text-neutral-300 font-mono">50 KB</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Max stderr</span><span className="text-neutral-300 font-mono">10 KB</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-[10px] text-neutral-600 uppercase tracking-wider">{label}</span></div>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────

export default function AutomationPage() {
  const [tab, setTab] = useState<'crons' | 'delegation' | 'code' | 'delivery'>('crons');
  const [cronsData, setCronsData] = useState<CronsData | null>(null);
  const [channelsData, setChannelsData] = useState<ChannelsData | null>(null);
  const [delegationData, setDelegationData] = useState<DelegationData | null>(null);
  const [codeExecData, setCodeExecData] = useState<CodeExecData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [cronsRes, channelsRes, delegationRes, codeRes] = await Promise.all([
          fetch('/api/crons'),
          fetch('/api/automation/channels'),
          fetch('/api/delegation'),
          fetch('/api/automation/code-execution'),
        ]);
        setCronsData(await cronsRes.json());
        setChannelsData(await channelsRes.json());
        setDelegationData(await delegationRes.json());
        setCodeExecData(await codeRes.json());
      } catch {}
      setLoading(false);
    };
    fetchAll();
    const iv = setInterval(fetchAll, 30000);
    return () => clearInterval(iv);
  }, []);

  const jobs = cronsData?.jobs || [];
  const activeJobs = jobs.filter(j => j.enabled);
  const pausedJobs = jobs.filter(j => !j.enabled);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-3"><Zap size={20} className="text-purple-400" /><h1 className="text-xl font-bold text-white">Automation</h1></div>
          <p className="text-sm text-neutral-500 mt-0.5">
            {activeJobs.length} active cron{activeJobs.length !== 1 ? 's' : ''}
            {pausedJobs.length > 0 ? ` · ${pausedJobs.length} paused` : ''}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg bg-white/[0.04] p-0.5 mb-5 w-fit">
        {[
          { id: 'crons' as const, label: 'Cron Jobs', icon: <Zap size={12} /> },
          { id: 'delegation' as const, label: 'Delegation', icon: <Users size={12} /> },
          { id: 'code' as const, label: 'Code Exec', icon: <Code size={12} /> },
          { id: 'delivery' as const, label: 'Delivery', icon: <Send size={12} /> },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === t.id
                ? 'bg-indigo-500/[0.15] text-indigo-300'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white/[0.03] rounded-xl" />)}
        </div>
      ) : tab === 'crons' ? (
        /* Crons tab */
        jobs.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <Zap size={24} className="text-neutral-600 mx-auto mb-2" />
            <p className="text-neutral-500 text-sm">No cron jobs configured</p>
            <p className="text-neutral-600 text-xs mt-1">Create one with: hermes cron create</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map(job => (
              <JobCard key={job.id} job={job} outputs={cronsData?.outputs[job.id] || []} />
            ))}
          </div>
        )
      ) : tab === 'delegation' ? (
        delegationData ? (
          <DelegationTab data={delegationData} />
        ) : (
          <p className="text-neutral-500 text-sm">Failed to load delegation data</p>
        )
      ) : tab === 'code' ? (
        codeExecData ? (
          <CodeExecTab data={codeExecData} />
        ) : (
          <p className="text-neutral-500 text-sm">Failed to load code execution data</p>
        )
      ) : (
        /* Delivery tab */
        channelsData ? (
          <DeliveryTab channels={channelsData.channels} cronWrapResponse={channelsData.cronWrapResponse} />
        ) : (
          <p className="text-neutral-500 text-sm">Failed to load channels</p>
        )
      )}
    </div>
  );
}
