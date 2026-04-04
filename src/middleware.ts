import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, isAuthEnabled } from '@/lib/auth';

export function middleware(req: NextRequest) {
  // Skip auth for login page and login API
  if (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/api/auth/login') {
    return NextResponse.next();
  }

  // Skip auth for health check
  if (req.nextUrl.pathname === '/api/health') {
    return NextResponse.next();
  }

  // If auth is not enabled, allow everything
  if (!isAuthEnabled()) {
    return NextResponse.next();
  }

  // Check auth
  if (!isAuthenticated(req)) {
    // API routes get 401
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Pages redirect to login
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
