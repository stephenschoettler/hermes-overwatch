export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { hermesPath, readHermesJson } from '@/lib/hermes';

interface CronJob {
  id: string;
  name: string;
  prompt: string;
  skills: string[];
  skill: string | null;
  model: string | null;
  provider: string | null;
  schedule: { kind: string; expr: string; display?: string } | string;
  schedule_display: string;
  repeat: { times: number | null; completed: number };
  enabled: boolean;
  state: string;
  paused_at: string | null;
  paused_reason: string | null;
  created_at: string;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  deliver: string;
  origin: Record<string, unknown> | null;
}

interface CronFile {
  jobs: CronJob[];
  updated_at: string;
}

export async function GET() {
  try {
    const cronFile = readHermesJson<CronFile>('cron/jobs.json');
    if (!cronFile) {
      return NextResponse.json({ jobs: [], outputs: {} });
    }

    // Get latest output for each job
    const outputs: Record<string, { file: string; content: string; date: string }[]> = {};
    const outputDir = hermesPath('cron/output');

    for (const job of cronFile.jobs) {
      const jobDir = path.join(outputDir, job.id);
      if (!fs.existsSync(jobDir)) continue;

      try {
        const files = fs.readdirSync(jobDir)
          .filter(f => f.endsWith('.md'))
          .sort()
          .reverse()
          .slice(0, 5); // last 5 outputs

        outputs[job.id] = files.map(f => {
          let content = '';
          try {
            content = fs.readFileSync(path.join(jobDir, f), 'utf-8');
          } catch {}
          return {
            file: f,
            content,
            date: f.replace('.md', '').replace(/_/g, ' '),
          };
        });
      } catch {}
    }

    return NextResponse.json({
      jobs: cronFile.jobs,
      outputs,
      updatedAt: cronFile.updated_at,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
