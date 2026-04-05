#!/usr/bin/env bash
# demo-screenshots.sh — seed demo data and take Overwatch screenshots
#
# Usage:
#   npm run screenshots
#   scripts/demo-screenshots.sh [--port 3334] [--hermes-home /tmp/hermes-demo] [--dest docs/screenshots]
#
# Requires:
#   - Python 3 (for seed script)
#   - Built Next.js app (.next/ must exist — run npm run build first)
#   - Playwright Chromium (npx playwright install chromium)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

PORT="${PORT:-3334}"
HERMES_HOME="${HERMES_HOME:-/tmp/hermes-demo}"
DEST="${DEST:-$ROOT/docs/screenshots}"

# Parse flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)         PORT="$2";         shift 2 ;;
    --hermes-home)  HERMES_HOME="$2";  shift 2 ;;
    --dest)         DEST="$2";         shift 2 ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

echo ""
echo "=== Overwatch screenshot pipeline ==="
echo "  HERMES_HOME : $HERMES_HOME"
echo "  Port        : $PORT"
echo "  Output      : $DEST"
echo ""

# Step 1 — seed demo data
echo "--- Step 1: Seed demo data ---"
python3 "$SCRIPT_DIR/seed-demo.py" --dest "$HERMES_HOME"

# Step 2 — ensure Next.js is built
if [[ ! -d "$ROOT/.next" ]]; then
  echo ""
  echo "--- Step 2: Build Overwatch ---"
  cd "$ROOT" && npm run build
else
  echo ""
  echo "--- Step 2: Using existing build (.next/ found) ---"
fi

# Step 3 — take screenshots (script handles server lifecycle)
echo ""
echo "--- Step 3: Capture screenshots ---"
cd "$ROOT"
node scripts/take-screenshots.mjs \
  --port "$PORT" \
  --hermes-home "$HERMES_HOME" \
  --dest "$DEST"

echo "=== Done ==="
