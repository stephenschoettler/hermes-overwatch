export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import fs from 'fs';
import { profilePath, readProfileYaml } from '@/lib/hermes';
import { cookies } from 'next/headers';

function getDb(profileName?: string): Database.Database | null {
  const dbPath = profilePath(profileName, 'state.db');
  if (!fs.existsSync(dbPath)) return null;
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}

interface HermesConfig {
  model?: { default?: string; provider?: string };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const profileParam = searchParams.get('profile');
  const cookieStore = await cookies();
  const profileName = (profileParam && profileParam !== 'system') ? profileParam : cookieStore.get('overwatch-profile')?.value;
  const db = getDb(profileName);
  if (!db) return NextResponse.json({ error: 'state.db not found' }, { status: 500 });

  try {
    // Per-model aggregate stats
    const models = db.prepare(`
      SELECT model,
        count(*) as sessions,
        sum(message_count) as messages,
        sum(tool_call_count) as tool_calls,
        sum(input_tokens) as input_tokens,
        sum(output_tokens) as output_tokens,
        sum(cache_read_tokens) as cache_read_tokens,
        sum(estimated_cost_usd) as cost,
        round(avg(message_count), 1) as avg_messages,
        round(avg(tool_call_count), 1) as avg_tools,
        max(datetime(started_at, 'unixepoch', 'localtime')) as last_used
      FROM sessions
      WHERE model IS NOT NULL AND model != ''
      GROUP BY model
      ORDER BY sessions DESC
    `).all() as Record<string, unknown>[];

    // Per-model per-source breakdown
    const bySource = db.prepare(`
      SELECT model, source, count(*) as sessions,
        sum(message_count) as messages,
        sum(tool_call_count) as tool_calls,
        sum(input_tokens) as input_tokens,
        sum(output_tokens) as output_tokens
      FROM sessions
      WHERE model IS NOT NULL AND model != ''
      GROUP BY model, source
      ORDER BY model, sessions DESC
    `).all() as Record<string, unknown>[];

    // Per-model per-day usage (last 7 days)
    const byDay = db.prepare(`
      SELECT date(started_at, 'unixepoch', 'localtime') as day, model, count(*) as sessions
      FROM sessions
      WHERE model IS NOT NULL AND model != ''
        AND started_at > unixepoch('now', '-7 days')
      GROUP BY day, model
      ORDER BY day ASC, sessions DESC
    `).all() as { day: string; model: string; sessions: number }[];

    // Recent sessions per model (last 5 each)
    const recentByModel: Record<string, unknown[]> = {};
    for (const m of models) {
      const modelName = m.model as string;
      recentByModel[modelName] = db.prepare(`
        SELECT id, source, title,
          datetime(started_at, 'unixepoch', 'localtime') as started_at,
          message_count, tool_call_count
        FROM sessions
        WHERE model = ?
        ORDER BY started_at DESC
        LIMIT 5
      `).all(modelName);
    }

    db.close();

    // Current default model from config
    const config = readProfileYaml<HermesConfig>(profileName, 'config.yaml');
    const defaultModel = config?.model?.default || 'unknown';

    // Group bySource into a map
    const sourceMap: Record<string, Record<string, unknown>[]> = {};
    for (const row of bySource) {
      const model = row.model as string;
      if (!sourceMap[model]) sourceMap[model] = [];
      sourceMap[model].push(row);
    }

    return NextResponse.json({
      models,
      bySource: sourceMap,
      byDay,
      recentByModel,
      defaultModel,
    });
  } catch (err) {
    db.close();
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
