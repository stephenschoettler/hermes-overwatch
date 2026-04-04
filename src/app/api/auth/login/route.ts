import { NextRequest, NextResponse } from 'next/server';
import { getPassword, isAuthEnabled, createAuthCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ ok: true, message: 'Auth not enabled' });
  }

  try {
    const body = await req.json();
    const { password } = body;

    if (password === getPassword()) {
      const res = NextResponse.json({ ok: true });
      res.headers.set('Set-Cookie', createAuthCookie());
      return res;
    }

    return NextResponse.json({ ok: false, error: 'Wrong password' }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
  }
}
