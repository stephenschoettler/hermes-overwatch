export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolveProfileHome, getHermesHome } from '@/lib/hermes';

export async function POST(req: Request) {
  try {
    const { name } = await req.json() as { name?: unknown };
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Missing profile name' }, { status: 400 });
    }

    const resolved = resolveProfileHome(name);
    // If it resolved to default home but name wasn't 'default', the profile doesn't exist
    if (resolved === getHermesHome() && name !== 'default') {
      return NextResponse.json({ error: `Profile '${name}' not found` }, { status: 404 });
    }

    const cookieStore = await cookies();
    cookieStore.set('overwatch-profile', name, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });

    return NextResponse.json({ ok: true, profile: name });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
