export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

const SERVICE_MAP: Record<string, string> = {
  gateway: 'hermes-gateway',
  overwatch: 'overwatch',
};

export async function POST(req: Request) {
  try {
    const { service } = await req.json();
    if (!service || typeof service !== 'string') {
      return NextResponse.json({ error: 'Missing service' }, { status: 400 });
    }

    const unit = SERVICE_MAP[service];
    if (!unit) {
      return NextResponse.json({ error: 'Unknown service' }, { status: 400 });
    }

    execSync(`systemctl --user reset-failed ${unit} >/dev/null 2>&1 || true; systemctl --user restart --no-block ${unit}`, {
      timeout: 10000,
      encoding: 'utf8',
      shell: '/bin/bash',
    });
    return NextResponse.json({ ok: true, service, unit });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
