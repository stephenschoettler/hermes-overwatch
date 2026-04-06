export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { profilePath, getActiveProfileHome, getGatewayServiceName } from '@/lib/hermes';
import { cookies } from 'next/headers';

const TOKEN_RE=/\b\d{...}/g;

function redactLogs(s: string): string {
  return s.replace(TOKEN_RE, '[token redacted]');
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const profileName = cookieStore.get('overwatch-profile')?.value;
  const profileHome = getActiveProfileHome(profileName);
  const gatewayUnit = getGatewayServiceName(profileHome, profileName);

  const url = new URL(req.url);
  const lines = Math.min(parseInt(url.searchParams.get('lines') || '50'), 200);
  const source = url.searchParams.get('source') || 'journalctl';

  return new Promise<NextResponse>((resolve) => {
    let cmd: string;

    if (source === 'gateway-log') {
      // Read from the log file directly
      const logPath = profilePath(profileName, 'logs/gateway.log');
      cmd = `tail -n ${lines} ${logPath} 2>/dev/null || echo "No gateway.log found"`;
    } else if (source === 'errors') {
      const logPath = profilePath(profileName, 'logs/errors.log');
      cmd = `tail -n ${lines} ${logPath} 2>/dev/null || echo "No errors.log found"`;
    } else {
      // Default: journalctl for the systemd service
      cmd = `journalctl --user -u ${gatewayUnit} -n ${lines} --no-pager 2>/dev/null || echo "journalctl not available"`;
    }

    const child = exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
      const raw = stdout.trim() || stderr.trim() || (error ? `Error: ${String(error)}` : '');
      const logs = redactLogs(raw);
      resolve(NextResponse.json({ logs, source, timestamp: new Date().toISOString() }));
    });
    child.on('error', (err) => {
      resolve(NextResponse.json({ logs: `Error: ${String(err)}`, source, timestamp: new Date().toISOString() }));
    });
  });
}
