export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import fs from 'fs';
import { profilePath, readProfileYaml, redactSecrets } from '@/lib/hermes';
import { cookies } from 'next/headers';

function getDb(profileName?: string): Database.Database | null {
  const dbPath = profilePath(profileName, 'state.db');
  if (!fs.existsSync(dbPath)) return null;
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}

interface HermesConfig {
  delegation?: Record<string, unknown>;
}

interface DelegationCall {
  session_id: string;
  session_title: string;
  timestamp: string;
  goal: string;
  tasks: { goal: string; toolsets?: string[] }[];
  toolsets: string[];
  context_preview: string;
  mode: 'single' | 'batch';
}

export async function GET() {
  const cookieStore = await cookies();
  const profileName = cookieStore.get('overwatch-profile')?.value;
  const db = getDb(profileName);
  if (!db) return NextResponse.json({ error: 'state.db not found' }, { status: 500 });

  try {
    // Get all delegate_task calls from tool_calls JSON
    const rows = db.prepare(`
      SELECT m.tool_calls, m.session_id,
        datetime(m.timestamp, 'unixepoch', 'localtime') as timestamp,
        s.title as session_title
      FROM messages m
      JOIN sessions s ON s.id = m.session_id
      WHERE m.role = 'assistant' AND m.tool_calls LIKE '%delegate_task%'
      ORDER BY m.timestamp DESC
    `).all() as { tool_calls: string; session_id: string; timestamp: string; session_title: string }[];

    const delegations: DelegationCall[] = [];
    const toolsetUsage: Record<string, number> = {};

    for (const row of rows) {
      try {
        const calls = JSON.parse(row.tool_calls) as { function: { name: string; arguments: string } }[];
        for (const call of calls) {
          if (call.function.name !== 'delegate_task') continue;
          const args = JSON.parse(call.function.arguments);
          const tasks = args.tasks as { goal: string; toolsets?: string[] }[] | undefined;
          const isBatch = !!tasks && tasks.length > 0;

          const toolsets = isBatch
            ? Array.from(new Set(tasks!.flatMap(t => t.toolsets || [])))
            : (args.toolsets as string[] || []);

          for (const ts of toolsets) {
            toolsetUsage[ts] = (toolsetUsage[ts] || 0) + 1;
          }

          delegations.push({
            session_id: row.session_id,
            session_title: row.session_title || row.session_id,
            timestamp: row.timestamp,
            goal: isBatch ? `Batch: ${tasks!.length} tasks` : (args.goal || '?'),
            tasks: isBatch ? tasks! : [],
            toolsets,
            context_preview: (args.context || '').slice(0, 200),
            mode: isBatch ? 'batch' : 'single',
          });
        }
      } catch {}
    }

    // Subagent sessions (parent_session_id is set)
    const subagentSessions = db.prepare(`
      SELECT c.id, c.title, c.model,
        datetime(c.started_at, 'unixepoch', 'localtime') as started_at,
        c.message_count, c.tool_call_count, c.end_reason,
        p.title as parent_title, p.id as parent_id
      FROM sessions c
      JOIN sessions p ON c.parent_session_id = p.id
      ORDER BY c.started_at DESC
      LIMIT 50
    `).all();

    db.close();

    // Config
    const config = readProfileYaml<HermesConfig>(profileName, 'config.yaml');
    const delegationConfig = redactSecrets(config?.delegation || {});

    return NextResponse.json({
      delegations,
      totalCalls: delegations.length,
      batchCalls: delegations.filter(d => d.mode === 'batch').length,
      singleCalls: delegations.filter(d => d.mode === 'single').length,
      toolsetUsage,
      subagentSessions,
      subagentCount: subagentSessions.length,
      config: delegationConfig,
    });
  } catch (err) {
    db.close();
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
