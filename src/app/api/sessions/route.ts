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

export async function GET(req: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'state.db not found' }, { status: 500 });

  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '25')));
    const source = url.searchParams.get('source') || '';
    const model = url.searchParams.get('model') || '';
    const search = url.searchParams.get('q') || '';
    const offset = (page - 1) * limit;

    const SORT_MAP: Record<string, string> = {
      started_at:    's.started_at',
      title:         's.title',
      model:         's.model',
      tokens:        '(s.input_tokens + s.output_tokens)',
      message_count: 's.message_count',
      source:        's.source',
      status:        '(CASE WHEN s.ended_at IS NULL THEN 1 ELSE 0 END)',
    };
    const sortKey = url.searchParams.get('sort') || 'started_at';
    const sortCol = SORT_MAP[sortKey] ?? 's.started_at';
    const rawDir  = url.searchParams.get('dir') || 'desc';
    const sortDir = rawDir === 'asc' ? 'ASC' : 'DESC';

    let where = 'WHERE 1=1';
    const params: unknown[] = [];

    if (source) {
      where += ' AND s.source = ?';
      params.push(source);
    }
    if (model) {
      where += ' AND s.model = ?';
      params.push(model);
    }

    // FTS search across message content
    let sessionIdsFromSearch: string[] | null = null;
    if (search) {
      const ftsResults = db.prepare(`
        SELECT DISTINCT m.session_id
        FROM messages_fts fts
        JOIN messages m ON m.id = fts.rowid
        WHERE messages_fts MATCH ?
        LIMIT 200
      `).all(search) as { session_id: string }[];
      sessionIdsFromSearch = ftsResults.map(r => r.session_id);

      if (sessionIdsFromSearch.length === 0) {
        db.close();
        return NextResponse.json({ sessions: [], total: 0, page, limit, pages: 0, stats: { active: 0, idle24h: 0, total24h: 0 }, filters: { models: [], sources: [] } });
      }

      const placeholders = sessionIdsFromSearch.map(() => '?').join(',');
      where += ` AND s.id IN (${placeholders})`;
      params.push(...sessionIdsFromSearch);
    }

    const countRow = db.prepare(`SELECT count(*) as total FROM sessions s ${where}`).get(...params) as { total: number };
    const total = countRow.total;
    const pages = Math.ceil(total / limit);

    const sessions = db.prepare(`
      SELECT s.id, s.source, s.model, s.title,
        datetime(s.started_at, 'unixepoch', 'localtime') as started_at,
        datetime(s.ended_at, 'unixepoch', 'localtime') as ended_at,
        s.message_count, s.tool_call_count,
        s.input_tokens, s.output_tokens, s.cache_read_tokens,
        s.estimated_cost_usd, s.end_reason,
        s.parent_session_id
      FROM sessions s
      ${where}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    // Active sessions (not ended)
    const activeSessions = db.prepare(`
      SELECT id, source, model, title,
        datetime(started_at, 'unixepoch', 'localtime') as started_at,
        message_count, tool_call_count,
        input_tokens, output_tokens
      FROM sessions WHERE ended_at IS NULL
      ORDER BY started_at DESC LIMIT 10
    `).all();

    // 24h stats
    const now = Math.floor(Date.now() / 1000);
    const dayAgo = now - 86400;
    const stats24h = db.prepare(`
      SELECT
        count(*) as total24h,
        count(CASE WHEN ended_at IS NULL THEN 1 END) as active,
        count(CASE WHEN ended_at IS NOT NULL THEN 1 END) as idle24h
      FROM sessions WHERE started_at >= ?
    `).get(dayAgo) as { total24h: number; active: number; idle24h: number };

    // Get available filters
    const models = db.prepare(`
      SELECT DISTINCT model FROM sessions WHERE model IS NOT NULL AND model != '' ORDER BY model
    `).all() as { model: string }[];

    const sources = db.prepare(`
      SELECT DISTINCT source FROM sessions ORDER BY source
    `).all() as { source: string }[];

    db.close();

    return NextResponse.json({
      sessions,
      activeSessions,
      total,
      page,
      limit,
      pages,
      stats: {
        active: stats24h.active,
        idle24h: stats24h.idle24h,
        total24h: stats24h.total24h,
      },
      filters: {
        models: models.map(m => m.model),
        sources: sources.map(s => s.source),
      },
    });
  } catch (err) {
    db.close();
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
