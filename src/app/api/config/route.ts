export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { readProfileYaml, redactSecrets } from '@/lib/hermes';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  try {
  const { searchParams } = new URL(req.url);
  const profileParam = searchParams.get('profile');
  const cookieStore = await cookies();
  const profileName = (profileParam && profileParam !== 'system') ? profileParam : cookieStore.get('overwatch-profile')?.value;
    const raw = readProfileYaml<Record<string, unknown>>(profileName, 'config.yaml');
    if (!raw) {
      return NextResponse.json({ error: 'config.yaml not found' }, { status: 404 });
    }

    const redacted = redactSecrets(raw) as Record<string, unknown>;

    // Pull out key sections for structured display
    const model = raw.model as Record<string, unknown> || {};
    const terminal = raw.terminal as Record<string, unknown> || {};
    const display = raw.display as Record<string, unknown> || {};
    const tts = raw.tts as Record<string, unknown> || {};
    const stt = raw.stt as Record<string, unknown> || {};
    const memory = raw.memory as Record<string, unknown> || {};
    const browser = raw.browser as Record<string, unknown> || {};
    const cron = raw.cron as Record<string, unknown> || {};
    const mcp = raw.mcp_servers as Record<string, unknown> || {};
    const delegation = raw.delegation as Record<string, unknown> || {};
    const security = raw.security as Record<string, unknown> || {};
    const compression = raw.compression as Record<string, unknown> || {};

    return NextResponse.json({
      sections: {
        model,
        display,
        terminal,
        tts: redactSecrets(tts),
        stt,
        memory,
        browser,
        mcp_servers: redactSecrets(mcp),
        delegation,
        compression,
        cron,
        security: redactSecrets(security),
      },
      mcpServerNames: Object.keys(mcp),
      configVersion: raw._config_version,
      full: redacted,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
