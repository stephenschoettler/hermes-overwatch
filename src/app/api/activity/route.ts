export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import fs from 'fs';
import { profilePath } from '@/lib/hermes';
import { cookies } from 'next/headers';

function getDb(profileName?: string): Database.Database | null {
  const dbPath = profilePath(profileName, 'state.db');
  if (!fs.existsSync(dbPath)) return null;
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}

interface RawSession {
  id: string;
  source: string;
  model: string;
  title: string | null;
  started_at: string;
  ended_at: string | null;
  started_epoch: number;
  ended_epoch: number | null;
  message_count: number;
  tool_call_count: number;
  end_reason: string | null;
}

interface ActivityEvent {
  type: 'session_start' | 'session_end' | 'cron_run' | 'gateway_start';
  timestamp: string;
  epoch: number;
  source: string;
  title: string;
  detail: string;
  session_id: string | null;
  model: string | null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const profileParam = url.searchParams.get('profile');
  const cookieStore = await cookies();
  const profileName = (profileParam && profileParam !== 'system') ? profileParam : cookieStore.get('overwatch-profile')?.value;
  const db = getDb(profileName);
  if (!db) return NextResponse.json({ error: 'state.db not found' }, { status: 500 });

  try {
    const hours = Math.min(168, Math.max(1, parseInt(url.searchParams.get('hours') || '24')));
    const limit = Math.min(200, Math.max(10, parseInt(url.searchParams.get('limit') || '100')));

    const sessions = db.prepare(`
      SELECT id, source, model, title,
        datetime(started_at, 'unixepoch', 'localtime') as started_at,
        datetime(ended_at, 'unixepoch', 'localtime') as ended_at,
        started_at as started_epoch,
        ended_at as ended_epoch,
        message_count, tool_call_count, end_reason
      FROM sessions
      WHERE started_at > unixepoch('now', '-${hours} hours')
      ORDER BY started_at DESC
    `).all() as RawSession[];

    // Active sessions (no ended_at) — must query before db.close()
    const activeSessions = db.prepare(`
      SELECT id, source, model, title,
        datetime(started_at, 'unixepoch', 'localtime') as started_at,
        message_count, tool_call_count
      FROM sessions WHERE ended_at IS NULL
      ORDER BY started_at DESC LIMIT 10
    `).all() as Record<string, unknown>[];

    db.close();

    // Build activity events from sessions
    const events: ActivityEvent[] = [];

    for (const s of sessions) {
      const isCron = s.source === 'cron';
      const sessionTitle = s.title || s.id;

      if (isCron) {
        // Cron sessions: emit one "cron_run" event
        const cronName = s.id.replace(/^cron_[a-f0-9]+_/, '').replace(/_/g, ' ');
        const duration = s.ended_epoch && s.started_epoch
          ? formatDuration(s.ended_epoch - s.started_epoch)
          : '';
        events.push({
          type: 'cron_run',
          timestamp: s.started_at,
          epoch: s.started_epoch,
          source: 'cron',
          title: `Cron: ${extractCronName(s.id, profileName)}`,
          detail: `${s.message_count} msgs · ${s.tool_call_count} tools${duration ? ` · ${duration}` : ''} · ${s.end_reason || 'running'}`,
          session_id: s.id,
          model: s.model,
        });
      } else {
        // Interactive sessions: emit start event
        events.push({
          type: 'session_start',
          timestamp: s.started_at,
          epoch: s.started_epoch,
          source: s.source,
          title: sessionTitle,
          detail: `${s.source} session started · ${s.model || 'unknown model'}`,
          session_id: s.id,
          model: s.model,
        });

        // Emit end event if session is closed
        if (s.ended_at && s.end_reason) {
          const duration = s.ended_epoch && s.started_epoch
            ? formatDuration(s.ended_epoch - s.started_epoch)
            : '';
          events.push({
            type: 'session_end',
            timestamp: s.ended_at,
            epoch: s.ended_epoch!,
            source: s.source,
            title: sessionTitle,
            detail: `${s.message_count} msgs · ${s.tool_call_count} tools${duration ? ` · ${duration}` : ''} · ${s.end_reason}`,
            session_id: s.id,
            model: s.model,
          });
        }
      }
    }

    // Sort all events by time descending
    events.sort((a, b) => b.epoch - a.epoch);

    return NextResponse.json({
      events: events.slice(0, limit),
      total: events.length,
      hours,
      activeSessions,
    });
  } catch (err) {
    db.close();
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// Extract human-readable cron name from job ID in session ID
// e.g. "cron_35411af1c05b_20260403_150024" -> look up in jobs.json
function extractCronName(sessionId: string, profileName?: string): string {
  const match = sessionId.match(/^cron_([a-f0-9]+)_/);
  if (!match) return sessionId;
  const jobId = match[1];

  try {
    const jobsFile = fs.readFileSync(profilePath(profileName, 'cron/jobs.json'), 'utf-8');
    const jobs = JSON.parse(jobsFile).jobs as { id: string; name: string }[];
    const job = jobs.find(j => j.id === jobId);
    if (job) return job.name;
  } catch {}

  return jobId;
}
