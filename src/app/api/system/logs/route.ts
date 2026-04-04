export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { exec } from 'child_process';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lines = Math.min(parseInt(url.searchParams.get('lines') || '50'), 200);
  const source = url.searchParams.get('source') || 'journalctl';

  return new Promise<NextResponse>((resolve) => {
    let cmd: string;

    if (source === 'gateway-log') {
      // Read from the log file directly
      cmd = `tail -n ${lines} ~/.hermes/logs/gateway.log 2>/dev/null || echo "No gateway.log found"`;
    } else if (source === 'errors') {
      cmd = `tail -n ${lines} ~/.hermes/logs/errors.log 2>/dev/null || echo "No errors.log found"`;
    } else {
      // Default: journalctl for the systemd service
      cmd = `journalctl --user -u hermes-gateway -n ${lines} --no-pager 2>/dev/null || echo "journalctl not available"`;
    }

    const child = exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
      const logs = stdout.trim() || stderr.trim() || (error ? `Error: ${String(error)}` : '');
      resolve(NextResponse.json({ logs, source, timestamp: new Date().toISOString() }));
    });
    child.on('error', (err) => {
      resolve(NextResponse.json({ logs: `Error: ${String(err)}`, source, timestamp: new Date().toISOString() }));
    });
  });
}
