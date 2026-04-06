export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { listProfiles, getGatewayServiceName } from '@/lib/hermes';
import yaml from 'js-yaml';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const activeProfile = cookieStore.get('overwatch-profile')?.value || 'default';
    const profiles = listProfiles();

    const result = profiles.map(p => {
      // Gateway status
      let gatewayRunning = false;
      try {
        const pidFile = path.join(p.path, 'gateway.pid');
        const raw = fs.readFileSync(pidFile, 'utf-8').trim();
        let pid: number;
        if (raw.startsWith('{')) {
          pid = JSON.parse(raw).pid;
        } else {
          pid = parseInt(raw);
        }
        if (pid && !isNaN(pid)) {
          fs.accessSync(`/proc/${pid}/stat`);
          gatewayRunning = true;
        }
      } catch {}

      // Config
      let model: string | null = null;
      let provider: string | null = null;
      try {
        const configPath = path.join(p.path, 'config.yaml');
        const configRaw = fs.readFileSync(configPath, 'utf-8');
        const config = yaml.load(configRaw) as Record<string, unknown>;
        const modelCfg = config?.model as Record<string, unknown> | undefined;
        model = (modelCfg?.default ?? modelCfg?.name ?? null) as string | null;
        provider = (modelCfg?.provider ?? null) as string | null;
      } catch {}

      // Skills count
      let skillCount = 0;
      try {
        const skillsDir = path.join(p.path, 'skills');
        if (fs.existsSync(skillsDir)) {
          skillCount = fs.readdirSync(skillsDir, { withFileTypes: true })
            .filter(e => e.isDirectory()).length;
        }
      } catch {}

      // Session stats from state.db
      let sessionCount = 0;
      let lastActive: string | null = null;
      try {
        const dbPath = path.join(p.path, 'state.db');
        if (fs.existsSync(dbPath)) {
          const db = new Database(dbPath, { readonly: true, fileMustExist: true });
          const row = db.prepare('SELECT COUNT(*) as count, MAX(started_at) as last FROM sessions').get() as { count: number; last: number | null } | undefined;
          sessionCount = row?.count || 0;
          if (row?.last) {
            lastActive = new Date(row.last * 1000).toISOString();
          }
          db.close();
        }
      } catch {}

      return {
        name: p.name,
        path: p.path,
        isDefault: p.isDefault,
        isActive: p.name === activeProfile,
        gatewayRunning,
        model,
        provider,
        skillCount,
        sessionCount,
        lastActive,
        serviceName: getGatewayServiceName(p.path, p.isDefault ? undefined : p.name),
      };
    });

    return NextResponse.json({
      profiles: result,
      activeProfile,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
