export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import fs from 'fs';
import { hermesPath, readHermesYaml } from '@/lib/hermes';

function getDb(): Database.Database | null {
  const dbPath = hermesPath('state.db');
  if (!fs.existsSync(dbPath)) return null;
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}

interface HermesConfig {
  code_execution?: { timeout?: number; max_tool_calls?: number };
}

export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'state.db not found' }, { status: 500 });

  try {
    const rows = db.prepare(`
      SELECT m.tool_calls, m.session_id, s.title as session_title, s.source,
        datetime(m.timestamp, 'unixepoch', 'localtime') as timestamp,
        date(m.timestamp, 'unixepoch', 'localtime') as day
      FROM messages m
      JOIN sessions s ON s.id = m.session_id
      WHERE m.role = 'assistant' AND m.tool_calls LIKE '%execute_code%'
      ORDER BY m.timestamp DESC
    `).all() as { tool_calls: string; session_id: string; session_title: string; source: string; timestamp: string; day: string }[];

    db.close();

    interface ExecCall {
      session_id: string;
      session_title: string;
      source: string;
      timestamp: string;
      line_count: number;
      imports: string[];
      code_preview: string;
    }

    const executions: ExecCall[] = [];
    const bySource: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    const toolImports: Record<string, number> = {};
    const lineCounts: number[] = [];

    for (const row of rows) {
      try {
        const calls = JSON.parse(row.tool_calls) as { function: { name: string; arguments: string } }[];
        for (const call of calls) {
          if (call.function.name !== 'execute_code') continue;
          const args = JSON.parse(call.function.arguments);
          const code = (args.code || '') as string;
          const lines = code.split('\n');
          const lineCount = lines.length;
          lineCounts.push(lineCount);

          bySource[row.source] = (bySource[row.source] || 0) + 1;
          byDay[row.day] = (byDay[row.day] || 0) + 1;

          const imports: string[] = [];
          for (const line of lines) {
            if (line.includes('from hermes_tools import')) {
              const match = line.match(/import\s+(.+)/);
              if (match) {
                for (const tool of match[1].split(',')) {
                  const t = tool.trim();
                  if (t) {
                    imports.push(t);
                    toolImports[t] = (toolImports[t] || 0) + 1;
                  }
                }
              }
            }
          }

          executions.push({
            session_id: row.session_id,
            session_title: row.session_title || row.session_id,
            source: row.source,
            timestamp: row.timestamp,
            line_count: lineCount,
            imports,
            code_preview: code.slice(0, 300),
          });
        }
      } catch {}
    }

    const config = readHermesYaml<HermesConfig>('config.yaml');
    const execConfig = config?.code_execution || {};

    return NextResponse.json({
      executions: executions.slice(0, 50),
      totalCalls: executions.length,
      bySource,
      byDay,
      toolImports,
      avgLines: lineCounts.length > 0 ? Math.round(lineCounts.reduce((a, b) => a + b, 0) / lineCounts.length) : 0,
      maxLines: lineCounts.length > 0 ? Math.max(...lineCounts) : 0,
      config: {
        timeout: execConfig.timeout || 300,
        maxToolCalls: execConfig.max_tool_calls || 50,
      },
    });
  } catch (err) {
    db.close();
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
