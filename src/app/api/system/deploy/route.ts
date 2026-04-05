export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

const APP_DIR = process.env.OVERWATCH_DIR || process.cwd();
const DEPLOY_UNIT = 'overwatch-deploy';

export async function POST() {
  try {
    const cmd = `systemctl --user stop ${DEPLOY_UNIT}.service >/dev/null 2>&1 || true; systemd-run --user --unit ${DEPLOY_UNIT} --collect /usr/bin/bash -lc 'cd ${APP_DIR} && ./scripts/deploy-overwatch.sh'`;
    const output = execSync(cmd, {
      timeout: 10000,
      encoding: 'utf8',
      shell: '/bin/bash',
    }).trim();

    return NextResponse.json({
      ok: true,
      unit: `${DEPLOY_UNIT}.service`,
      output,
      message: 'Overwatch deploy started',
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
