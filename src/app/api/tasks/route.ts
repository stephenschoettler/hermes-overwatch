export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import fs from 'fs';
import { hermesPath } from '@/lib/hermes';

function getDb(): Database.Database | null {
  const dbPath = hermesPath('state.db');
  if (!fs.existsSync(dbPath)) return null;
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}

type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

interface TodoItem {
  id: string;
  content: string;
  status: TodoStatus;
}

interface TodoSnapshotRow {
  message_id: number;
  session_id: string;
  source: string;
  model: string | null;
  title: string | null;
  started_at_epoch: number;
  ended_at_epoch: number | null;
  snapshot_epoch: number;
  snapshot_at: string;
  content: string;
}

interface TodoSnapshot {
  message_id: number;
  timestamp: string;
  epoch: number;
  todos: TodoItem[];
  counts: Record<TodoStatus, number>;
  total: number;
}

interface TodoDelta {
  status_changes: { id: string; content: string; from: TodoStatus; to: TodoStatus }[];
  newly_completed: TodoItem[];
  newly_added: TodoItem[];
  removed: TodoItem[];
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
  preview: TodoItem[];
  history: TodoSnapshot[];
  delta: TodoDelta | null;
}

interface BoardTask extends TodoItem {
  session_id: string;
  title: string;
  source: string;
  timestamp?: string;
}

function emptyCounts(): Record<TodoStatus, number> {
  return { pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
}

function isTodoItem(value: unknown): value is TodoItem {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.content === 'string' && typeof v.status === 'string';
}

function parseTodoSnapshot(raw: string): TodoItem[] | null {
  try {
    const data = JSON.parse(raw) as { todos?: unknown };
    if (!Array.isArray(data.todos)) return null;
    const todos = data.todos.filter(isTodoItem).map((item) => ({
      id: item.id,
      content: item.content,
      status: ['pending', 'in_progress', 'completed', 'cancelled'].includes(item.status) ? item.status as TodoStatus : 'pending',
    }));
    return todos;
  } catch {
    return null;
  }
}

function toLocalDateTime(epoch: number | null): string | null {
  if (!epoch) return null;
  return new Date(epoch * 1000).toLocaleString('sv-SE');
}

function summarizeTodos(todos: TodoItem[]): { counts: Record<TodoStatus, number>; total: number } {
  const counts = emptyCounts();
  for (const todo of todos) counts[todo.status] += 1;
  return { counts, total: todos.length };
}

function buildDelta(current: TodoItem[], previous: TodoItem[] | null): TodoDelta | null {
  if (!previous) return null;

  const prevMap = new Map(previous.map((todo) => [todo.id, todo]));
  const currMap = new Map(current.map((todo) => [todo.id, todo]));

  const statusChanges: { id: string; content: string; from: TodoStatus; to: TodoStatus }[] = [];
  const newlyCompleted: TodoItem[] = [];
  const newlyAdded: TodoItem[] = [];
  const removed: TodoItem[] = [];

  for (const todo of current) {
    const prev = prevMap.get(todo.id);
    if (!prev) {
      newlyAdded.push(todo);
      continue;
    }
    if (prev.status !== todo.status) {
      statusChanges.push({ id: todo.id, content: todo.content, from: prev.status, to: todo.status });
      if (todo.status === 'completed') newlyCompleted.push(todo);
    }
  }

  for (const todo of previous) {
    if (!currMap.has(todo.id)) removed.push(todo);
  }

  return {
    status_changes: statusChanges,
    newly_completed: newlyCompleted,
    newly_added: newlyAdded,
    removed,
  };
}

function previewTodos(todos: TodoItem[]): TodoItem[] {
  const preferred = [
    ...todos.filter((todo) => todo.status === 'in_progress'),
    ...todos.filter((todo) => todo.status === 'pending'),
    ...todos.filter((todo) => todo.status === 'completed'),
    ...todos.filter((todo) => todo.status === 'cancelled'),
  ];
  const seen = new Set<string>();
  return preferred.filter((todo) => {
    if (seen.has(todo.id)) return false;
    seen.add(todo.id);
    return true;
  }).slice(0, 2);
}

function latestBySession(rows: TodoSnapshotRow[]): TaskSession[] {
  const grouped = new Map<string, TodoSnapshotRow[]>();
  for (const row of rows) {
    const arr = grouped.get(row.session_id) || [];
    arr.push(row);
    grouped.set(row.session_id, arr);
  }

  const sessions: TaskSession[] = [];
  for (const [sessionId, snapshots] of Array.from(grouped.entries()) as [string, TodoSnapshotRow[]][]) {
    const parsedHistory: TodoSnapshot[] = snapshots
      .map((row) => {
        const todos = parseTodoSnapshot(row.content);
        if (!todos) return null;
        const summary = summarizeTodos(todos);
        return {
          message_id: row.message_id,
          timestamp: row.snapshot_at,
          epoch: row.snapshot_epoch,
          todos,
          counts: summary.counts,
          total: summary.total,
        } satisfies TodoSnapshot;
      })
      .filter((v): v is TodoSnapshot => Boolean(v))
      .sort((a, b) => b.epoch - a.epoch);

    if (parsedHistory.length === 0) continue;
    const latest = parsedHistory[0];
    const previous = parsedHistory[1] || null;
    const meta = snapshots[0];

    sessions.push({
      session_id: sessionId,
      source: meta.source,
      model: meta.model,
      title: meta.title || sessionId,
      started_at: toLocalDateTime(meta.started_at_epoch) || meta.snapshot_at,
      ended_at: toLocalDateTime(meta.ended_at_epoch),
      active: meta.ended_at_epoch == null,
      last_update: latest.timestamp,
      last_update_epoch: latest.epoch,
      snapshot_count: parsedHistory.length,
      total_tasks: latest.total,
      counts: latest.counts,
      todos: latest.todos,
      preview: previewTodos(latest.todos),
      history: parsedHistory.slice(0, 10),
      delta: buildDelta(latest.todos, previous?.todos || null),
    });
  }

  return sessions.sort((a, b) => b.last_update_epoch - a.last_update_epoch);
}

export async function GET(req: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'state.db not found' }, { status: 500 });

  try {
    const url = new URL(req.url);
    const hours = Math.min(24 * 90, Math.max(1, parseInt(url.searchParams.get('hours') || '336')));

    const rows = db.prepare(`
      SELECT
        m.id as message_id,
        m.session_id,
        s.source,
        s.model,
        s.title,
        s.started_at as started_at_epoch,
        s.ended_at as ended_at_epoch,
        m.timestamp as snapshot_epoch,
        datetime(m.timestamp, 'unixepoch', 'localtime') as snapshot_at,
        m.content
      FROM messages m
      JOIN sessions s ON s.id = m.session_id
      WHERE m.role = 'tool'
        AND m.content LIKE '%"todos"%'
        AND m.timestamp > unixepoch('now', '-${hours} hours')
      ORDER BY m.timestamp DESC
    `).all() as TodoSnapshotRow[];

    db.close();

    const sessions = latestBySession(rows);

    const summary = {
      sessions_with_tasks: sessions.length,
      active_sessions_with_tasks: sessions.filter(s => s.active).length,
      total_tasks: sessions.reduce((sum, s) => sum + s.total_tasks, 0),
      in_progress: sessions.reduce((sum, s) => sum + s.counts.in_progress, 0),
      pending: sessions.reduce((sum, s) => sum + s.counts.pending, 0),
      completed: sessions.reduce((sum, s) => sum + s.counts.completed, 0),
      cancelled: sessions.reduce((sum, s) => sum + s.counts.cancelled, 0),
      updated_today: sessions.filter(s => s.last_update_epoch > (Date.now() / 1000) - 86400).length,
      recently_completed: sessions.reduce((sum, s) => sum + (s.delta?.newly_completed.length || 0), 0),
    };

    const tasksBySource = sessions.reduce<Record<string, number>>((acc, session) => {
      acc[session.source] = (acc[session.source] || 0) + session.total_tasks;
      return acc;
    }, {});

    const globalBoard = {
      in_progress: sessions.flatMap(s => s.todos.filter(t => t.status === 'in_progress').map(t => ({ ...t, session_id: s.session_id, title: s.title, source: s.source }))).slice(0, 20),
      pending: sessions.flatMap(s => s.todos.filter(t => t.status === 'pending').map(t => ({ ...t, session_id: s.session_id, title: s.title, source: s.source }))).slice(0, 20),
      completed: sessions.flatMap(s => s.todos.filter(t => t.status === 'completed').map(t => ({ ...t, session_id: s.session_id, title: s.title, source: s.source }))).slice(0, 20),
      cancelled: sessions.flatMap(s => s.todos.filter(t => t.status === 'cancelled').map(t => ({ ...t, session_id: s.session_id, title: s.title, source: s.source }))).slice(0, 20),
    };

    const recentlyCompleted = sessions
      .flatMap((session) => (session.delta?.newly_completed || []).map((todo) => ({
        ...todo,
        session_id: session.session_id,
        title: session.title,
        source: session.source,
        timestamp: session.last_update,
      })))
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
      .slice(0, 12);

    return NextResponse.json({
      summary,
      sessions,
      tasksBySource,
      globalBoard,
      recentlyCompleted,
      hours,
    });
  } catch (err) {
    db.close();
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
