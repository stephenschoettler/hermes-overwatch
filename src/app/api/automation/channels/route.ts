export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { readHermesJson, readHermesYaml } from '@/lib/hermes';

interface ChannelDirectory {
  updated_at: string;
  platforms: Record<string, { id: string; name: string; type: string; thread_id: string | null }[]>;
}

interface HermesConfig {
  cron?: { wrap_response?: boolean };
}

export async function GET() {
  try {
    const channels = readHermesJson<ChannelDirectory>('channel_directory.json');
    const config = readHermesYaml<HermesConfig>('config.yaml');

    return NextResponse.json({
      channels: channels?.platforms || {},
      updatedAt: channels?.updated_at || null,
      cronWrapResponse: config?.cron?.wrap_response !== false,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
