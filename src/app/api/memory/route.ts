export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import { hermesPath, readHermesYaml } from '@/lib/hermes';

interface MemoryConfig {
  memory?: {
    memory_enabled?: boolean;
    user_profile_enabled?: boolean;
    memory_char_limit?: number;
    user_char_limit?: number;
    nudge_interval?: number;
    flush_min_turns?: number;
  };
}

function readFile(relativePath: string): string {
  try {
    return fs.readFileSync(hermesPath(relativePath), 'utf-8');
  } catch {
    return '';
  }
}

function parseEntries(content: string): string[] {
  if (!content.trim()) return [];
  return content.split('§').map(s => s.trim()).filter(Boolean);
}

export async function GET() {
  try {
    const memoryContent = readFile('memories/MEMORY.md');
    const userContent = readFile('memories/USER.md');
    const soulContent = readFile('SOUL.md');

    const config = readHermesYaml<MemoryConfig>('config.yaml');
    const memConfig = config?.memory || {};

    const memoryEntries = parseEntries(memoryContent);
    const userEntries = parseEntries(userContent);

    return NextResponse.json({
      memory: {
        content: memoryContent,
        entries: memoryEntries,
        charCount: memoryContent.length,
        charLimit: memConfig.memory_char_limit || 2200,
        enabled: memConfig.memory_enabled !== false,
      },
      user: {
        content: userContent,
        entries: userEntries,
        charCount: userContent.length,
        charLimit: memConfig.user_char_limit || 1375,
        enabled: memConfig.user_profile_enabled !== false,
      },
      soul: {
        content: soulContent,
        charCount: soulContent.length,
      },
      config: {
        nudgeInterval: memConfig.nudge_interval || 10,
        flushMinTurns: memConfig.flush_min_turns || 6,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
