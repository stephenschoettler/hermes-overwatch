export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { readProfileJson, readProfileYaml } from '@/lib/hermes';
import { cookies } from 'next/headers';

interface ChannelDirectory {
  updated_at: string;
  platforms: Record<string, { id: string; name: string; type: string; thread_id: string | null }[]>;
}

interface HermesConfig {
  cron?: { wrap_response?: boolean };
}

export async function GET(req: Request) {
  try {
  const { searchParams } = new URL(req.url);
  const profileParam = searchParams.get('profile');
  const cookieStore = await cookies();
  const profileName = (profileParam && profileParam !== 'system') ? profileParam : cookieStore.get('overwatch-profile')?.value;
    const channels = readProfileJson<ChannelDirectory>(profileName, 'channel_directory.json');
    const config = readProfileYaml<HermesConfig>(profileName, 'config.yaml');

    return NextResponse.json({
      channels: channels?.platforms || {},
      updatedAt: channels?.updated_at || null,
      cronWrapResponse: config?.cron?.wrap_response !== false,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
