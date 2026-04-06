export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { profilePath, readProfileJson, readProfileYaml, listProfiles, getHermesHome } from '@/lib/hermes';
import { cookies } from 'next/headers';

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

function getDb(profileName?: string): Database.Database | null {
  const dbPath = profilePath(profileName, 'state.db');
  if (!fs.existsSync(dbPath)) return null;
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}

function countSkills(profileName?: string): number {
  const skillsDir = profilePath(profileName, 'skills');
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

function getGatewayInfo(profileName?: string) {
  const gateway = readProfileJson<GatewayState>(profileName, 'gateway_state.json');
  let gatewayProcess: { uptime?: string; rss_mb?: number } | null = null;
  if (gateway?.pid) {
    try {
      const stat = fs.readFileSync(`/proc/${gateway.pid}/stat`, 'utf-8').split(' ');
      const startTimeTicks = parseInt(stat[21]);
      const uptimeSeconds = fs.readFileSync('/proc/uptime', 'utf-8').split(' ')[0];
      const clkTck = 100;
      const processAgeSeconds = parseFloat(uptimeSeconds) - (startTimeTicks / clkTck);
      const rssPages = parseInt(stat[23]);
      gatewayProcess = {
        uptime: formatDuration(processAgeSeconds),
        rss_mb: Math.round((rssPages * 4096) / 1024 / 1024),
      };
    } catch { /* process may not exist */ }
  }
  return {
    state: gateway?.gateway_state || 'unknown',
    pid: gateway?.pid || null,
    platforms: gateway?.platforms || {},
    process: gatewayProcess,
  };
}

function getProfileStats(profileName?: string) {
  const db = getDb(profileName);
  if (!db) return null;

  try {
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

    const models = db.prepare(`
      SELECT model, count(*) as count
      FROM sessions WHERE model IS NOT NULL AND model != ''
      GROUP BY model ORDER BY count DESC
    `).all() as { model: string; count: number }[];

    const sources = db.prepare(`
      SELECT source, count(*) as count
      FROM sessions GROUP BY source ORDER BY count DESC
    `).all() as { source: string; count: number }[];

    const dailyActivity = db.prepare(`
      SELECT date(started_at, 'unixepoch', 'localtime') as day,
        count(*) as sessions,
        sum(message_count) as messages,
        sum(tool_call_count) as tool_calls
      FROM sessions
      GROUP BY day ORDER BY day DESC LIMIT 7
    `).all() as { day: string; sessions: number; messages: number; tool_calls: number }[];

    const recentSessions = db.prepare(`
      SELECT id, source, model, title,
        datetime(started_at, 'unixepoch', 'localtime') as started_at,
        message_count, tool_call_count, input_tokens, output_tokens,
        end_reason
      FROM sessions ORDER BY started_at DESC LIMIT 8
    `).all() as Record<string, unknown>[];

    const activeSessions = db.prepare(`
      SELECT id, source, model, title,
        datetime(started_at, 'unixepoch', 'localtime') as started_at,
        message_count, tool_call_count
      FROM sessions WHERE ended_at IS NULL
      ORDER BY started_at DESC LIMIT 10
    `).all() as Record<string, unknown>[];

    db.close();

    return { totals, today, week, models, sources, dailyActivity, recentSessions, activeSessions };
  } catch (err) {
    db.close();
    throw err;
  }
}

function getSystemStats() {
  const profiles = listProfiles();

  const agg = {
    totals: { total_sessions: 0, total_messages: 0, total_input_tokens: 0, total_output_tokens: 0, total_cache_read: 0, total_cost: 0 },
    today: { sessions: 0, messages: 0, tool_calls: 0, input_tokens: 0, output_tokens: 0, cost: 0 },
    week: { sessions: 0, messages: 0, tool_calls: 0, cost: 0 },
    models: new Map<string, number>(),
    sources: new Map<string, number>(),
    dailyActivity: new Map<string, { day: string; sessions: number; messages: number; tool_calls: number }>(),
    recentSessions: [] as Array<Record<string, unknown>>,
    activeSessions: [] as Array<Record<string, unknown>>,
    dbSizeMb: 0,
    skillsCount: 0,
  };

  const profileGateways: Array<{ name: string; state: string; pid: number | null; platforms: Record<string, { state?: string; error_message?: string }>; process: { uptime?: string; rss_mb?: number } | null; model: string | null; provider: string | null }> = [];

  for (const p of profiles) {
    const stats = getProfileStats(p.isDefault ? undefined : p.name);
    if (stats) {
      // Sum totals
      for (const k of Object.keys(agg.totals) as Array<keyof typeof agg.totals>) {
        agg.totals[k] += (stats.totals[k] as number) || 0;
      }
      for (const k of Object.keys(agg.today) as Array<keyof typeof agg.today>) {
        agg.today[k] += (stats.today[k] as number) || 0;
      }
      for (const k of Object.keys(agg.week) as Array<keyof typeof agg.week>) {
        agg.week[k] += (stats.week[k] as number) || 0;
      }
      // Merge models
      for (const m of stats.models) {
        agg.models.set(m.model, (agg.models.get(m.model) || 0) + m.count);
      }
      // Merge sources
      for (const s of stats.sources) {
        agg.sources.set(s.source, (agg.sources.get(s.source) || 0) + s.count);
      }
      // Merge daily activity
      for (const d of stats.dailyActivity) {
        const existing = agg.dailyActivity.get(d.day);
        if (existing) {
          existing.sessions += d.sessions;
          existing.messages += d.messages;
          existing.tool_calls += d.tool_calls;
        } else {
          agg.dailyActivity.set(d.day, { ...d });
        }
      }
      // Collect sessions with profile annotation
      for (const s of stats.recentSessions) {
        agg.recentSessions.push({ ...s, _profile: p.name });
      }
      for (const s of stats.activeSessions) {
        agg.activeSessions.push({ ...s, _profile: p.name });
      }
    }

    // DB size
    try {
      const dbPath = path.join(p.path, 'state.db');
      if (fs.existsSync(dbPath)) {
        const stat = fs.statSync(dbPath);
        agg.dbSizeMb += Math.round(stat.size / 1024 / 1024 * 10) / 10;
      }
    } catch {}

    // Skills
    agg.skillsCount += countSkills(p.isDefault ? undefined : p.name);

    // Gateway per profile
    const gw = getGatewayInfo(p.isDefault ? undefined : p.name);
    const cfg = readProfileYaml<HermesConfig>(p.isDefault ? undefined : p.name, 'config.yaml');
    profileGateways.push({
      name: p.name,
      ...gw,
      model: cfg?.model?.default || null,
      provider: cfg?.model?.provider || null,
    });
  }

  // Sort merged sessions by date desc, take top 8
  agg.recentSessions.sort((a, b) => String(b.started_at || '').localeCompare(String(a.started_at || '')));
  agg.recentSessions = agg.recentSessions.slice(0, 8);
  agg.activeSessions.sort((a, b) => String(b.started_at || '').localeCompare(String(a.started_at || '')));

  // Sort and format aggregated collections
  const models = Array.from(agg.models.entries())
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count);

  const sources = Array.from(agg.sources.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  const dailyActivity = Array.from(agg.dailyActivity.values())
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-7);

  // Use primary (first running) gateway for top-level gateway field
  const primaryGw = profileGateways.find(g => g.state === 'running') || profileGateways[0] || { state: 'unknown', pid: null, platforms: {}, process: null };

  return NextResponse.json({
    totals: agg.totals,
    today: agg.today,
    week: agg.week,
    models,
    sources,
    dailyActivity,
    recentSessions: agg.recentSessions,
    gateway: {
      state: primaryGw.state,
      pid: primaryGw.pid,
      platforms: primaryGw.platforms,
      process: primaryGw.process,
    },
    profileGateways,
    crons: getSystemCrons(profiles),
    config: getActiveConfig(),
    activeSessions: agg.activeSessions,
    liveSessions: {},
    skillsCount: agg.skillsCount,
    hermesVersion: getHermesVersion(),
    dbSizeMb: Math.round(agg.dbSizeMb * 10) / 10,
    isSystemView: true,
  });
}

function getSystemCrons(profiles: { name: string; path: string; isDefault: boolean }[]) {
  const allJobs: Array<{ name: string; schedule: string; enabled: boolean; lastStatus: string; lastRunAt: string; nextRunAt: string; profile: string }> = [];
  for (const p of profiles) {
    const cronFile = readProfileJson<CronFile>(p.isDefault ? undefined : p.name, 'cron/jobs.json');
    for (const j of cronFile?.jobs || []) {
      allJobs.push({
        name: j.name,
        schedule: j.schedule_display || '',
        enabled: j.enabled !== false,
        lastStatus: j.last_status || '',
        lastRunAt: j.last_run_at || '',
        nextRunAt: j.next_run_at || '',
        profile: p.name,
      });
    }
  }
  return {
    total: allJobs.length,
    enabled: allJobs.filter(j => j.enabled).length,
    jobs: allJobs,
  };
}

function getActiveConfig() {
  const config = readProfileYaml<HermesConfig>(undefined, 'config.yaml');
  return {
    model: config?.model?.default || 'unknown',
    provider: config?.model?.provider || 'unknown',
    personality: config?.display?.personality || 'default',
    mcpServers: Object.keys(config?.mcp_servers || {}),
  };
}

function getHermesVersion(): string {
  try {
    const pyproject = fs.readFileSync(path.join(getHermesHome(), 'hermes-agent/pyproject.toml'), 'utf-8');
    const match = pyproject.match(/^version\s*=\s*"([^"]+)"/m);
    if (match) return match[1];
  } catch {}
  return 'unknown';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const profileParam = searchParams.get('profile');

  // Determine which profile to use
  let effectiveProfile: string | undefined;

  if (profileParam === 'system') {
    return getSystemStats();
  } else if (profileParam && profileParam !== '') {
    effectiveProfile = profileParam;
  } else {
    const cookieStore = await cookies();
    effectiveProfile = cookieStore.get('overwatch-profile')?.value;
  }

  const db = getDb(effectiveProfile);
  if (!db) {
    return NextResponse.json({ error: 'state.db not found' }, { status: 500 });
  }

  try {
    const stats = getProfileStats(effectiveProfile);
    if (!stats) {
      return NextResponse.json({ error: 'state.db not found' }, { status: 500 });
    }

    const gateway = getGatewayInfo(effectiveProfile);

    const cronFile = readProfileJson<CronFile>(effectiveProfile, 'cron/jobs.json');
    const cronJobs = cronFile?.jobs || [];

    const config = readProfileYaml<HermesConfig>(effectiveProfile, 'config.yaml');
    const skillsCount = countSkills(effectiveProfile);

    let liveSessions: Record<string, unknown> = {};
    try {
      const sessionsFile = fs.readFileSync(profilePath(effectiveProfile, 'sessions/sessions.json'), 'utf-8');
      liveSessions = JSON.parse(sessionsFile);
    } catch {}

    let dbSizeMb = 0;
    try {
      const stat = fs.statSync(profilePath(effectiveProfile, 'state.db'));
      dbSizeMb = Math.round(stat.size / 1024 / 1024 * 10) / 10;
    } catch {}

    return NextResponse.json({
      totals: stats.totals,
      today: stats.today,
      week: stats.week,
      models: stats.models,
      sources: stats.sources,
      dailyActivity: stats.dailyActivity.reverse(),
      recentSessions: stats.recentSessions,
      gateway,
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
      activeSessions: stats.activeSessions,
      liveSessions,
      skillsCount,
      hermesVersion: getHermesVersion(),
      dbSizeMb,
      isSystemView: false,
    });
  } catch (err) {
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
