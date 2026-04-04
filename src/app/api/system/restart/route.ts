import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function POST(req: Request) {
  try {
    const { service } = await req.json();
    if (!service) return NextResponse.json({ error: 'Missing service' }, { status: 400 });

    let cmd = '';
    if (service === 'gateway') {
      cmd = 'systemctl --user restart hermes-gateway';
    } else if (service === 'overwatch') {
      // If overwatch is running as a systemd service
      cmd = 'systemctl --user restart hermes-overwatch 2>/dev/null || echo "no systemd service"';
    } else {
      return NextResponse.json({ error: 'Unknown service' }, { status: 400 });
    }

    execSync(cmd, { timeout: 10000 });
    return NextResponse.json({ ok: true, service });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
