'use client';

import { useState, useEffect } from 'react';
import {
  Brain, User, Sparkles, FileText, ChevronDown, ChevronUp,
} from 'lucide-react';

/* ─── types ─── */

interface MemoryStore {
  content: string;
  entries: string[];
  charCount: number;
  charLimit: number;
  enabled: boolean;
}

interface SoulStore {
  content: string;
  charCount: number;
}

interface MemoryData {
  memory: MemoryStore;
  user: MemoryStore;
  soul: SoulStore;
  config: {
    nudgeInterval: number;
    flushMinTurns: number;
  };
}

interface ContextFile {
  name: string;
  displayPath: string;
  content: string;
  charCount: number;
  truncated: boolean;
  priority: string;
}

/* ─── shared helpers ─── */

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const color = pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-400' : 'bg-indigo-500';
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-neutral-600">{used.toLocaleString()} / {limit.toLocaleString()} chars</span>
        <span className={`text-[10px] font-medium ${pct > 90 ? 'text-red-400' : pct > 75 ? 'text-amber-400' : 'text-neutral-500'}`}>{pct}%</span>
      </div>
      <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MemoryEntry({ text }: { text: string }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.08] transition-colors">
      <p className="text-[12px] text-neutral-300 whitespace-pre-wrap leading-relaxed">{text}</p>
    </div>
  );
}

function MemoryPanel({ title, icon, store, color }: {
  title: string;
  icon: React.ReactNode;
  store: MemoryStore;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
            {icon}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            <p className="text-[10px] text-neutral-600">
              {store.entries.length} entries
              {!store.enabled && ' · disabled'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <UsageBar used={store.charCount} limit={store.charLimit} />
        <div className="mt-4 space-y-2">
          {store.entries.length === 0 ? (
            <p className="text-xs text-neutral-600 text-center py-4">No entries</p>
          ) : (
            store.entries.map((entry, i) => (
              <MemoryEntry key={i} text={entry} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── context file card ─── */

const PRIORITY_COLORS: Record<string, string> = {
  highest: 'text-purple-400 bg-indigo-500/10 border-indigo-400/20',
  high:    'text-blue-400 bg-blue-400/10 border-blue-400/20',
  medium:  'text-amber-400 bg-amber-400/10 border-amber-400/20',
  low:     'text-neutral-400 bg-neutral-400/10 border-neutral-400/20',
};

function ContextFileCard({ file }: { file: ContextFile }) {
  const [expanded, setExpanded] = useState(false);
  const badgeColor = PRIORITY_COLORS[file.priority] ?? PRIORITY_COLORS.low;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {/* header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <FileText size={13} className="text-purple-400" />
          </div>
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white">{file.name}</span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${badgeColor}`}>
                {file.priority}
              </span>
              {file.truncated && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border text-amber-400 bg-amber-400/10 border-amber-400/20">
                  truncated
                </span>
              )}
            </div>
            <p className="text-[10px] text-neutral-600 font-mono mt-0.5 truncate">{file.displayPath}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          <span className="text-[10px] text-neutral-600">{file.charCount.toLocaleString()} chars</span>
          {expanded
            ? <ChevronUp size={14} className="text-neutral-500" />
            : <ChevronDown size={14} className="text-neutral-500" />}
        </div>
      </button>

      {/* content */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-white/[0.06]">
          <pre className="text-[11px] font-mono text-neutral-300 bg-black/20 rounded-lg p-4 overflow-auto max-h-96 whitespace-pre-wrap leading-relaxed mt-4">
            {file.content}
          </pre>
        </div>
      )}
    </div>
  );
}

function ContextPanel({ files, loading }: { files: ContextFile[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-16 bg-white/[0.03] rounded-xl" />
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
        <FileText size={24} className="text-neutral-600 mx-auto mb-2" />
        <p className="text-sm text-neutral-500">No context files found</p>
        <p className="text-xs text-neutral-600 mt-1">
          Create an AGENTS.md or .hermes.md in your project directory
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {files.map(f => (
        <ContextFileCard key={f.displayPath} file={f} />
      ))}
      <p className="text-[10px] text-neutral-600 px-1 pt-1">
        Priority order: .hermes.md → AGENTS.md → CLAUDE.md → .cursorrules · Only one project context type loads per session
      </p>
    </div>
  );
}

/* ─── page ─── */

type Tab = 'memory' | 'user' | 'soul' | 'context';

const TABS: { id: Tab; label: string }[] = [
  { id: 'memory',  label: 'Agent Memory' },
  { id: 'user',    label: 'User Profile' },
  { id: 'soul',    label: 'Personality' },
  { id: 'context', label: 'Context Files' },
];

export default function MemoryPage() {
  const [data, setData] = useState<MemoryData | null>(null);
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('memory');

  useEffect(() => {
    const fetchMemory = async () => {
      try {
        const res = await fetch('/api/memory');
        setData(await res.json());
      } catch {}
      setLoading(false);
    };
    fetchMemory();
  }, []);

  // Lazy-load context files only when tab is first opened
  useEffect(() => {
    if (activeTab !== 'context') return;
    if (contextFiles.length > 0) return;
    const fetchContext = async () => {
      setContextLoading(true);
      try {
        const res = await fetch('/api/context');
        const d = await res.json();
        setContextFiles(d.files || []);
      } catch {}
      setContextLoading(false);
    };
    fetchContext();
  }, [activeTab]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto animate-pulse">
        <div className="h-8 bg-white/[0.04] rounded-lg w-48 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-64 bg-white/[0.03] rounded-xl" />
          <div className="h-64 bg-white/[0.03] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-3">
            <Brain size={20} className="text-purple-400" />
            <h1 className="text-xl font-bold text-white">Memory</h1>
          </div>
          <p className="text-sm text-neutral-500 mt-0.5">
            {data.memory.entries.length + data.user.entries.length} entries ·
            nudge every {data.config.nudgeInterval} turns ·
            flush after {data.config.flushMinTurns} turns
          </p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-lg bg-white/[0.04] p-0.5 mb-5 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-indigo-500/[0.15] text-indigo-300'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'memory' && (
        <MemoryPanel
          title="Agent Memory"
          icon={<Brain size={14} className="text-purple-400" />}
          store={data.memory}
          color="bg-indigo-500/10 border border-indigo-500/20"
        />
      )}

      {activeTab === 'user' && (
        <MemoryPanel
          title="User Profile"
          icon={<User size={14} className="text-purple-400" />}
          store={data.user}
          color="bg-indigo-500/10 border border-indigo-400/20"
        />
      )}

      {/* Personality / SOUL.md */}
      {activeTab === 'soul' && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
              <Sparkles size={14} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Personality</h2>
              <p className="text-[10px] text-neutral-600">SOUL.md · {data.soul.charCount} chars</p>
            </div>
          </div>
          <div className="p-4">
            {data.soul.content ? (
              <pre className="text-[12px] font-mono text-neutral-300 bg-black/20 rounded-lg p-4 overflow-auto max-h-96 whitespace-pre-wrap leading-relaxed">
                {data.soul.content}
              </pre>
            ) : (
              <p className="text-xs text-neutral-600 text-center py-4">No SOUL.md found</p>
            )}
          </div>
        </div>
      )}

      {/* Context Files */}
      {activeTab === 'context' && (
        <ContextPanel files={contextFiles} loading={contextLoading} />
      )}
    </div>
  );
}
