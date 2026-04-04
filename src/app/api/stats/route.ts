export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { hermesPath, readHermesJson, readHermesYaml } from '@/lib/hermes';

interface GatewayState {
  pid?: number;
  gateway_state?: string;
  start_time?: number;
  platforms?: Record<string, { state?: string; error_message?: string }>;
  updated_at?: string;
}

interface CronJob {
  id: string;
  name: string;
  schedule_display?: string;
  enabled?: boolean;
  last_status?: string;
  last_run_at?: string;
  next_run_at?: string;
}

interface CronFile {
  jobs: CronJob[];
}

interface HermesConfig {
  model?: { default?: string; provider?: string };
  display?: { personality?: string };
  mcp_servers?: Record<string, unknown>;
}

function getDb(): Database.Database | null {
  const dbPath = hermesPath('state.db');
  if (!fs.existsSync(dbPath)) return null;
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}

function countSkills(): number {
  const skillsDir = hermesPath('skills');
  if (!fs.existsSync(skillsDir)) return 0;
  let count = 0;
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
      else if (entry.name === 'SKILL.md') count++;
    }
  }
  walk(skillsDir);
  return count;
}

export async function GET() {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: 'state.db not found' }, { status: 500 });
  }

  try {
    // Session stats
    const totals = db.prepare(`
      SELECT
        count(*) as total_sessions,
        (SELECT count(*) FROM messages) as total_messages,
        coalesce(sum(input_tokens), 0) as total_input_tokens,
        coalesce(sum(output_tokens), 0) as total_output_tokens,
        coalesce(sum(cache_read_tokens), 0) as total_cache_read,
        coalesce(sum(estimated_cost_usd), 0) as total_cost
      FROM sessions
    `).get() as Record<string, number>;

    const today = db.prepare(`
      SELECT count(*) as sessions, coalesce(sum(message_count), 0) as messages,
        coalesce(sum(tool_call_count), 0) as tool_calls,
        coalesce(sum(input_tokens), 0) as input_tokens,
        coalesce(sum(output_tokens), 0) as output_tokens,
        coalesce(sum(estimated_cost_usd), 0) as cost
      FROM sessions WHERE started_at > unixepoch(date('now', 'localtime'))
    `).get() as Record<string, number>;

    const week = db.prepare(`
      SELECT count(*) as sessions, coalesce(sum(message_count), 0) as messages,
        coalesce(sum(tool_call_count), 0) as tool_calls,
        coalesce(sum(estimated_cost_usd), 0) as cost
      FROM sessions WHERE started_at > unixepoch(date('now', 'localtime', '-7 days'))
    `).get() as Record<string, number>;

    // Model breakdown
    const models = db.prepare(`
      SELECT model, count(*) as count
      FROM sessions WHERE model IS NOT NULL AND model != ''
      GROUP BY model ORDER BY count DESC
    `).all() as { model: string; count: number }[];

    // Source breakdown
    const sources = db.prepare(`
      SELECT source, count(*) as count
      FROM sessions GROUP BY source ORDER BY count DESC
    `).all() as { source: string; count: number }[];

    // Activity by day (last 7 days)
    const dailyActivity = db.prepare(`
      SELECT date(started_at, 'unixepoch', 'localtime') as day,
        count(*) as sessions,
        sum(message_count) as messages,
        sum(tool_call_count) as tool_calls
      FROM sessions
      GROUP BY day ORDER BY day DESC LIMIT 7
    `).all() as { day: string; sessions: number; messages: number; tool_calls: number }[];

    // Recent sessions
    const recentSessions = db.prepare(`
      SELECT id, source, model, title,
        datetime(started_at, 'unixepoch', 'localtime') as started_at,
        message_count, tool_call_count, input_tokens, output_tokens,
        end_reason
      FROM sessions ORDER BY started_at DESC LIMIT 8
    `).all() as Record<string, unknown>[];

    // Active sessions (no ended_at)
    const activeSessions = db.prepare(`
      SELECT id, source, model, title,
        datetime(started_at, 'unixepoch', 'localtime') as started_at,
        message_count, tool_call_count
      FROM sessions WHERE ended_at IS NULL
      ORDER BY started_at DESC LIMIT 10
    `).all() as Record<string, unknown>[];

    db.close();

    // Gateway state
    const gateway = readHermesJson<GatewayState>('gateway_state.json');

    // Gateway process info
    let gatewayProcess: { uptime?: string; rss_mb?: number } | null = null;
    if (gateway?.pid) {
      try {
        const stat = fs.readFileSync(`/proc/${gateway.pid}/stat`, 'utf-8').split(' ');
        const startTimeTicks = parseInt(stat[21]);
        const uptimeSeconds = fs.readFileSync('/proc/uptime', 'utf-8').split(' ')[0];
        const clkTck = 100; // standard on Linux
        const processAgeSeconds = parseFloat(uptimeSeconds) - (startTimeTicks / clkTck);
        const rssPages = parseInt(stat[23]);
        gatewayProcess = {
          uptime: formatDuration(processAgeSeconds),
          rss_mb: Math.round((rssPages * 4096) / 1024 / 1024),
        };
      } catch { /* process may not exist */ }
    }

    // Cron jobs
    const cronFile = readHermesJson<CronFile>('cron/jobs.json');
    const cronJobs = cronFile?.jobs || [];

    // Config basics
    const config = readHermesYaml<HermesConfig>('config.yaml');

    // Skills count
    const skillsCount = countSkills();

    // Live gateway sessions
    let liveSessions: Record<string, unknown> = {};
    try {
      const sessionsFile = fs.readFileSync(hermesPath('sessions/sessions.json'), 'utf-8');
      liveSessions = JSON.parse(sessionsFile);
    } catch {}

    // Hermes version (from pyproject.toml)
    let hermesVersion = 'unknown';
    try {
      const pyproject = fs.readFileSync(hermesPath('hermes-agent/pyproject.toml'), 'utf-8');
      const match = pyproject.match(/^version\s*=\s*"([^"]+)"/m);
      if (match) hermesVersion = match[1];
    } catch {}

    // DB size
    let dbSizeMb = 0;
    try {
      const stat = fs.statSync(hermesPath('state.db'));
      dbSizeMb = Math.round(stat.size / 1024 / 1024 * 10) / 10;
    } catch {}

    return NextResponse.json({
      totals,
      today,
      week,
      models,
      sources,
      dailyActivity: dailyActivity.reverse(),
      recentSessions,
      gateway: {
        state: gateway?.gateway_state || 'unknown',
        pid: gateway?.pid || null,
        platforms: gateway?.platforms || {},
        process: gatewayProcess,
      },
      crons: {
        total: cronJobs.length,
        enabled: cronJobs.filter(j => j.enabled !== false).length,
        jobs: cronJobs.map(j => ({
          name: j.name,
          schedule: j.schedule_display,
          enabled: j.enabled !== false,
          lastStatus: j.last_status,
          lastRunAt: j.last_run_at,
          nextRunAt: j.next_run_at,
        })),
      },
      config: {
        model: config?.model?.default || 'unknown',
        provider: config?.model?.provider || 'unknown',
        personality: config?.display?.personality || 'default',
        mcpServers: Object.keys(config?.mcp_servers || {}),
      },
      activeSessions,
      liveSessions,
      skillsCount,
      hermesVersion,
      dbSizeMb,
    });
  } catch (err) {
    db.close();
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h < 24) return `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}
