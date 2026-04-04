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
      return <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/10 text-purple-400 border border-indigo-400/20">user</span>;
    case 'builtin':
      return <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-blue-400/10 text-blue-400 border border-blue-400/20">builtin</span>;
    case 'pip':
      return <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-green-400/10 text-green-400 border border-green-500/20">pip</span>;
    default:
      return null;
  }
}

function PluginCard({ plugin }: { plugin: PluginInfo }) {
  const [expanded, setExpanded] = useState(false);
  const hasMissing = plugin.missingEnv.length > 0;

  return (
    <div className={`rounded-lg border bg-white/[0.02] transition-colors ${
      plugin.enabled ? 'border-white/[0.06] hover:border-white/[0.08]' : 'border-white/[0.04] opacity-50'
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
          plugin.enabled
            ? hasMissing ? 'bg-amber-400/10 border border-amber-400/20' : 'bg-green-400/10 border border-green-500/20'
            : 'bg-neutral-500/10 border border-neutral-500/20'
        }`}>
          <Plug size={13} className={
            plugin.enabled
              ? hasMissing ? 'text-amber-400' : 'text-green-400'
              : 'text-neutral-600'
          } />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-200">{plugin.name}</span>
            <span className="text-[9px] text-neutral-600 font-mono">{plugin.version}</span>
            {locationBadge(plugin.location)}
            {!plugin.enabled && (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-neutral-500/10 text-neutral-500 border border-neutral-500/20">disabled</span>
            )}
            {hasMissing && plugin.enabled && (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20 flex items-center gap-0.5">
                <AlertTriangle size={8} /> missing env
              </span>
            )}
          </div>
          <p className="text-[11px] text-neutral-500 mt-0.5 truncate">{plugin.description}</p>
        </div>

        <span className="text-neutral-600 flex-shrink-0">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/[0.06] pt-3 space-y-3">
          {/* Hooks */}
          {plugin.hooks.length > 0 && (
            <div>
              <p className="text-[10px] text-neutral-600 uppercase tracking-wider mb-1">Hooks</p>
              <div className="flex flex-wrap gap-1">
                {plugin.hooks.map(h => (
                  <span key={h} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-purple-400 border border-indigo-500/20 font-mono">{h}</span>
                ))}
              </div>
            </div>
          )}

          {/* Dependencies */}
          {plugin.dependencies.length > 0 && (
            <div>
              <p className="text-[10px] text-neutral-600 uppercase tracking-wider mb-1">Dependencies</p>
              <div className="flex flex-wrap gap-1">
                {plugin.dependencies.map(d => (
                  <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-neutral-400 font-mono">{d}</span>
                ))}
              </div>
            </div>
          )}

          {/* Required env */}
          {plugin.requiredEnv.length > 0 && (
            <div>
              <p className="text-[10px] text-neutral-600 uppercase tracking-wider mb-1">Required Environment</p>
              <div className="flex flex-wrap gap-1">
                {plugin.requiredEnv.map(e => {
                  const missing = plugin.missingEnv.includes(e);
                  return (
                    <span key={e} className={`text-[10px] px-1.5 py-0.5 rounded font-mono flex items-center gap-1 ${
                      missing ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-400/10 text-green-400 border border-green-500/20'
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
            <p className="text-[10px] text-neutral-600 uppercase tracking-wider mb-1">Path</p>
            <p className="text-[10px] text-neutral-500 font-mono break-all">{plugin.path}</p>
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
        <div className="h-8 bg-white/[0.04] rounded-lg w-48 mb-6" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-white/[0.03] rounded-xl" />)}
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
          <div className="flex items-center gap-3"><Plug size={20} className="text-purple-400" /><h1 className="text-xl font-bold text-white">Plugins</h1></div>
          <p className="text-sm text-neutral-500 mt-0.5">
            {data.totalCount} plugins · {data.enabledCount} enabled · {data.builtinCount} builtin · {data.userCount} user
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total" value={String(data.totalCount)} icon={<Package size={13} className="text-purple-400" />} />
        <StatCard label="Enabled" value={String(data.enabledCount)} icon={<CheckCircle size={13} className="text-green-400" />} />
        <StatCard label="Hooks" value={String(data.hooks.length)} icon={<GitBranch size={13} className="text-amber-400" />} />
        <StatCard label="User" value={String(data.userCount)} icon={<FolderOpen size={13} className="text-purple-400" />} />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg overflow-hidden max-w-xs">
          <Search size={13} className="text-neutral-600 ml-2.5" />
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter plugins..."
            className="bg-transparent text-sm text-white placeholder:text-neutral-600 px-2 py-1.5 w-full focus:outline-none"
          />
          {filter && (
            <button onClick={() => setFilter('')} className="text-neutral-600 hover:text-neutral-400 pr-2">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {data.totalCount === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <Plug size={28} className="text-neutral-600 mx-auto mb-3" />
          <p className="text-neutral-400 text-sm mb-1">No plugins installed</p>
          <p className="text-neutral-600 text-xs">Add plugins to ~/.hermes/plugins/ or install with hermes plugins install</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(groupedCats).sort().map(([cat, plugins]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <FolderOpen size={13} className="text-amber-400/70" />
                <span className="text-sm font-medium text-neutral-400">{cat}</span>
                <span className="text-[10px] text-neutral-600 font-mono">{plugins.length}</span>
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
        <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-xs font-medium text-neutral-400 mb-2">Registered Hook Events</p>
          <div className="flex flex-wrap gap-1.5">
            {data.hooks.map(h => (
              <span key={h} className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-purple-400 border border-indigo-500/20 font-mono">{h}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] text-neutral-600 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  );
}
