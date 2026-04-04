# 👁️ Overwatch

A local operations dashboard for [Hermes Agent](https://github.com/hermes-agent/hermes-agent).

Monitor sessions, browse history, inspect cron activity, view skills and memory, and track token costs — all from one place.

---

## Security Notes

Overwatch reads directly from your local Hermes home directory, which may contain session transcripts, memory, configuration, logs, cron metadata, and other sensitive operational data.

Before exposing Overwatch beyond localhost:
- set `OVERWATCH_PASSWORD`
- review the data visible in Memory, Config, and System pages
- verify screenshots and docs do not include hostnames, local paths, process IDs, session IDs, or token-like strings

This repo intentionally does not ship live dashboard screenshots until they are sanitized.

---

## Features

- **Session Browser** — search and browse conversation history with full transcript viewer
- **Cron Visibility** — inspect scheduled jobs, timing, status, and recent outputs
- **Skills Browser** — explore installed skills by category
- **Memory Viewer** — see agent memory and user profile
- **Config Viewer** — read-only config display with automatic secret redaction
- **System Status** — health checks, disk usage, process info

---

## Quick Start

```bash
# Clone
git clone https://github.com/stephenschoettler/Hermes-Overwatch.git
cd Hermes-Overwatch

# Install
npm install

# Build
npm run build

# Start
npm start
```

Overwatch will be available at **http://localhost:3333**.

It reads from `~/.hermes` by default. Set `HERMES_HOME` to point to a different Hermes installation.

---

## Configuration

Copy `.env.example` to `.env.local` and customize:

```bash
cp .env.example .env.local
```

| Variable | Default | Description |
|---|---|---|
| `OVERWATCH_PASSWORD` | *(empty)* | Optional password. If set, requires login. If empty, open access. |
| `HERMES_HOME` | `~/.hermes` | Path to the Hermes home directory |

### Security

- **No password set** — open access, suitable only for localhost or a trusted private network
- **Password set** — cookie-based login, 30-day session, HttpOnly cookie
- **Secret redaction** — API keys, tokens, and credentials are automatically masked in the config viewer
- **Sensitive by design** — Memory, Config, System, and transcript views can expose private local agent data
- **Localhost only** — binds to `127.0.0.1` by default. Expose to your network only if you understand the risk.

---

## Development

```bash
npm run dev
```

Runs on port 3333 in dev mode with hot reload.

---

## Architecture

- **Next.js 14** (App Router) — frontend + API routes
- **Tailwind CSS** — dark theme UI
- **better-sqlite3** — reads directly from Hermes `state.db` (read-only)
- **No external database** — all data comes from the local `~/.hermes` directory

### Data Sources

| Source | What it provides |
|---|---|
| `state.db` | Sessions, messages, token counts, costs (SQLite + FTS5 search) |
| `cron/jobs.json` | Scheduled cron jobs |
| `config.yaml` | Agent configuration (redacted in UI) |
| `memories/` | Agent memory and user profile |
| `skills/` | Installed skill definitions |

Overwatch is **read-only** — it observes your Hermes installation, it does not modify it.

---

## Requirements

- **Node.js 18+**
- **Hermes Agent** installed (`~/.hermes` directory exists)

---

## License

MIT
