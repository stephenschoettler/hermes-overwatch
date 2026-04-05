#!/usr/bin/env node
/**
 * take-screenshots.mjs
 *
 * Starts Overwatch on port 3334 pointed at a demo HERMES_HOME,
 * captures screenshots of key pages with Playwright, then shuts down.
 *
 * Usage:
 *   node scripts/take-screenshots.mjs [--dest docs/screenshots] [--hermes-home /tmp/hermes-demo] [--port 3334]
 */

import { chromium } from 'playwright';
import { spawn, execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const PORT       = parseInt(arg('--port', '3334'), 10);
const HERMES_HOME = arg('--hermes-home', '/tmp/hermes-demo');
const DEST       = resolve(ROOT, arg('--dest', 'docs/screenshots'));
const BASE_URL   = `http://localhost:${PORT}`;

// ---------------------------------------------------------------------------
// Pages to capture
// ---------------------------------------------------------------------------

const PAGES = [
  { route: '/',          name: 'overview',  waitFor: 'Overview',   width: 1400, height: 900 },
  { route: '/sessions',  name: 'sessions',  waitFor: 'Sessions',   width: 1400, height: 900 },
  { route: '/analytics', name: 'analytics', waitFor: 'Analytics',  width: 1400, height: 900 },
  { route: '/activity',  name: 'activity',  waitFor: 'Activity',   width: 1400, height: 900 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForServer(url, timeoutMs = 60_000) {
  const start = Date.now();
  process.stdout.write(`  Waiting for server at ${url}`);
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`).catch(() => null);
      if (res && (res.ok || res.status === 404)) { // 404 means server is up, just no health route
        process.stdout.write(' ready\n');
        return;
      }
    } catch { /* ignore */ }
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

function killPort(port) {
  try { execSync(`fuser -k ${port}/tcp 2>/dev/null`, { stdio: 'ignore' }); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!existsSync(HERMES_HOME)) {
    console.error(`\nError: HERMES_HOME not found at ${HERMES_HOME}`);
    console.error('Run  python scripts/seed-demo.py  first.\n');
    process.exit(1);
  }

  mkdirSync(DEST, { recursive: true });

  // Kill any existing process on the port
  killPort(PORT);

  // Start Next.js server
  console.log(`\nStarting Overwatch on port ${PORT} ...`);
  const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: ROOT,
    env: { ...process.env, HERMES_HOME, OVERWATCH_PASSWORD: '', PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  server.stderr.on('data', d => {
    const s = d.toString();
    if (s.includes('Error') || s.includes('error')) process.stderr.write('  [server] ' + s);
  });

  let cleanup = async () => {
    server.kill('SIGTERM');
    killPort(PORT);
  };
  process.on('SIGINT', () => cleanup().then(() => process.exit(1)));

  try {
    // Give Next.js a moment to start binding before polling
    await new Promise(r => setTimeout(r, 2000));
    await waitForServer(BASE_URL);

    // Extra settle time — Next.js is up but SQLite reads need a tick
    await new Promise(r => setTimeout(r, 1500));

    const browser = await chromium.launch({ headless: true });

    for (const { route, name, waitFor, width, height } of PAGES) {
      const page = await browser.newPage();
      await page.setViewportSize({ width, height });

      console.log(`  Capturing ${route} → ${name}.png`);
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 30_000 });

      // Wait for at least one known element to appear
      try {
        await page.waitForSelector(`text=${waitFor.replace('text=', '')}`, { timeout: 10_000 });
      } catch { /* page loaded, selector just didn't match exactly — continue */ }

      // Extra render settle (charts, lazy fetches)
      await new Promise(r => setTimeout(r, 800));

      const outPath = join(DEST, `${name}.png`);
      await page.screenshot({ path: outPath, fullPage: false });
      await page.close();
      console.log(`    Saved ${outPath}`);
    }

    await browser.close();
    console.log(`\nAll screenshots saved to ${DEST}\n`);
  } finally {
    await cleanup();
  }
}

main().catch(err => {
  console.error('\nScreenshot failed:', err.message);
  process.exit(1);
});
