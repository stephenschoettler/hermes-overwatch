'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2, CircleSlash, ClipboardList, Clock3, Loader2, Search, SquareCheckBig,
  ChevronDown, ChevronRight, ArrowRight,
} from 'lucide-react';

type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

interface TodoItem {
  id: string;
  content: string;
  status: TodoStatus;
}

interface TodoSnapshot {
  message_id: number;
  timestamp: string;
  epoch: number;
  todos: TodoItem[];
  counts: Record<TodoStatus, number>;
  total: number;
}

interface TaskSession {
  session_id: string;
  source: string;
  model: string | null;
  title: string;
  started_at: string;
  ended_at: string | null;
  active: boolean;
  last_update: string;
  last_update_epoch: number;
  snapshot_count: number;
  total_tasks: number;
  counts: Record<TodoStatus, number>;
  todos: TodoItem[];
  history: TodoSnapshot[];
}

interface BoardTask extends TodoItem {
  session_id: string;
  title: string;
  source: string;
}

interface TasksData {
  summary: {
    sessions_with_tasks: number;
    active_sessions_with_tasks: number;
    total_tasks: number;
    in_progress: number;
    pending: number;
    completed: number;
    cancelled: number;
    updated_today: number;
  };
  sessions: TaskSession[];
  tasksBySource: Record<string, number>;
  globalBoard: Record<TodoStatus, BoardTask[]>;
  hours: number;
}

const STATUS_META: Record<TodoStatus, { label: string; color: string; icon: React.ReactNode }> = {
  in_progress: {
    label: 'In Progress',
    color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    icon: <Loader2 size={12} className="animate-spin" />,
  },
  pending: {
    label: 'Pending',
    color: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
    icon: <Clock3 size={12} />,
  },
  completed: {
    label: 'Completed',
    color: 'text-green-400 bg-green-400/10 border-green-400/20',
    icon: <CheckCircle2 size={12} />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-red-400 bg-red-400/10 border-red-400/20',
    icon: <CircleSlash size={12} />,
  },
};

function sourceColor(source: string): string {
  switch (source) {
    case 'cli': return 'text-purple-400 bg-indigo-500/10 border-indigo-400/20';
    case 'telegram': return 'text-sky-400 bg-sky-400/10 border-sky-400/20';
    case 'cron': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    default: return 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20';
  }
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function shortModel(model: string | null): string {
  if (!model) return '—';
  return model.replace('claude-', '').replace('gpt-', 'gpt');
}

function MetricCard({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[10px] font-medium text-neutral-600 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${tone}`}>{value}</p>
    </div>
  );
}

function SessionCard({ session }: { session: TaskSession }) {
  const [expanded, setExpanded] = useState(false);
  const grouped = {
    in_progress: session.todos.filter(t => t.status === 'in_progress'),
    pending: session.todos.filter(t => t.status === 'pending'),
    completed: session.todos.filter(t => t.status === 'completed'),
    cancelled: session.todos.filter(t => t.status === 'cancelled'),
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
      >
        <div className="mt-0.5 text-neutral-600">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-neutral-200 truncate">{session.title}</p>
            {session.active && <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border text-green-400 bg-green-400/10 border-green-400/20"><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-green-400" />ACTIVE</span>}
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${sourceColor(session.source)}`}>{session.source}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-neutral-600 flex-wrap">
            <span>{session.total_tasks} tasks</span>
            <span>· {session.snapshot_count} snapshots</span>
            <span>· updated {timeAgo(session.last_update)}</span>
            <span>· {shortModel(session.model)}</span>
          </div>
        </div>
        <Link
          href={`/session/${session.session_id}`}
          className="text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors flex items-center gap-1 mt-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          View <ArrowRight size={10} />
        </Link>
      </button>

      <div className="px-4 pb-3 -mt-1 flex flex-wrap gap-1.5">
        {(['in_progress', 'pending', 'completed', 'cancelled'] as TodoStatus[]).map((status) => (
          <span key={status} className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${STATUS_META[status].color}`}>
            {STATUS_META[status].icon}
            {session.counts[status]} {STATUS_META[status].label.toLowerCase()}
          </span>
        ))}
      </div>

      {expanded && (
        <div className="border-t border-white/[0.06] px-4 py-3 space-y-4">
          {(['in_progress', 'pending', 'completed', 'cancelled'] as TodoStatus[]).map((status) => (
            grouped[status].length > 0 ? (
              <div key={status}>
                <p className="text-[10px] text-neutral-600 uppercase tracking-wider mb-2">{STATUS_META[status].label}</p>
                <div className="space-y-1.5">
                  {grouped[status].map((todo) => (
                    <div key={todo.id} className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                      <span className={`mt-0.5 ${STATUS_META[status].color.split(' ')[0]}`}>{STATUS_META[status].icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-neutral-200 break-words">{todo.content}</p>
                        <p className="text-[10px] text-neutral-600 font-mono mt-1">{todo.id}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          ))}

          <div>
            <p className="text-[10px] text-neutral-600 uppercase tracking-wider mb-2">Recent Snapshots</p>
            <div className="space-y-1.5">
              {session.history.slice(0, 5).map((snap) => (
                <div key={snap.message_id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <div className="text-[11px] text-neutral-400">{snap.timestamp}</div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {(['in_progress', 'pending', 'completed', 'cancelled'] as TodoStatus[]).map((status) => (
                      <span key={status} className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_META[status].color}`}>
                        {snap.counts[status]}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BoardColumn({ title, status, items }: { title: string; status: TodoStatus; items: BoardTask[] }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border ${STATUS_META[status].color}`}>
          {STATUS_META[status].icon}
          {title}
        </span>
        <span className="text-[10px] text-neutral-600 font-mono">{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-[11px] text-neutral-600">No tasks</p>
        ) : items.map((item) => (
          <div key={`${item.session_id}:${item.id}`} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <p className="text-xs text-neutral-200 break-words">{item.content}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[10px] text-neutral-600">
              <span className={`px-1.5 py-0.5 rounded border ${sourceColor(item.source)}`}>{item.source}</span>
              <span className="truncate max-w-[180px]">{item.title}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [data, setData] = useState<TasksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TodoStatus>('all');

  useEffect(() => {
    let mounted = true;
    const fetchTasks = async () => {
      try {
        const res = await fetch('/api/tasks');
        const json = await res.json() as TasksData;
        if (mounted) setData(json);
      } catch {}
      if (mounted) setLoading(false);
    };
    fetchTasks();
    const id = setInterval(fetchTasks, 30000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const filteredSessions = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.sessions.filter((session) => {
      const hay = `${session.title} ${session.source} ${session.model || ''} ${session.todos.map(t => t.content).join(' ')}`.toLowerCase();
      const qOk = !q || hay.includes(q);
      const statusOk = statusFilter === 'all' || session.counts[statusFilter] > 0;
      return qOk && statusOk;
    });
  }, [data, query, statusFilter]);

  if (loading || !data) {
    return (
      <div className="max-w-6xl mx-auto animate-pulse">
        <div className="h-8 bg-white/[0.04] rounded-lg w-48 mb-6" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-white/[0.03]" />)}
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-white/[0.03]" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-5">
        <div className="flex items-center gap-3"><SquareCheckBig size={20} className="text-purple-400" /><h1 className="text-xl font-bold text-white">Tasks</h1></div>
        <p className="text-sm text-neutral-500 mt-0.5">
          Visualized from Hermes todo snapshots in session history · last {Math.round(data.hours / 24)} days
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
        <MetricCard label="Sessions" value={data.summary.sessions_with_tasks} tone="text-white" />
        <MetricCard label="Active Sessions" value={data.summary.active_sessions_with_tasks} tone="text-green-400" />
        <MetricCard label="In Progress" value={data.summary.in_progress} tone="text-amber-400" />
        <MetricCard label="Pending" value={data.summary.pending} tone="text-sky-400" />
        <MetricCard label="Completed" value={data.summary.completed} tone="text-green-400" />
        <MetricCard label="Cancelled" value={data.summary.cancelled} tone="text-red-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg overflow-hidden max-w-sm w-full">
              <Search size={13} className="text-neutral-600 ml-2.5" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Filter sessions or task text..."
                className="bg-transparent text-sm text-white placeholder:text-neutral-600 px-2 py-1.5 w-full focus:outline-none"
              />
            </div>
            <div className="flex rounded-lg bg-white/[0.04] p-0.5 w-fit flex-wrap">
              {(['all', 'in_progress', 'pending', 'completed', 'cancelled'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${statusFilter === status ? 'bg-indigo-500/[0.15] text-indigo-300' : 'text-neutral-500 hover:text-neutral-300'}`}
                >
                  {status === 'all' ? 'All' : STATUS_META[status].label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredSessions.length === 0 ? (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
                <ClipboardList size={24} className="text-neutral-600 mx-auto mb-2" />
                <p className="text-neutral-500 text-sm">No matching task snapshots</p>
                <p className="text-neutral-600 text-xs mt-1">The todo tool only appears in sessions where Hermes explicitly tracked work.</p>
              </div>
            ) : filteredSessions.map((session) => (
              <SessionCard key={session.session_id} session={session} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs font-medium text-neutral-400 mb-3">Tasks by Source</p>
            <div className="space-y-2">
              {Object.entries(data.tasksBySource).sort((a, b) => b[1] - a[1]).map(([source, count]) => (
                <div key={source} className="flex items-center justify-between">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${sourceColor(source)}`}>{source}</span>
                  <span className="text-xs text-neutral-400 font-mono">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <BoardColumn title="In Progress" status="in_progress" items={data.globalBoard.in_progress} />
          <BoardColumn title="Pending" status="pending" items={data.globalBoard.pending} />
        </div>
      </div>
    </div>
  );
}
