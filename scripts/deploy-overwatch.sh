#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/w0lf/overwatch"
SERVICE_NAME="overwatch"
PORT="3333"
HEALTH_URL="http://127.0.0.1:${PORT}"

log() {
  printf '\n==> %s\n' "$1"
}

fail() {
  printf '\nERROR: %s\n' "$1" >&2
  exit 1
}

command -v systemctl >/dev/null 2>&1 || fail "systemctl is required"
command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v npm >/dev/null 2>&1 || fail "npm is required"

cd "$APP_DIR"

if ! systemctl --user status "${SERVICE_NAME}.service" >/dev/null 2>&1; then
  fail "${SERVICE_NAME}.service is not installed under systemd --user"
fi

log "Building Overwatch"
npm run build

log "Restarting ${SERVICE_NAME}.service"
systemctl --user restart "${SERVICE_NAME}.service"

log "Waiting for HTTP health on ${HEALTH_URL}"
for attempt in {1..20}; do
  if curl -fsSI "$HEALTH_URL" >/dev/null 2>&1; then
    printf 'Healthy after %s attempt(s).\n' "$attempt"
    break
  fi
  sleep 1
  if [[ "$attempt" == "20" ]]; then
    systemctl --user status "${SERVICE_NAME}.service" --no-pager || true
    journalctl --user -u "${SERVICE_NAME}.service" -n 50 --no-pager || true
    fail "Overwatch did not become healthy on ${HEALTH_URL}"
  fi
done

log "Service status"
systemctl --user status "${SERVICE_NAME}.service" --no-pager

log "HTTP response"
curl -I -s "$HEALTH_URL" | head -n 5

log "Done"
printf 'Deploy helper completed successfully.\n'
