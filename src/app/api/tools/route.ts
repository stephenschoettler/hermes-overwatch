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
  platform_toolsets?: Record<string, string[]>;
  mcp_servers?: Record<string, Record<string, unknown>>;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const profileParam = searchParams.get('profile');
  const cookieStore = await cookies();
  const profileName = (profileParam && profileParam !== 'system') ? profileParam : cookieStore.get('overwatch-profile')?.value;
  const db = getDb(profileName);
  if (!db) return NextResponse.json({ error: 'state.db not found' }, { status: 500 });

  try {
    // Parse tool usage from tool_calls JSON in assistant messages
    const rows = db.prepare(`
      SELECT tool_calls, session_id FROM messages 
      WHERE role = 'assistant' AND tool_calls IS NOT NULL
    `).all() as { tool_calls: string; session_id: string }[];

    const toolCounts: Record<string, number> = {};
    const toolBySession: Record<string, Set<string>> = {};

    for (const row of rows) {
      try {
        const calls = JSON.parse(row.tool_calls) as { function: { name: string } }[];
        for (const call of calls) {
          const name = call.function?.name;
          if (!name) continue;
          toolCounts[name] = (toolCounts[name] || 0) + 1;
          if (!toolBySession[name]) toolBySession[name] = new Set();
          toolBySession[name].add(row.session_id);
        }
      } catch {}
    }

    // Tool usage by day
    const dailyRows = db.prepare(`
      SELECT date(m.timestamp, 'unixepoch', 'localtime') as day, m.tool_calls
      FROM messages m
      WHERE m.role = 'assistant' AND m.tool_calls IS NOT NULL
        AND m.timestamp > unixepoch('now', '-7 days')
    `).all() as { day: string; tool_calls: string }[];

    const dailyToolCounts: Record<string, Record<string, number>> = {};
    for (const row of dailyRows) {
      try {
        const calls = JSON.parse(row.tool_calls) as { function: { name: string } }[];
        for (const call of calls) {
          const name = call.function?.name;
          if (!name) continue;
          if (!dailyToolCounts[row.day]) dailyToolCounts[row.day] = {};
          dailyToolCounts[row.day][name] = (dailyToolCounts[row.day][name] || 0) + 1;
        }
      } catch {}
    }

    // Tool usage by source
    const sourceRows = db.prepare(`
      SELECT s.source, m.tool_calls
      FROM messages m JOIN sessions s ON s.id = m.session_id
      WHERE m.role = 'assistant' AND m.tool_calls IS NOT NULL
    `).all() as { source: string; tool_calls: string }[];

    const toolBySource: Record<string, Record<string, number>> = {};
    for (const row of sourceRows) {
      try {
        const calls = JSON.parse(row.tool_calls) as { function: { name: string } }[];
        for (const call of calls) {
          const name = call.function?.name;
          if (!name) continue;
          if (!toolBySource[row.source]) toolBySource[row.source] = {};
          toolBySource[row.source][name] = (toolBySource[row.source][name] || 0) + 1;
        }
      } catch {}
    }

    db.close();

    // Build sorted tool list
    const tools = Object.entries(toolCounts)
      .map(([name, calls]) => ({
        name,
        calls,
        sessions: toolBySession[name]?.size || 0,
        isMcp: name.startsWith('mcp_'),
        category: categorize(name),
      }))
      .sort((a, b) => b.calls - a.calls);

    const totalCalls = tools.reduce((a, t) => a + t.calls, 0);

    // Config data
    const config = readProfileYaml<HermesConfig>(profileName, 'config.yaml');
    const platformToolsets = config?.platform_toolsets || {};
    const mcpServers = Object.keys(config?.mcp_servers || {});

    return NextResponse.json({
      tools,
      totalCalls,
      uniqueTools: tools.length,
      toolBySource,
      dailyToolCounts,
      platformToolsets,
      mcpServers,
    });
  } catch (err) {
    db.close();
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function categorize(name: string): string {
  if (name.startsWith('mcp_browser_use')) return 'Browser (MCP)';
  if (name.startsWith('mcp_github')) return 'GitHub (MCP)';
  if (name.startsWith('mcp_context7')) return 'Context7 (MCP)';
  if (name.startsWith('mcp_huggingface')) return 'HuggingFace (MCP)';
  if (name.startsWith('mcp_sequential')) return 'Thinking (MCP)';
  if (name.startsWith('mcp_')) return 'MCP';
  if (['terminal', 'process'].includes(name)) return 'Terminal';
  if (['read_file', 'write_file', 'search_files', 'patch'].includes(name)) return 'File';
  if (['web_search', 'web_extract'].includes(name)) return 'Web';
  if (['browser_navigate', 'browser_snapshot', 'browser_scroll', 'browser_click', 'browser_vision', 'browser_type'].includes(name)) return 'Browser';
  if (['memory', 'session_search'].includes(name)) return 'Memory';
  if (['skill_view', 'skill_manage', 'skills_list'].includes(name)) return 'Skills';
  if (['execute_code'].includes(name)) return 'Code Execution';
  if (['todo', 'cronjob', 'delegate_task', 'send_message'].includes(name)) return 'Orchestration';
  if (['text_to_speech', 'vision_analyze', 'image_generate'].includes(name)) return 'Media';
  if (['clarify'].includes(name)) return 'Interaction';
  return 'Other';
}
