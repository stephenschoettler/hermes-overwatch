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

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'state.db not found' }, { status: 500 });

  try {
    const session = db.prepare(`
      SELECT id, source, model, title,
        datetime(started_at, 'unixepoch', 'localtime') as started_at,
        datetime(ended_at, 'unixepoch', 'localtime') as ended_at,
        started_at as started_epoch, ended_at as ended_epoch,
        message_count, tool_call_count,
        input_tokens, output_tokens, cache_read_tokens, reasoning_tokens,
        estimated_cost_usd, end_reason, parent_session_id,
        billing_provider
      FROM sessions WHERE id = ?
    `).get(params.id) as Record<string, unknown> | undefined;

    if (!session) {
      db.close();
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Calculate duration
    const startEpoch = session.started_epoch as number;
    const endEpoch = session.ended_epoch as number | null;
    let duration = '';
    if (startEpoch) {
      const endTime = endEpoch || (Date.now() / 1000);
      const diffSec = Math.floor(endTime - startEpoch);
      if (diffSec < 60) duration = `${diffSec}s`;
      else if (diffSec < 3600) duration = `${Math.floor(diffSec / 60)}m ${diffSec % 60}s`;
      else duration = `${Math.floor(diffSec / 3600)}h ${Math.floor((diffSec % 3600) / 60)}m`;
    }

    const messages = db.prepare(`
      SELECT id, role, content, tool_call_id, tool_calls, tool_name,
        datetime(timestamp, 'unixepoch', 'localtime') as timestamp,
        finish_reason
      FROM messages
      WHERE session_id = ?
      ORDER BY timestamp ASC, id ASC
    `).all(params.id) as Record<string, unknown>[];

    db.close();

    // Parse tool_calls JSON strings
    const parsedMessages = messages.map(m => {
      let toolCalls = null;
      if (m.tool_calls && typeof m.tool_calls === 'string') {
        try { toolCalls = JSON.parse(m.tool_calls); } catch {}
      }
      return {
        ...m,
        tool_calls: toolCalls,
      };
    });

    return NextResponse.json({
      session: { ...session, duration },
      messages: parsedMessages,
    });
  } catch (err) {
    db.close();
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
