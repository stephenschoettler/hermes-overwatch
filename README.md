# 👁️ Overwatch

A local operations dashboard for [Hermes Agent](https://github.com/hermes-agent/hermes-agent).

Monitor sessions, browse history, manage cron jobs, view skills and memory, track token costs — all from one place.

---

## Features

- **Session Browser** — search and browse conversation history with full transcript viewer
- **Cron Management** — view scheduled jobs, trigger runs, pause/resume
- **Skills Browser** — explore installed skills by category
- **Memory Viewer** — see agent memory and user profile
- **Config Viewer** — read-only config display with automatic secret redaction
- **System Status** — health checks, disk usage, process info

---

## Quick Start

```bash
# Clone
git clone https://github.com/your-username/overwatch.git
cd overwatch

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

- **No password set** — open access, suitable for localhost or trusted networks
- **Password set** — cookie-based login, 30-day session, HttpOnly cookie
- **Secret redaction** — API keys, tokens, and credentials are automatically masked in the config viewer
- **Localhost only** — binds to `127.0.0.1` by default. Expose to your network at your own discretion.

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
