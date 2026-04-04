export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getHermesHome } from '@/lib/hermes';

const CONTEXT_NAMES = ['.hermes.md', 'HERMES.md', 'AGENTS.md', 'CLAUDE.md', '.cursorrules'];
const CHAR_LIMIT = 20_000;

// Priority labels per doc
function priorityLabel(name: string): 'highest' | 'high' | 'medium' | 'low' {
  if (name === '.hermes.md' || name === 'HERMES.md') return 'highest';
  if (name === 'AGENTS.md') return 'high';
  if (name === 'CLAUDE.md') return 'medium';
  return 'low';
}

function tryRead(p: string): string | null {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return null; }
}

export async function GET() {
  const hermesHome = getHermesHome();
  const homeDir = process.env.HOME || path.dirname(hermesHome);

  // Directories to probe, in priority order
  const scanDirs = [
    homeDir,
    hermesHome,
    path.join(hermesHome, 'hermes-agent'),
  ];

  const seen = new Set<string>();
  const files: {
    name: string;
    displayPath: string;
    content: string;
    charCount: number;
    truncated: boolean;
    priority: string;
  }[] = [];

  for (const dir of scanDirs) {
    for (const name of CONTEXT_NAMES) {
      const fullPath = path.join(dir, name);
      if (seen.has(fullPath)) continue;
      seen.add(fullPath);

      const raw = tryRead(fullPath);
      if (raw === null) continue;

      const truncated = raw.length > CHAR_LIMIT;
      const content = truncated
        ? raw.slice(0, Math.floor(CHAR_LIMIT * 0.7))
          + `\n\n[...truncated: showing ${Math.floor(CHAR_LIMIT * 0.7).toLocaleString()} of ${raw.length.toLocaleString()} chars...]\n\n`
          + raw.slice(-Math.floor(CHAR_LIMIT * 0.2))
        : raw;

      files.push({
        name,
        displayPath: fullPath.replace(homeDir, '~'),
        content,
        charCount: raw.length,
        truncated,
        priority: priorityLabel(name),
      });
    }
  }

  return NextResponse.json({ files });
}
