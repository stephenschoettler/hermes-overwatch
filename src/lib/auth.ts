import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE = 'overwatch-auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Get the configured password. If empty/unset, auth is disabled.
 */
export function getPassword(): string {
  return process.env.OVERWATCH_PASSWORD || '';
}

export function isAuthEnabled(): boolean {
  return getPassword().length > 0;
}

/**
 * Check if a request is authenticated.
 * Returns true if auth is disabled OR the cookie is valid.
 */
export function isAuthenticated(req: NextRequest): boolean {
  if (!isAuthEnabled()) return true;

  const cookie = req.cookies.get(AUTH_COOKIE);
  if (!cookie) return false;

  // Simple hash comparison — not crypto-grade, but sufficient for
  // a local dashboard password gate
  return cookie.value === hashPassword(getPassword());
}

/**
 * Simple hash for the password cookie value.
 * We don't store the password in the cookie — just a deterministic hash.
 */
export function hashPassword(password: string): string {
  let hash = 0;
  const str = 'overwatch-salt-' + password;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

export function createAuthCookie(): string {
  const value = hashPassword(getPassword());
  return `${AUTH_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

export function clearAuthCookie(): string {
  return `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
