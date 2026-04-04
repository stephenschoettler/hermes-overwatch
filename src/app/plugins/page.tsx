'use client';

import { useState, useEffect } from 'react';
import {
  Plug, Package, CheckCircle, XCircle, AlertTriangle,
  ChevronDown, ChevronRight, FolderOpen, Key, GitBranch,
  Search, X,
} from 'lucide-react';

interface PluginInfo {
  name: string;
  version: string;
  description: string;
  location: 'user' | 'builtin' | 'pip';
  category: string;
  path: string;
  enabled: boolean;
  dependencies: string[];
  requiredEnv: string[];
  missingEnv: string[];
  hooks: string[];
  hasInit: boolean;
}

interface PluginsData {
  plugins: PluginInfo[];
  categories: Record<string, PluginInfo[]>;
  totalCount: number;
  enabledCount: number;
  userCount: number;
  builtinCount: number;
  hooks: string[];
  disabledNames: string[];
}

function locationBadge(loc: string) {
  switch (loc) {
    case 'user':
      return <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-ctp-mauve/10 text-ctp-mauve border border-ctp-mauve/20">user</span>;
    case 'builtin':
      return <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-ctp-blue/10 text-ctp-blue border border-ctp-blue/20">builtin</span>;
    case 'pip':
      return <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-ctp-green/10 text-ctp-green border border-ctp-green/20">pip</span>;
    default:
      return null;
  }
}

function PluginCard({ plugin }: { plugin: PluginInfo }) {
  const [expanded, setExpanded] = useState(false);
  const hasMissing = plugin.missingEnv.length > 0;

  return (
    <div className={`rounded-lg border bg-ctp-surface0/20 transition-colors ${
      plugin.enabled ? 'border-ctp-surface0 hover:border-ctp-surface1' : 'border-ctp-surface0/40 opacity-50'
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
          plugin.enabled
            ? hasMissing ? 'bg-ctp-yellow/10 border border-ctp-yellow/20' : 'bg-ctp-green/10 border border-ctp-green/20'
            : 'bg-ctp-overlay1/10 border border-ctp-overlay1/20'
        }`}>
          <Plug size={13} className={
            plugin.enabled
              ? hasMissing ? 'text-ctp-yellow' : 'text-ctp-green'
              : 'text-ctp-overlay0'
          } />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ctp-subtext1">{plugin.name}</span>
            <span className="text-[9px] text-ctp-overlay0 font-mono">{plugin.version}</span>
            {locationBadge(plugin.location)}
            {!plugin.enabled && (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-ctp-overlay1/10 text-ctp-overlay1 border border-ctp-overlay1/20">disabled</span>
            )}
            {hasMissing && plugin.enabled && (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-ctp-yellow/10 text-ctp-yellow border border-ctp-yellow/20 flex items-center gap-0.5">
                <AlertTriangle size={8} /> missing env
              </span>
            )}
          </div>
          <p className="text-[11px] text-ctp-overlay1 mt-0.5 truncate">{plugin.description}</p>
        </div>

        <span className="text-ctp-overlay0 flex-shrink-0">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-ctp-surface0/50 pt-3 space-y-3">
          {/* Hooks */}
          {plugin.hooks.length > 0 && (
            <div>
              <p className="text-[10px] text-ctp-overlay0 uppercase tracking-wider mb-1">Hooks</p>
              <div className="flex flex-wrap gap-1">
                {plugin.hooks.map(h => (
                  <span key={h} className="text-[10px] px-1.5 py-0.5 rounded bg-ctp-mauve/10 text-ctp-mauve border border-ctp-mauve/30 font-mono">{h}</span>
                ))}
              </div>
            </div>
          )}

          {/* Dependencies */}
          {plugin.dependencies.length > 0 && (
            <div>
              <p className="text-[10px] text-ctp-overlay0 uppercase tracking-wider mb-1">Dependencies</p>
              <div className="flex flex-wrap gap-1">
                {plugin.dependencies.map(d => (
                  <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-ctp-surface0/50 text-ctp-overlay2 font-mono">{d}</span>
                ))}
              </div>
            </div>
          )}

          {/* Required env */}
          {plugin.requiredEnv.length > 0 && (
            <div>
              <p className="text-[10px] text-ctp-overlay0 uppercase tracking-wider mb-1">Required Environment</p>
              <div className="flex flex-wrap gap-1">
                {plugin.requiredEnv.map(e => {
                  const missing = plugin.missingEnv.includes(e);
                  return (
                    <span key={e} className={`text-[10px] px-1.5 py-0.5 rounded font-mono flex items-center gap-1 ${
                      missing ? 'bg-ctp-red/10 text-ctp-red border border-ctp-red/20' : 'bg-ctp-green/10 text-ctp-green border border-ctp-green/20'
                    }`}>
                      {missing ? <XCircle size={8} /> : <CheckCircle size={8} />}
                      {e}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Path */}
          <div>
            <p className="text-[10px] text-ctp-overlay0 uppercase tracking-wider mb-1">Path</p>
            <p className="text-[10px] text-ctp-overlay1 font-mono break-all">{plugin.path}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PluginsPage() {
  const [data, setData] = useState<PluginsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const fetchPlugins = async () => {
      try {
        const res = await fetch('/api/plugins');
        setData(await res.json());
      } catch {}
      setLoading(false);
    };
    fetchPlugins();
  }, []);

  if (loading || !data) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse">
        <div className="h-8 bg-ctp-surface0/50 rounded-lg w-48 mb-6" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-ctp-surface0/40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const q = filter.toLowerCase();
  const filtered = q
    ? data.plugins.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    : data.plugins;

  // Group filtered by category
  const groupedCats: Record<string, PluginInfo[]> = {};
  for (const p of filtered) {
    if (!groupedCats[p.category]) groupedCats[p.category] = [];
    groupedCats[p.category].push(p);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-3"><Plug size={20} className="text-ctp-mauve" /><h1 className="text-xl font-bold text-ctp-text">Plugins</h1></div>
          <p className="text-sm text-ctp-overlay1 mt-0.5">
            {data.totalCount} plugins · {data.enabledCount} enabled · {data.builtinCount} builtin · {data.userCount} user
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total" value={String(data.totalCount)} icon={<Package size={13} className="text-ctp-mauve" />} />
        <StatCard label="Enabled" value={String(data.enabledCount)} icon={<CheckCircle size={13} className="text-ctp-green" />} />
        <StatCard label="Hooks" value={String(data.hooks.length)} icon={<GitBranch size={13} className="text-ctp-yellow" />} />
        <StatCard label="User" value={String(data.userCount)} icon={<FolderOpen size={13} className="text-ctp-mauve" />} />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1 bg-ctp-surface0/50 border border-ctp-surface1 rounded-lg overflow-hidden max-w-xs">
          <Search size={13} className="text-ctp-overlay0 ml-2.5" />
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter plugins..."
            className="bg-transparent text-sm text-ctp-text placeholder:text-ctp-overlay0 px-2 py-1.5 w-full focus:outline-none"
          />
          {filter && (
            <button onClick={() => setFilter('')} className="text-ctp-overlay0 hover:text-ctp-overlay2 pr-2">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {data.totalCount === 0 ? (
        <div className="rounded-xl border border-ctp-surface0 bg-ctp-surface0/30 p-8 text-center">
          <Plug size={28} className="text-ctp-overlay0 mx-auto mb-3" />
          <p className="text-ctp-overlay2 text-sm mb-1">No plugins installed</p>
          <p className="text-ctp-overlay0 text-xs">Add plugins to ~/.hermes/plugins/ or install with hermes plugins install</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(groupedCats).sort().map(([cat, plugins]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <FolderOpen size={13} className="text-ctp-yellow/70" />
                <span className="text-sm font-medium text-ctp-overlay2">{cat}</span>
                <span className="text-[10px] text-ctp-overlay0 font-mono">{plugins.length}</span>
              </div>
              <div className="space-y-1.5">
                {plugins.map(p => (
                  <PluginCard key={p.name} plugin={p} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Available hooks */}
      {data.hooks.length > 0 && (
        <div className="mt-6 rounded-xl border border-ctp-surface0 bg-ctp-surface0/30 p-4">
          <p className="text-xs font-medium text-ctp-overlay2 mb-2">Registered Hook Events</p>
          <div className="flex flex-wrap gap-1.5">
            {data.hooks.map(h => (
              <span key={h} className="text-[10px] px-2 py-0.5 rounded bg-ctp-mauve/10 text-ctp-mauve border border-ctp-mauve/30 font-mono">{h}</span>
            ))}
          </div>
        </div>
      )}
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
