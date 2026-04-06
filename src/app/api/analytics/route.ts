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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const profileParam = searchParams.get('profile');
  const cookieStore = await cookies();
  const profileName = (profileParam && profileParam !== 'system') ? profileParam : cookieStore.get('overwatch-profile')?.value;
  const db = getDb(profileName);
  if (!db) return NextResponse.json({ error: 'state.db not found' }, { status: 500 });

  try {
    // Daily activity (all time)
    const daily = db.prepare(`
      SELECT date(started_at, 'unixepoch', 'localtime') as day,
        count(*) as sessions,
        sum(message_count) as messages,
        sum(tool_call_count) as tool_calls,
        sum(input_tokens) as input_tokens,
        sum(output_tokens) as output_tokens,
        sum(cache_read_tokens) as cache_read_tokens
      FROM sessions GROUP BY day ORDER BY day
    `).all();

    // Daily by source
    const dailyBySource = db.prepare(`
      SELECT date(started_at, 'unixepoch', 'localtime') as day, source,
        count(*) as sessions
      FROM sessions GROUP BY day, source ORDER BY day
    `).all();

    // Daily by model
    const dailyByModel = db.prepare(`
      SELECT date(started_at, 'unixepoch', 'localtime') as day, model,
        count(*) as sessions,
        sum(input_tokens) as input_tokens,
        sum(output_tokens) as output_tokens
      FROM sessions WHERE model IS NOT NULL AND model != ''
      GROUP BY day, model ORDER BY day
    `).all();

    // Hourly distribution (non-cron)
    const hourly = db.prepare(`
      SELECT strftime('%H', started_at, 'unixepoch', 'localtime') as hour,
        count(*) as sessions,
        sum(message_count) as messages
      FROM sessions WHERE source != 'cron'
      GROUP BY hour ORDER BY hour
    `).all();

    // Totals
    const totals = db.prepare(`
      SELECT
        count(*) as sessions,
        sum(message_count) as messages,
        sum(tool_call_count) as tool_calls,
        sum(input_tokens) as input_tokens,
        sum(output_tokens) as output_tokens,
        sum(cache_read_tokens) as cache_read_tokens,
        sum(estimated_cost_usd) as cost
      FROM sessions
    `).get();

    // Averages per day
    const avgPerDay = db.prepare(`
      SELECT
        round(avg(cnt), 1) as avg_sessions,
        round(avg(msgs), 0) as avg_messages,
        round(avg(tools), 0) as avg_tools,
        round(avg(input_tok), 0) as avg_input_tokens,
        round(avg(output_tok), 0) as avg_output_tokens
      FROM (
        SELECT date(started_at, 'unixepoch', 'localtime') as day,
          count(*) as cnt,
          sum(message_count) as msgs,
          sum(tool_call_count) as tools,
          sum(input_tokens) as input_tok,
          sum(output_tokens) as output_tok
        FROM sessions GROUP BY day
      )
    `).get();

    db.close();

    return NextResponse.json({
      daily,
      dailyBySource,
      dailyByModel,
      hourly,
      totals,
      avgPerDay,
    });
  } catch (err) {
    db.close();
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
