'use client';

import { useState, useEffect } from 'react';
import {
  Zap, Clock, Play, Pause, ChevronDown, ChevronRight,
  CheckCircle, XCircle, Send, Calendar, Hash,
} from 'lucide-react';

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
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-400/10 text-green-400 border border-green-500/20">
        <CheckCircle size={10} /> ok
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
        <XCircle size={10} /> error
      </span>
    );
  }
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-500/10 text-neutral-500 border border-neutral-500/20">
      {status || '—'}
    </span>
  );
}

function OutputViewer({ outputs }: { outputs: CronOutput[] }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  if (!outputs || outputs.length === 0) {
    return <p className="text-xs text-neutral-600 py-2">No output history</p>;
  }

  const selected = outputs[selectedIdx];

  // Extract the response section from the markdown output
  let displayContent = selected.content;
  const responseMatch = displayContent.match(/## Response\n\n([\s\S]*)/);
  if (responseMatch) {
    displayContent = responseMatch[1].trim();
  }

  return (
    <div>
      {outputs.length > 1 && (
        <div className="flex gap-1 mb-2 overflow-x-auto">
          {outputs.map((o, i) => (
            <button
              key={o.file}
              onClick={() => setSelectedIdx(i)}
              className={`text-[10px] px-2 py-0.5 rounded whitespace-nowrap transition-all ${
                i === selectedIdx
                  ? 'bg-indigo-500/[0.15] text-indigo-300'
                  : 'text-neutral-600 hover:text-neutral-400'
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

function JobCard({ job, outputs }: { job: CronJob; outputs: CronOutput[] }) {
  const [expanded, setExpanded] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <div className={`rounded-xl border bg-white/[0.02] ${job.enabled ? 'border-white/[0.06]' : 'border-white/[0.06]/50 opacity-60'}`}>
      {/* Header */}
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
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-neutral-500/10 text-neutral-500 border border-neutral-500/20">
                paused
              </span>
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
          <span className="text-[10px] text-neutral-600">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-white/[0.06]/50">
          {/* Timing info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4">
            <TimingItem label="Last Run" value={timeAgo(job.last_run_at)} />
            <TimingItem label="Next Run" value={timeUntil(job.next_run_at)} />
            <TimingItem label="Created" value={timeAgo(job.created_at)} />
            <TimingItem label="State" value={job.state} />
          </div>

          {/* Error */}
          {job.last_error && (
            <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-3 mb-3">
              <p className="text-[11px] text-red-400">{job.last_error}</p>
            </div>
          )}

          {/* Pause reason */}
          {job.paused_reason && (
            <div className="rounded-lg bg-amber-400/5 border border-amber-400/20 p-3 mb-3">
              <p className="text-[11px] text-amber-400">Paused: {job.paused_reason}</p>
            </div>
          )}

          {/* Model/Provider */}
          {(job.model || job.provider) && (
            <p className="text-[11px] text-neutral-500 mb-3">
              {job.model && `Model: ${job.model}`}
              {job.model && job.provider && ' · '}
              {job.provider && `Provider: ${job.provider}`}
            </p>
          )}

          {/* Skills */}
          {job.skills && job.skills.length > 0 && (
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-[10px] text-neutral-600">Skills:</span>
              {job.skills.map(s => (
                <span key={s} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/10 text-purple-400 border border-indigo-400/20">
                  {s}
                </span>
              ))}
            </div>
          )}

          {/* Prompt */}
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

          {/* Output history */}
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

export default function CronsPage() {
  const [data, setData] = useState<CronsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCrons = async () => {
      try {
        const res = await fetch('/api/crons');
        setData(await res.json());
      } catch {}
      setLoading(false);
    };
    fetchCrons();
    const iv = setInterval(fetchCrons, 30000);
    return () => clearInterval(iv);
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse">
        <div className="h-8 bg-white/[0.04] rounded-lg w-48 mb-6" />
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <div key={i} className="h-24 bg-white/[0.03] rounded-xl" />)}
        </div>
      </div>
    );
  }

  const jobs = data?.jobs || [];
  const activeJobs = jobs.filter(j => j.enabled);
  const pausedJobs = jobs.filter(j => !j.enabled);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-3"><Clock size={20} className="text-purple-400" /><h1 className="text-xl font-bold text-white">Crons</h1></div>
          <p className="text-sm text-neutral-500 mt-0.5">
            {activeJobs.length} active{pausedJobs.length > 0 ? ` · ${pausedJobs.length} paused` : ''}
          </p>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <Zap size={24} className="text-neutral-600 mx-auto mb-2" />
          <p className="text-neutral-500 text-sm">No cron jobs configured</p>
          <p className="text-neutral-600 text-xs mt-1">Create one with: hermes cron create</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <JobCard key={job.id} job={job} outputs={data?.outputs[job.id] || []} />
          ))}
        </div>
      )}
    </div>
  );
}
