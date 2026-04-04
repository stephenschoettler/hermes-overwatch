'use client';

import { useState, useEffect } from 'react';
import {
  Settings, ChevronDown, ChevronRight, Shield, Eye, EyeOff,
  Cpu, Terminal, Palette, Volume2, Mic, Brain, Globe,
  Plug, Users, Shrink, Zap, Lock,
} from 'lucide-react';

interface ConfigData {
  sections: Record<string, Record<string, unknown>>;
  mcpServerNames: string[];
  configVersion: number;
  full: Record<string, unknown>;
}

const SECTION_META: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  model:       { label: 'Model',       icon: <Cpu size={13} />,      description: 'Default model and provider' },
  display:     { label: 'Display',     icon: <Palette size={13} />,  description: 'UI preferences and personality' },
  terminal:    { label: 'Terminal',     icon: <Terminal size={13} />, description: 'Shell backend and timeouts' },
  tts:         { label: 'TTS',         icon: <Volume2 size={13} />,  description: 'Text-to-speech configuration' },
  stt:         { label: 'STT',         icon: <Mic size={13} />,      description: 'Speech-to-text configuration' },
  memory:      { label: 'Memory',      icon: <Brain size={13} />,    description: 'Memory and user profile settings' },
  browser:     { label: 'Browser',     icon: <Globe size={13} />,    description: 'Browser automation settings' },
  mcp_servers: { label: 'MCP Servers', icon: <Plug size={13} />,     description: 'Model Context Protocol servers' },
  delegation:  { label: 'Delegation',  icon: <Users size={13} />,    description: 'Subagent delegation settings' },
  compression: { label: 'Compression', icon: <Shrink size={13} />,   description: 'Context compression settings' },
  cron:        { label: 'Cron',        icon: <Zap size={13} />,      description: 'Cron job settings' },
  security:    { label: 'Security',    icon: <Lock size={13} />,     description: 'Security and redaction' },
};

function renderValue(value: unknown, depth = 0): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-neutral-700">null</span>;
  }
  if (typeof value === 'boolean') {
    return <span className={value ? 'text-green-400' : 'text-red-400'}>{String(value)}</span>;
  }
  if (typeof value === 'number') {
    return <span className="text-amber-400">{value}</span>;
  }
  if (typeof value === 'string') {
    if (value === '••••••••') {
      return <span className="text-red-400/50 italic">••••••••</span>;
    }
    if (value === '') {
      return <span className="text-neutral-700">""</span>;
    }
    return <span className="text-green-400">{value}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-neutral-700">[]</span>;
    if (value.every(v => typeof v === 'string') && value.length <= 8) {
      return (
        <span className="flex flex-wrap gap-1">
          {value.map((v, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-purple-400 border border-indigo-500/20">
              {String(v)}
            </span>
          ))}
        </span>
      );
    }
    return (
      <div className="ml-3 space-y-0.5">
        {value.map((v, i) => (
          <div key={i} className="flex items-start gap-1">
            <span className="text-neutral-700 text-[10px] mt-0.5">-</span>
            {renderValue(v, depth + 1)}
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-neutral-700">{'{}'}</span>;
    return (
      <div className={depth > 0 ? 'ml-3' : ''}>
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-start gap-2 py-0.5">
            <span className="text-neutral-500 text-[11px] font-mono flex-shrink-0">{k}:</span>
            <div className="flex-1 min-w-0 text-[11px] font-mono">{renderValue(v, depth + 1)}</div>
          </div>
        ))}
      </div>
    );
  }
  return <span className="text-neutral-400">{String(value)}</span>;
}

function ConfigSection({ sectionKey, data, defaultOpen = false }: {
  sectionKey: string;
  data: Record<string, unknown>;
  defaultOpen?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const meta = SECTION_META[sectionKey] || { label: sectionKey, icon: <Settings size={13} />, description: '' };
  const entryCount = Object.keys(data).length;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-neutral-400">
          {meta.icon}
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-neutral-200">{meta.label}</p>
          {meta.description && <p className="text-[10px] text-neutral-600">{meta.description}</p>}
        </div>
        <span className="text-[10px] text-neutral-600 font-mono">{entryCount} keys</span>
        {expanded ? <ChevronDown size={13} className="text-neutral-600" /> : <ChevronRight size={13} className="text-neutral-600" />}
      </button>
      {expanded && (
        <div className="px-5 pb-4 border-t border-white/[0.06]">
          <div className="mt-3">
            {renderValue(data)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConfigPage() {
  const [data, setData] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config');
        setData(await res.json());
      } catch {}
      setLoading(false);
    };
    fetchConfig();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse">
        <div className="h-8 bg-white/[0.04] rounded-lg w-48 mb-6" />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-white/[0.03] rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const sectionOrder = [
    'model', 'display', 'terminal', 'tts', 'stt', 'memory',
    'browser', 'mcp_servers', 'delegation', 'compression', 'cron', 'security',
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-3"><Settings size={20} className="text-purple-400" /><h1 className="text-xl font-bold text-white">Config</h1></div>
          <p className="text-sm text-neutral-500 mt-0.5">
            config.yaml · version {data.configVersion || '?'} · {data.mcpServerNames.length} MCP servers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <Shield size={11} className="text-green-400" />
            <span className="text-[10px] text-neutral-400">Secrets redacted</span>
          </div>
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.06] transition-all"
          >
            {showRaw ? <EyeOff size={11} /> : <Eye size={11} />}
            {showRaw ? 'Sections' : 'Raw YAML'}
          </button>
        </div>
      </div>

      {showRaw ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <pre className="text-[11px] font-mono text-neutral-300 bg-black/20 rounded-lg p-4 overflow-auto max-h-[70vh] whitespace-pre-wrap leading-relaxed">
            {JSON.stringify(data.full, null, 2)}
          </pre>
        </div>
      ) : (
        <div className="space-y-2">
          {sectionOrder.map(key => {
            const sectionData = data.sections[key];
            if (!sectionData || Object.keys(sectionData).length === 0) return null;
            return (
              <ConfigSection
                key={key}
                sectionKey={key}
                data={sectionData}
                defaultOpen={key === 'model'}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
