'use client';

import { useState, useEffect } from 'react';
import {
  Wrench, Terminal, FileText, Globe, Brain, Cpu, Zap,
  Search, Plug, MessageSquare, Camera, Code, Users,
} from 'lucide-react';

interface ToolInfo {
  name: string;
  calls: number;
  sessions: number;
  isMcp: boolean;
  category: string;
}

interface ToolsData {
  tools: ToolInfo[];
  totalCalls: number;
  uniqueTools: number;
  toolBySource: Record<string, Record<string, number>>;
  dailyToolCounts: Record<string, Record<string, number>>;
  platformToolsets: Record<string, string[]>;
  mcpServers: string[];
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Terminal': <Terminal size={12} />,
  'File': <FileText size={12} />,
  'Web': <Globe size={12} />,
  'Browser': <Globe size={12} />,
  'Browser (MCP)': <Globe size={12} />,
  'Memory': <Brain size={12} />,
  'Skills': <Cpu size={12} />,
  'Code Execution': <Code size={12} />,
  'Orchestration': <Zap size={12} />,
  'Media': <Camera size={12} />,
  'Interaction': <MessageSquare size={12} />,
  'GitHub (MCP)': <Plug size={12} />,
  'Context7 (MCP)': <Plug size={12} />,
  'HuggingFace (MCP)': <Plug size={12} />,
  'Thinking (MCP)': <Plug size={12} />,
  'MCP': <Plug size={12} />,
};

const CATEGORY_COLORS: Record<string, string> = {
  'Terminal': 'text-green-400 bg-green-400/10 border-green-500/20',
  'File': 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  'Web': 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  'Browser': 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  'Browser (MCP)': 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  'Memory': 'text-purple-400 bg-indigo-500/10 border-indigo-400/20',
  'Skills': 'text-purple-400 bg-indigo-400/10 border-indigo-400/20',
  'Code Execution': 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  'Orchestration': 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  'Media': 'text-pink-400 bg-pink-400/10 border-pink-400/20',
  'Interaction': 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20',
  'GitHub (MCP)': 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  'Context7 (MCP)': 'text-cyan-400 bg-teal-400/10 border-teal-400/20',
  'HuggingFace (MCP)': 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  'Thinking (MCP)': 'text-violet-400 bg-violet-400/10 border-violet-400/20',
  'MCP': 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20',
};

function sourceColor(source: string): string {
  switch (source) {
    case 'cli': return 'text-purple-400 bg-indigo-500/10 border-indigo-400/20';
    case 'telegram': return 'text-sky-400 bg-sky-400/10 border-sky-400/20';
    case 'cron': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    default: return 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20';
  }
}

export default function ToolsPage() {
  const [data, setData] = useState<ToolsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [groupBy, setGroupBy] = useState<'rank' | 'category'>('rank');

  useEffect(() => {
    const fetchTools = async () => {
      try {
        const res = await fetch('/api/tools');
        setData(await res.json());
      } catch {}
      setLoading(false);
    };
    fetchTools();
  }, []);

  if (loading || !data) {
    return (
      <div className="max-w-5xl mx-auto animate-pulse">
        <div className="h-8 bg-white/[0.04] rounded-lg w-48 mb-6" />
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => <div key={i} className="h-10 bg-white/[0.03] rounded-lg" />)}
        </div>
      </div>
    );
  }

  const q = filter.toLowerCase();
  const filtered = q
    ? data.tools.filter(t => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
    : data.tools;

  // Group by category
  const categories: Record<string, ToolInfo[]> = {};
  for (const t of filtered) {
    if (!categories[t.category]) categories[t.category] = [];
    categories[t.category].push(t);
  }
  const sortedCats = Object.entries(categories).sort((a, b) => {
    const aTotal = a[1].reduce((s, t) => s + t.calls, 0);
    const bTotal = b[1].reduce((s, t) => s + t.calls, 0);
    return bTotal - aTotal;
  });

  // Top tool for bar scaling
  const maxCalls = data.tools[0]?.calls || 1;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-3"><Wrench size={20} className="text-purple-400" /><h1 className="text-xl font-bold text-white">Tools</h1></div>
          <p className="text-sm text-neutral-500 mt-0.5">
            {data.uniqueTools} tools used · {data.totalCalls.toLocaleString()} total calls · {data.mcpServers.length} MCP servers
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg overflow-hidden max-w-xs">
          <Search size={13} className="text-neutral-600 ml-2.5" />
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter tools..."
            className="bg-transparent text-sm text-white placeholder:text-neutral-600 px-2 py-1.5 w-full focus:outline-none"
          />
        </div>
        <div className="flex rounded-lg bg-white/[0.04] p-0.5">
          <button
            onClick={() => setGroupBy('rank')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${groupBy === 'rank' ? 'bg-indigo-500/[0.15] text-indigo-300' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            By Usage
          </button>
          <button
            onClick={() => setGroupBy('category')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${groupBy === 'category' ? 'bg-indigo-500/[0.15] text-indigo-300' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            By Category
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tool list (2 cols) */}
        <div className="lg:col-span-2">
          {groupBy === 'rank' ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="grid grid-cols-[1fr_80px_60px_1fr] gap-2 px-4 py-2 border-b border-white/[0.06] text-[10px] font-medium text-neutral-600 uppercase tracking-wider">
                <div>Tool</div>
                <div className="text-right">Calls</div>
                <div className="text-right">Sessions</div>
                <div>Usage</div>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {filtered.map((t, i) => {
                  const pct = (t.calls / maxCalls) * 100;
                  const catColor = CATEGORY_COLORS[t.category] || CATEGORY_COLORS['MCP'];
                  return (
                    <div key={t.name} className="grid grid-cols-[1fr_80px_60px_1fr] gap-2 px-4 py-2 items-center hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-neutral-700 font-mono w-5 text-right flex-shrink-0">{i + 1}</span>
                        <span className={`text-[9px] px-1 py-0.5 rounded border flex-shrink-0 ${catColor}`}>
                          {t.category}
                        </span>
                        <span className="text-xs text-neutral-200 font-mono truncate">{t.name}</span>
                      </div>
                      <div className="text-right text-xs text-neutral-300 font-mono">{t.calls.toLocaleString()}</div>
                      <div className="text-right text-xs text-neutral-500 font-mono">{t.sessions}</div>
                      <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500/40 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedCats.map(([cat, tools]) => {
                const catTotal = tools.reduce((s, t) => s + t.calls, 0);
                const catColor = CATEGORY_COLORS[cat] || CATEGORY_COLORS['MCP'];
                return (
                  <div key={cat} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                    <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-white/[0.06]">
                      <span className="text-neutral-500">{CATEGORY_ICONS[cat] || <Wrench size={12} />}</span>
                      <span className="text-sm font-medium text-neutral-200">{cat}</span>
                      <span className="text-[10px] text-neutral-600 font-mono ml-auto">{catTotal.toLocaleString()} calls · {tools.length} tools</span>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                      {tools.map(t => (
                        <div key={t.name} className="flex items-center gap-3 px-4 py-1.5 hover:bg-white/[0.02] transition-colors">
                          <span className="text-xs text-neutral-300 font-mono flex-1 truncate">{t.name}</span>
                          <span className="text-xs text-neutral-400 font-mono">{t.calls.toLocaleString()}</span>
                          <div className="w-24 h-1 bg-white/[0.04] rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500/40 rounded-full" style={{ width: `${(t.calls / maxCalls) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar: toolsets + source breakdown */}
        <div className="space-y-4">
          {/* Platform toolsets */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs font-medium text-neutral-400 mb-3">Enabled Toolsets</p>
            <div className="space-y-3">
              {Object.entries(data.platformToolsets).map(([platform, toolsets]) => (
                <div key={platform}>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${sourceColor(platform)}`}>
                    {platform}
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(toolsets as string[]).map(ts => (
                      <span key={ts} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-neutral-500">{ts}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Usage by source */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs font-medium text-neutral-400 mb-3">Top Tools by Source</p>
            <div className="space-y-3">
              {Object.entries(data.toolBySource).map(([source, tools]) => {
                const sorted = Object.entries(tools).sort((a, b) => b[1] - a[1]).slice(0, 5);
                return (
                  <div key={source}>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${sourceColor(source)}`}>
                      {source}
                    </span>
                    <div className="mt-1.5 space-y-0.5">
                      {sorted.map(([name, count]) => (
                        <div key={name} className="flex items-center justify-between">
                          <span className="text-[10px] text-neutral-500 font-mono truncate">{name}</span>
                          <span className="text-[10px] text-neutral-400 font-mono">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MCP Servers */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs font-medium text-neutral-400 mb-3">MCP Servers</p>
            <div className="space-y-1">
              {data.mcpServers.map(s => {
                const mcpTools = data.tools.filter(t => t.name.startsWith(`mcp_${s.replace('-', '_')}`));
                const totalCalls = mcpTools.reduce((a, t) => a + t.calls, 0);
                return (
                  <div key={s} className="flex items-center justify-between">
                    <span className="text-xs text-neutral-300">{s}</span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {mcpTools.length} tools · {totalCalls} calls
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
