'use client';

import { useState, useEffect } from 'react';
import {
  Puzzle, ChevronDown, ChevronRight, Search, X, FolderOpen,
  FileText, Link2,
} from 'lucide-react';

function RelatedSkills({ frontmatter }: { frontmatter: Record<string, unknown> }) {
  try {
    const meta = frontmatter?.metadata as Record<string, Record<string, unknown>> | undefined;
    const related = meta?.hermes?.related_skills as string[] | undefined;
    if (!related || related.length === 0) return null;
    return (
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <Link2 size={10} className="text-neutral-600" />
        <span className="text-[10px] text-neutral-600">Related:</span>
        {related.map(r => (
          <span key={r} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/10 text-purple-400 border border-indigo-400/20">{r}</span>
        ))}
      </div>
    );
  } catch {
    return null;
  }
}

interface SkillInfo {
  name: string;
  category: string;
  description: string;
  version: string;
  tags: string[];
  relatedSkills: string[];
  path: string;
  hasLinkedFiles: boolean;
}

interface SkillsData {
  skills: SkillInfo[];
  categories: Record<string, SkillInfo[]>;
  totalCount: number;
  categoryCount: number;
}

interface SkillDetail {
  frontmatter: Record<string, unknown>;
  content: string;
}

function SkillCard({ skill, onSelect }: { skill: SkillInfo; onSelect: (path: string) => void }) {
  return (
    <button
      onClick={() => onSelect(skill.path)}
      className="w-full text-left px-3 py-2.5 rounded-lg border border-white/[0.06] hover:border-indigo-500/20 hover:bg-white/[0.04] transition-all group"
    >
      <div className="flex items-start gap-2.5">
        <div className="w-6 h-6 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Puzzle size={11} className="text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-neutral-200 group-hover:text-white truncate">{skill.name}</p>
            {skill.version && (
              <span className="text-[9px] text-neutral-600 font-mono flex-shrink-0">{skill.version}</span>
            )}
            {skill.hasLinkedFiles && (
              <span title="Has linked files"><FileText size={10} className="text-neutral-700 flex-shrink-0" /></span>
            )}
          </div>
          {skill.description && (
            <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-2">{skill.description}</p>
          )}
          {skill.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {skill.tags.slice(0, 4).map(t => (
                <span key={t} className="text-[9px] px-1 py-0.5 rounded bg-white/[0.04] text-neutral-600">{t}</span>
              ))}
              {skill.tags.length > 4 && (
                <span className="text-[9px] text-neutral-700">+{skill.tags.length - 4}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function SkillDetailPanel({ path, onClose }: { path: string; onClose: () => void }) {
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/skills?path=${encodeURIComponent(path)}`);
        setDetail(await res.json());
      } catch {}
      setLoading(false);
    };
    fetchDetail();
  }, [path]);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Puzzle size={14} className="text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">{path.split('/').pop()}</h2>
            <p className="text-[10px] text-neutral-600 font-mono">{path}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/[0.1] transition-all">
          <X size={15} />
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-white/[0.04] rounded w-3/4" />
          <div className="h-4 bg-white/[0.04] rounded w-1/2" />
          <div className="h-32 bg-white/[0.03] rounded-lg" />
        </div>
      ) : detail ? (
        <div>
          {/* Related skills */}
          <RelatedSkills frontmatter={detail.frontmatter} />

          {/* Markdown content */}
          <pre className="text-[12px] font-mono text-neutral-300 bg-black/20 rounded-lg p-4 overflow-auto max-h-[60vh] whitespace-pre-wrap leading-relaxed">
            {detail.content}
          </pre>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">Failed to load skill</p>
      )}
    </div>
  );
}

export default function SkillsPage() {
  const [data, setData] = useState<SkillsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const res = await fetch('/api/skills');
        const d = await res.json() as SkillsData;
        setData(d);
        // Expand all categories by default
        setExpandedCats(new Set(Object.keys(d.categories)));
      } catch {}
      setLoading(false);
    };
    fetchSkills();
  }, []);

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Filter skills by search
  const filteredCategories: Record<string, SkillInfo[]> = {};
  if (data) {
    const q = search.toLowerCase();
    for (const [cat, skills] of Object.entries(data.categories)) {
      const filtered = q
        ? skills.filter(s =>
            s.name.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            s.tags.some(t => t.toLowerCase().includes(q))
          )
        : skills;
      if (filtered.length > 0) filteredCategories[cat] = filtered;
    }
  }

  const filteredCount = Object.values(filteredCategories).reduce((a, s) => a + s.length, 0);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto animate-pulse">
        <div className="h-8 bg-white/[0.04] rounded-lg w-48 mb-6" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-white/[0.03] rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-3"><Puzzle size={20} className="text-purple-400" /><h1 className="text-xl font-bold text-white">Skills</h1></div>
          <p className="text-sm text-neutral-500 mt-0.5">
            {data?.totalCount || 0} skills in {data?.categoryCount || 0} categories
            {search && ` · ${filteredCount} matching`}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg overflow-hidden flex-1 max-w-sm">
          <Search size={13} className="text-neutral-600 ml-2.5" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search skills..."
            className="bg-transparent text-sm text-white placeholder:text-neutral-600 px-2 py-1.5 w-full focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-neutral-600 hover:text-neutral-400 pr-2">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className={`grid gap-5 ${selectedSkill ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Skill list */}
        <div className="space-y-2">
          {Object.keys(filteredCategories).sort().map(cat => {
            const skills = filteredCategories[cat];
            const isExpanded = expandedCats.has(cat);

            return (
              <div key={cat} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <button
                  onClick={() => toggleCat(cat)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
                >
                  <FolderOpen size={14} className="text-amber-400/70" />
                  <span className="text-sm font-medium text-neutral-300 flex-1 text-left">{cat}</span>
                  <span className="text-[10px] text-neutral-600 font-mono">{skills.length}</span>
                  {isExpanded ? <ChevronDown size={13} className="text-neutral-600" /> : <ChevronRight size={13} className="text-neutral-600" />}
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-1">
                    {skills.map(s => (
                      <SkillCard key={s.path} skill={s} onSelect={setSelectedSkill} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        {selectedSkill && (
          <SkillDetailPanel path={selectedSkill} onClose={() => setSelectedSkill(null)} />
        )}
      </div>
    </div>
  );
}
