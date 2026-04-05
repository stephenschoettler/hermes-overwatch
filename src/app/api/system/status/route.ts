export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import os from 'os';
import fs from 'fs';
import { hermesPath } from '@/lib/hermes';

// Redact tokens/keys from strings before sending to client.
// Matches patterns like: bot tokens (digits:alphanum), bearer tokens, api keys.
// Match Telegram bot tokens: numeric ID + colon + anything until whitespace/quote/backtick
// Handles standard (1234:ABC...) and partially-redacted (1234:***:ABC...) forms
const TOKEN_RE = /\b\d{8,12}:[^\s`'"]{5,}/g;

function redactString(s: string): string {
  return s.replace(TOKEN_RE, '[token redacted]');
}

function runCmd(cmd: string): string {
  try {
    return execSync(cmd, { timeout: 5000, encoding: 'utf8' }).trim();
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'stdout' in e) {
      return String((e as Record<string, unknown>).stdout || '').trim();
    }
    return '';
  }
}

function getServiceStatus(service: string) {
  const active = runCmd(`systemctl --user is-active ${service}`);
  let uptime = '';
  try {
    const show = runCmd(`systemctl --user show ${service} --property=ActiveEnterTimestamp`);
    const match = show.match(/ActiveEnterTimestamp=(.+)/);
    if (match && match[1] && match[1] !== 'n/a') {
      const since = new Date(match[1]);
      const diffSec = Math.floor((Date.now() - since.getTime()) / 1000);
      if (diffSec < 60) uptime = `${diffSec}s`;
      else if (diffSec < 3600) uptime = `${Math.floor(diffSec / 60)}m`;
      else if (diffSec < 86400) uptime = `${Math.floor(diffSec / 3600)}h ${Math.floor((diffSec % 3600) / 60)}m`;
      else uptime = `${Math.floor(diffSec / 86400)}d ${Math.floor((diffSec % 86400) / 3600)}h`;
    }
  } catch {}
  return {
    name: service,
    status: active === 'active' ? 'active' : (active || 'unknown'),
    uptime,
  };
}

function getCpuPercent(): number | null {
  try {
    const stat1 = runCmd('cat /proc/stat | head -1');
    execSync('sleep 0.2', { timeout: 1000 });
    const stat2 = runCmd('cat /proc/stat | head -1');
    const parse = (line: string) => {
      const parts = line.split(/\s+/).slice(1).map(Number);
      const idle = parts[3] + (parts[4] ?? 0);
      const total = parts.reduce((a, b) => a + b, 0);
      return { idle, total };
    };
    const s1 = parse(stat1);
    const s2 = parse(stat2);
    const dTotal = s2.total - s1.total;
    const dIdle = s2.idle - s1.idle;
    if (dTotal === 0) return null;
    return Math.round((1 - dIdle / dTotal) * 100);
  } catch { return null; }
}

function getDiskUsage(): { used: string; total: string; percent: number } | null {
  try {
    const line = runCmd("df -h / | tail -1");
    const parts = line.split(/\s+/);
    // parts: [device, size, used, avail, percent, mount]
    return {
      total: parts[1],
      used: parts[2],
      percent: parseInt(parts[4]) || 0,
    };
  } catch { return null; }
}

function getHermesDiskUsage(): string {
  try {
    return runCmd("du -sh ~/.hermes/ --exclude='.git' --exclude='hermes-agent' --exclude='node_modules' --exclude='venv' 2>/dev/null").split('\t')[0] || '?';
  } catch { return '?'; }
}

export async function GET() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const loadAvg = os.loadavg();

  const gateway = getServiceStatus('hermes-gateway');
  const overwatch = getServiceStatus('overwatch');
  const overwatchDeploy = getServiceStatus('overwatch-deploy.service');

  // Gateway process details
  let gatewayProcess: Record<string, unknown> | null = null;
  try {
    const stateFile = fs.readFileSync(hermesPath('gateway_state.json'), 'utf-8');
    const state = JSON.parse(stateFile);
    if (state.pid) {
      const stat = fs.readFileSync(`/proc/${state.pid}/stat`, 'utf-8').split(' ');
      const rssPages = parseInt(stat[23]);
      gatewayProcess = {
        pid: state.pid,
        rss_mb: Math.round((rssPages * 4096) / 1024 / 1024),
        platforms: Object.fromEntries(
          Object.entries(state.platforms || {}).map(([k, v]) => {
            const p = v as Record<string, unknown>;
            return [k, {
              ...p,
              ...(p.error_message ? { error_message: redactString(String(p.error_message)) } : {}),
            }];
          })
        ),
      };
    }
  } catch {}

  // CPU
  const cpu = getCpuPercent();

  // RAM
  const ram = {
    used: Math.round(usedMem / 1024 / 1024),
    total: Math.round(totalMem / 1024 / 1024),
    percent: Math.round((usedMem / totalMem) * 100),
  };

  // Disk
  const disk = getDiskUsage();

  // Hermes disk usage
  const hermesDisk = getHermesDiskUsage();

  // state.db size
  let dbSizeMb = 0;
  try {
    const stat = fs.statSync(hermesPath('state.db'));
    dbSizeMb = Math.round(stat.size / 1024 / 1024 * 10) / 10;
  } catch {}

  // Uptime
  const uptimeSec = os.uptime();
  const days = Math.floor(uptimeSec / 86400);
  const hours = Math.floor((uptimeSec % 86400) / 3600);
  const systemUptime = days > 0 ? `${days}d ${hours}h` : `${hours}h ${Math.floor((uptimeSec % 3600) / 60)}m`;

  // Log file sizes
  let logFiles: { name: string; size: string }[] = [];
  try {
    const logsDir = hermesPath('logs');
    if (fs.existsSync(logsDir)) {
      logFiles = fs.readdirSync(logsDir)
        .filter(f => f.endsWith('.log'))
        .map(f => {
          const stat = fs.statSync(`${logsDir}/${f}`);
          const kb = Math.round(stat.size / 1024);
          return { name: f, size: kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB` };
        });
    }
  } catch {}

  return NextResponse.json({
    gateway,
    overwatch,
    overwatchDeploy,
    gatewayProcess,
    cpu: cpu !== null ? { percent: cpu } : null,
    ram,
    disk,
    hermesDisk,
    dbSizeMb,
    loadAvg: loadAvg.map(l => l.toFixed(2)),
    systemUptime,
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    logFiles,
    timestamp: new Date().toISOString(),
  });
}
