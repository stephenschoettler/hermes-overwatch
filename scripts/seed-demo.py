#!/usr/bin/env python3
"""
Seed a throwaway HERMES_HOME at /tmp/hermes-demo with realistic-looking
but entirely synthetic data. Safe to commit — no real keys, hostnames, or
personal information anywhere.

Usage:
    python scripts/seed-demo.py [--dest /tmp/hermes-demo]
"""

import sqlite3
import json
import os
import random
import shutil
import sys
import time
from datetime import datetime, timedelta, timezone

DEST = sys.argv[sys.argv.index("--dest") + 1] if "--dest" in sys.argv else "/tmp/hermes-demo"

random.seed(42)  # deterministic output


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def ts(dt: datetime) -> float:
    return dt.replace(tzinfo=timezone.utc).timestamp()


def ago(days=0, hours=0, minutes=0) -> datetime:
    return datetime.utcnow() - timedelta(days=days, hours=hours, minutes=minutes)


def mkdirs(*parts):
    p = os.path.join(DEST, *parts)
    os.makedirs(p, exist_ok=True)
    return p


def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(content)


# ---------------------------------------------------------------------------
# Reset
# ---------------------------------------------------------------------------

if os.path.exists(DEST):
    shutil.rmtree(DEST)
os.makedirs(DEST)


# ---------------------------------------------------------------------------
# state.db
# ---------------------------------------------------------------------------

db_path = os.path.join(DEST, "state.db")
db = sqlite3.connect(db_path)
db.executescript("""
CREATE TABLE schema_version (version INTEGER NOT NULL);
INSERT INTO schema_version VALUES (1);

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    user_id TEXT,
    model TEXT,
    model_config TEXT,
    system_prompt TEXT,
    parent_session_id TEXT,
    started_at REAL NOT NULL,
    ended_at REAL,
    end_reason TEXT,
    message_count INTEGER DEFAULT 0,
    tool_call_count INTEGER DEFAULT 0,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cache_read_tokens INTEGER DEFAULT 0,
    cache_write_tokens INTEGER DEFAULT 0,
    reasoning_tokens INTEGER DEFAULT 0,
    billing_provider TEXT,
    billing_base_url TEXT,
    billing_mode TEXT,
    estimated_cost_usd REAL,
    actual_cost_usd REAL,
    cost_status TEXT DEFAULT 'unknown',
    cost_source TEXT DEFAULT 'none',
    pricing_version TEXT,
    title TEXT,
    FOREIGN KEY (parent_session_id) REFERENCES sessions(id)
);

CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    role TEXT NOT NULL,
    content TEXT,
    tool_call_id TEXT,
    tool_calls TEXT,
    tool_name TEXT,
    timestamp REAL NOT NULL,
    token_count INTEGER,
    finish_reason TEXT,
    reasoning TEXT,
    reasoning_details TEXT,
    codex_reasoning_items TEXT
);

CREATE INDEX idx_sessions_source ON sessions(source);
CREATE INDEX idx_sessions_parent ON sessions(parent_session_id);
CREATE INDEX idx_sessions_started ON sessions(started_at DESC);
CREATE INDEX idx_messages_session ON messages(session_id, timestamp);

CREATE VIRTUAL TABLE messages_fts USING fts5(
    content, content=messages, content_rowid=id
);

CREATE TRIGGER messages_fts_insert AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
END;
CREATE TRIGGER messages_fts_delete AFTER DELETE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
END;
CREATE TRIGGER messages_fts_update AFTER UPDATE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
    INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
END;
""")

# ---------------------------------------------------------------------------
# Session templates
# ---------------------------------------------------------------------------

TITLES_CLI = [
    "Set up weekly digest cron job",
    "Debug Python data processing script",
    "Research API rate limiting strategies",
    "Review pull request changes",
    "Write unit tests for auth module",
    "Refactor database connection pooling",
    "Investigate memory leak in worker process",
    "Draft architecture doc for new service",
    "Fix flaky CI test in integration suite",
    "Optimize SQL queries for analytics endpoint",
    "Set up monitoring alerts for production",
    "Implement retry logic for external API calls",
    "Add structured logging to microservice",
    "Plan migration to new infrastructure",
    "Review security audit findings",
    "Build CLI tool for log analysis",
    "Configure deploy pipeline for staging",
    "Document API endpoints for onboarding",
    "Analyze usage metrics from last quarter",
    "Explore vector DB options for search feature",
]

TITLES_CRON = [
    "Daily activity digest",
    "Nightly skill evolution",
    "Weekly usage report",
    "Daily backup",
]

TITLES_TELEGRAM = [
    "Quick question about Python async patterns",
    "Help debugging TypeScript error",
    "Summarize recent news",
    "Research topic for upcoming meeting",
    "Explain concept from paper",
]

MODELS = [
    ("claude-sonnet-4-6", "anthropic", 0.55),
    ("claude-opus-4-6", "anthropic", 0.25),
    ("gpt-4o", "openai", 0.20),
]

TOOL_NAMES = [
    "mcp_terminal", "mcp_read_file", "mcp_write_file", "mcp_patch",
    "mcp_search_files", "mcp_web_search", "mcp_web_extract",
    "mcp_browser_navigate", "mcp_memory", "mcp_execute_code",
    "mcp_mcp_github_list_issues", "mcp_mcp_github_create_pull_request",
]

def pick_model():
    r = random.random()
    acc = 0.0
    for name, prov, weight in MODELS:
        acc += weight
        if r < acc:
            return name, prov
    return MODELS[0][0], MODELS[0][1]


def make_tool_calls(n):
    calls = []
    for _ in range(n):
        name = random.choice(TOOL_NAMES)
        calls.append({"id": f"call_{random.randint(10000,99999)}", "type": "function",
                       "function": {"name": name, "arguments": "{}"}})
    return json.dumps(calls)


def insert_session(sid, source, model, provider, start_dt, end_dt, title,
                   msgs, tools, in_tok, out_tok, cache_tok):
    db.execute("""
        INSERT INTO sessions (id, source, model, billing_provider, started_at, ended_at,
            end_reason, message_count, tool_call_count, input_tokens, output_tokens,
            cache_read_tokens, title, cost_status, cost_source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unknown', 'none')
    """, (sid, source, model, provider,
          ts(start_dt), ts(end_dt) if end_dt else None,
          "completed" if end_dt else None,
          msgs, tools, in_tok, out_tok, cache_tok, title))


def insert_messages(sid, start_dt, n_user_turns, tool_count):
    t = ts(start_dt) + 2
    for turn in range(n_user_turns):
        # user message
        prompts = [
            "Can you help me with this?",
            "Let's continue from where we left off.",
            "Take a look at this and suggest improvements.",
            "Run the tests and see what's failing.",
            "What are the tradeoffs here?",
            "Summarize what you found.",
        ]
        db.execute("""INSERT INTO messages (session_id, role, content, timestamp, token_count)
                      VALUES (?, 'user', ?, ?, ?)""",
                   (sid, random.choice(prompts), t, random.randint(20, 120)))
        t += random.uniform(0.5, 2.0)

        # assistant message with optional tool calls
        tc_json = None
        if tool_count > 0 and turn < tool_count:
            tc_json = make_tool_calls(min(3, tool_count - turn * 2 + 1))

        responses = [
            "I'll analyze this and get back to you.",
            "Looking at the code, I can see a few issues.",
            "Here's what I found after investigating.",
            "The approach I'd recommend is the following.",
            "Done — here are the results.",
        ]
        db.execute("""INSERT INTO messages (session_id, role, content, tool_calls, timestamp, token_count)
                      VALUES (?, 'assistant', ?, ?, ?, ?)""",
                   (sid, random.choice(responses), tc_json, t, random.randint(100, 800)))
        t += random.uniform(1.0, 5.0)

        # tool result (if tools used)
        if tc_json:
            db.execute("""INSERT INTO messages (session_id, role, content, tool_name, timestamp, token_count)
                          VALUES (?, 'tool', ?, ?, ?, ?)""",
                       (sid, '{"output": "Command completed successfully.", "exit_code": 0}',
                        random.choice(TOOL_NAMES), t, random.randint(50, 300)))
            t += random.uniform(0.2, 1.0)


# ---------------------------------------------------------------------------
# Generate sessions — 7 days of history
# ---------------------------------------------------------------------------

sessions = []

# CLI sessions — a few per day
for day in range(7):
    base = ago(days=6-day, hours=random.randint(8, 20))
    n = random.randint(3, 7)
    for _ in range(n):
        model, provider = pick_model()
        duration = timedelta(minutes=random.randint(8, 90))
        start = base + timedelta(minutes=random.randint(0, 200))
        end = start + duration
        msgs = random.randint(4, 18)
        tools = random.randint(2, 12)
        in_tok = random.randint(8000, 80000)
        out_tok = random.randint(1000, 15000)
        cache_tok = random.randint(10000, 200000)
        title = random.choice(TITLES_CLI)
        sid = f"cli_{int(ts(start))}_{random.randint(1000,9999)}"
        sessions.append((sid, "cli", model, provider, start, end, title,
                          msgs, tools, in_tok, out_tok, cache_tok))

# Cron sessions — a few per day
CRON_JOB_IDS = ["a1b2c3d4e5f6", "b2c3d4e5f6a1", "c3d4e5f6a1b2"]
CRON_JOB_NAMES = ["daily-summary", "nightly-skill-evolution", "daily-backup"]

for day in range(7):
    for i, (jid, jname) in enumerate(zip(CRON_JOB_IDS, CRON_JOB_NAMES)):
        # Not every cron runs every day
        if random.random() < 0.85:
            hour = [8, 1, 3][i]
            start = ago(days=6-day, hours=24-hour, minutes=random.randint(0, 5))
            duration = timedelta(minutes=random.randint(1, 8))
            end = start + duration
            model, provider = pick_model()
            msgs = random.randint(2, 6)
            tools = random.randint(1, 5)
            in_tok = random.randint(2000, 20000)
            out_tok = random.randint(300, 4000)
            sid = f"cron_{jid}_{start.strftime('%Y%m%d_%H%M%S')}"
            title = f"{jname} — {start.strftime('%b %d')}"
            sessions.append((sid, "cron", model, provider, start, end, title,
                              msgs, tools, in_tok, out_tok, 0))

# Telegram sessions
for day in range(7):
    if random.random() < 0.6:
        start = ago(days=6-day, hours=random.randint(10, 22))
        duration = timedelta(minutes=random.randint(3, 30))
        end = start + duration
        model, provider = pick_model()
        msgs = random.randint(2, 8)
        tools = random.randint(0, 4)
        in_tok = random.randint(1000, 15000)
        out_tok = random.randint(200, 3000)
        title = random.choice(TITLES_TELEGRAM)
        sid = f"telegram_{int(ts(start))}_{random.randint(1000,9999)}"
        sessions.append((sid, "telegram", model, provider, start, end, title,
                          msgs, tools, in_tok, out_tok, 0))

# Two active (no ended_at) sessions right now
for i in range(2):
    model, provider = pick_model()
    start = ago(minutes=random.randint(5, 40))
    msgs = random.randint(3, 8)
    tools = random.randint(1, 6)
    in_tok = random.randint(5000, 40000)
    out_tok = random.randint(500, 5000)
    title = random.choice(TITLES_CLI)
    sid = f"cli_{int(ts(start))}_{random.randint(1000,9999)}_active"
    sessions.append((sid, "cli", model, provider, start, None, title,
                      msgs, tools, in_tok, out_tok, random.randint(10000, 80000)))

# Insert all sessions + messages
random.shuffle(sessions)
for row in sessions:
    insert_session(*row)
    insert_messages(row[0], row[4], min(row[7] // 3, 8), row[8])

db.commit()
db.close()
print(f"  state.db: {len(sessions)} sessions")


# ---------------------------------------------------------------------------
# config.yaml
# ---------------------------------------------------------------------------

config = {
    "model": {
        "default": "claude-sonnet-4-6",
        "provider": "anthropic",
        "base_url": None,
    },
    "display": {
        "personality": "Assistant",
        "name": "Hermes",
    },
    "memory": {
        "memory_char_limit": 2200,
        "user_char_limit": 1375,
        "nudge_interval": 10,
        "flush_min_turns": 3,
    },
    "tts": {
        "enabled": True,
        "provider": "openai",
        "voice": "nova",
    },
    "stt": {
        "enabled": False,
    },
    "mcp_servers": {
        "github": {
            "command": "gh-mcp",
            "args": ["--stdio"],
        },
        "context7": {
            "command": "npx",
            "args": ["@upstash/context7-mcp"],
        },
        "browser-use": {
            "command": "python",
            "args": ["-m", "browser_use.mcp"],
        },
    },
    "delegation": {
        "enabled": True,
        "default_model": "claude-sonnet-4-6",
    },
    "code_execution": {
        "timeout": 300,
        "max_tool_calls": 50,
    },
    "security": {
        "api_keys": {
            "anthropic": "***REDACTED***",
            "openai": "***REDACTED***",
        },
    },
}

import re

def dump_yaml(obj, indent=0):
    lines = []
    prefix = "  " * indent
    if isinstance(obj, dict):
        for k, v in obj.items():
            if v is None:
                lines.append(f"{prefix}{k}:")
            elif isinstance(v, (dict, list)):
                lines.append(f"{prefix}{k}:")
                lines.extend(dump_yaml(v, indent + 1).splitlines())
            elif isinstance(v, bool):
                lines.append(f"{prefix}{k}: {'true' if v else 'false'}")
            elif isinstance(v, str):
                lines.append(f"{prefix}{k}: {json.dumps(v)}")
            else:
                lines.append(f"{prefix}{k}: {v}")
    elif isinstance(obj, list):
        for item in obj:
            if isinstance(item, str):
                lines.append(f"{prefix}- {json.dumps(item)}")
            else:
                lines.append(f"{prefix}-")
                lines.extend(dump_yaml(item, indent + 1).splitlines())
    return "\n".join(lines)

write(os.path.join(DEST, "config.yaml"), dump_yaml(config) + "\n")
print("  config.yaml")


# ---------------------------------------------------------------------------
# cron/jobs.json
# ---------------------------------------------------------------------------

now_iso = datetime.utcnow().isoformat() + "Z"
yesterday_iso = (datetime.utcnow() - timedelta(days=1)).isoformat() + "Z"
tomorrow_iso = (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z"

cron_jobs = {
    "jobs": [
        {
            "id": CRON_JOB_IDS[0],
            "name": CRON_JOB_NAMES[0],
            "schedule": "0 8 * * *",
            "schedule_display": "every day at 08:00",
            "enabled": True,
            "prompt": "Generate a concise daily summary of recent agent activity, notable sessions, and any patterns worth reviewing.",
            "delivery": "telegram",
            "model": "claude-sonnet-4-6",
            "provider": "anthropic",
            "run_count": 18,
            "last_status": "ok",
            "last_run_at": yesterday_iso,
            "next_run_at": tomorrow_iso,
            "created_at": (datetime.utcnow() - timedelta(days=25)).isoformat() + "Z",
        },
        {
            "id": CRON_JOB_IDS[1],
            "name": CRON_JOB_NAMES[1],
            "schedule": "0 1 * * *",
            "schedule_display": "every day at 01:00",
            "enabled": True,
            "prompt": "Review available skills and identify gaps. Run the self-evolution pipeline if improvements are due.",
            "delivery": "local",
            "model": "claude-opus-4-6",
            "provider": "anthropic",
            "run_count": 12,
            "last_status": "ok",
            "last_run_at": yesterday_iso,
            "next_run_at": tomorrow_iso,
            "created_at": (datetime.utcnow() - timedelta(days=18)).isoformat() + "Z",
        },
        {
            "id": CRON_JOB_IDS[2],
            "name": CRON_JOB_NAMES[2],
            "schedule": "0 3 * * *",
            "schedule_display": "every day at 03:00",
            "enabled": True,
            "prompt": "Run an incremental backup of Hermes config, skills, and memories. Report on what changed.",
            "delivery": "local",
            "model": "claude-sonnet-4-6",
            "provider": "anthropic",
            "run_count": 21,
            "last_status": "ok",
            "last_run_at": yesterday_iso,
            "next_run_at": tomorrow_iso,
            "created_at": (datetime.utcnow() - timedelta(days=30)).isoformat() + "Z",
        },
    ]
}

cron_dir = mkdirs("cron")
write(os.path.join(cron_dir, "jobs.json"), json.dumps(cron_jobs, indent=2))

# A couple of cron output files
for jid, jname in zip(CRON_JOB_IDS[:2], CRON_JOB_NAMES[:2]):
    out_dir = mkdirs("cron", "output", jid)
    for i in range(3):
        run_dt = datetime.utcnow() - timedelta(days=i)
        fname = f"{run_dt.strftime('%Y%m%d_%H%M%S')}.md"
        content = f"""# Cron Job: {jname}

## Prompt

{cron_jobs['jobs'][CRON_JOB_IDS.index(jid)]['prompt']}

## Response

{run_dt.strftime('%Y-%m-%d')} run completed successfully. No issues detected.
All checks passed. Summary delivered to configured delivery target.
"""
        write(os.path.join(out_dir, fname), content)

print("  cron/jobs.json + outputs")


# ---------------------------------------------------------------------------
# memories/
# ---------------------------------------------------------------------------

mem_dir = mkdirs("memories")

write(os.path.join(mem_dir, "MEMORY.md"), """Arch Linux. Python 3.12. Ollama, Go, and gh CLI available.
§
Searxng self-hosted endpoint preferred over external search. Brave as fallback.
§
Prefer incremental builds. Commit after each meaningful change. Never stack uncommitted work.
§
TTS enabled via configured provider. Always use speech tags for voice responses.
§
Project root notes override session defaults. Check for AGENTS.md or .hermes.md in working dir.
""")

write(os.path.join(mem_dir, "USER.md"), """Call user by first name if known. Preferred voice: nova.
§
User cares about AI agents, local tooling, and personal automation workflows.
§
Prefers TUI over GUI. Concise reporting over verbose summaries.
§
Timezone: America/Los_Angeles. Refers to mornings as prime coding time.
""")

write(os.path.join(mem_dir, "SOUL.md"), """You are Hermes — a local AI agent focused on getting things done.
You are direct, pragmatic, and genuinely useful.
You prefer simple systems over clever ones.
You admit uncertainty plainly.
You care about operational reality, not idealized architecture.
""")

print("  memories/")


# ---------------------------------------------------------------------------
# gateway_state.json
# ---------------------------------------------------------------------------

gateway_state = {
    "gateway_state": "running",
    "pid": 123456,
    "start_time": ts(ago(hours=3)),
    "updated_at": ago(minutes=1).isoformat() + "Z",
    "platforms": {
        "telegram": {"state": "connected"},
        "cli": {"state": "connected"},
    },
}
write(os.path.join(DEST, "gateway_state.json"), json.dumps(gateway_state, indent=2))
print("  gateway_state.json")


# ---------------------------------------------------------------------------
# sessions/sessions.json (active sessions metadata)
# ---------------------------------------------------------------------------

sessions_meta = [
    {
        "id": s[0],
        "platform": s[1],
        "display_name": "Demo User" if s[1] == "telegram" else "CLI",
        "last_prompt_tokens": random.randint(500, 5000),
        "started_at": s[4].isoformat() + "Z",
    }
    for s in sessions if s[5] is None  # active only
]
sessions_dir = mkdirs("sessions")
write(os.path.join(sessions_dir, "sessions.json"), json.dumps(sessions_meta, indent=2))
print("  sessions/sessions.json")


# ---------------------------------------------------------------------------
# skills/ (a handful of representative entries)
# ---------------------------------------------------------------------------

SAMPLE_SKILLS = [
    ("research", "arxiv", "Search and retrieve academic papers from arXiv.", "1.0.0", ["arxiv", "research", "papers"]),
    ("research", "searxng-brave-fallback", "Use self-hosted Searxng with Brave as fallback.", "1.0.0", ["search", "web"]),
    ("devops", "github-pr-workflow", "Full pull request lifecycle workflow.", "2.1.0", ["github", "git", "pr"]),
    ("devops", "overwatch-hermes-dashboard", "Build and extend the Overwatch dashboard.", "7.0.0", ["overwatch", "dashboard", "nextjs"]),
    ("mlops/inference", "vllm", "Serve LLMs with high throughput using vLLM.", "1.2.0", ["vllm", "inference", "gpu"]),
    ("media", "grok-tts", "Generate speech audio using xAI Grok TTS API.", "1.0.0", ["tts", "audio", "grok"]),
    ("software-development", "systematic-debugging", "Use when encountering any bug or test failure.", "1.0.0", ["debugging", "bugs"]),
    ("productivity", "notion", "Notion API for creating and managing pages.", "1.0.0", ["notion", "productivity"]),
]

for category, name, description, version, tags in SAMPLE_SKILLS:
    skill_dir = mkdirs("skills", category, name)
    content = f"""---
name: {name}
description: "{description}"
version: {version}
author: Hermes
metadata:
  hermes:
    tags: {json.dumps(tags)}
---

# {name}

{description}

## Usage

Load this skill when working on related tasks.

## Steps

1. Analyze the task requirements
2. Apply the relevant approach
3. Verify the result

## Pitfalls

- Check prerequisites before starting
- Verify output before committing
"""
    write(os.path.join(skill_dir, "SKILL.md"), content)

print(f"  skills/ ({len(SAMPLE_SKILLS)} entries)")


# ---------------------------------------------------------------------------
# logs/
# ---------------------------------------------------------------------------

logs_dir = mkdirs("logs")
write(os.path.join(logs_dir, "gateway.log"), "\n".join([
    f"[{ago(hours=3).strftime('%Y-%m-%d %H:%M:%S')}] INFO  Gateway starting up",
    f"[{ago(hours=3).strftime('%Y-%m-%d %H:%M:%S')}] INFO  Loading platform adapters",
    f"[{ago(hours=3).strftime('%Y-%m-%d %H:%M:%S')}] INFO  Telegram adapter connected",
    f"[{ago(hours=3).strftime('%Y-%m-%d %H:%M:%S')}] INFO  CLI adapter ready",
    f"[{ago(hours=2).strftime('%Y-%m-%d %H:%M:%S')}] INFO  Session started: cli source",
    f"[{ago(hours=1).strftime('%Y-%m-%d %H:%M:%S')}] INFO  Cron job triggered: daily-summary",
    f"[{ago(minutes=30).strftime('%Y-%m-%d %H:%M:%S')}] INFO  Session completed",
    "",
]) + "\n")
write(os.path.join(logs_dir, "errors.log"), "")
print("  logs/")


# ---------------------------------------------------------------------------
# channel_directory.json (empty but valid structure)
# ---------------------------------------------------------------------------

channel_directory = {
    "telegram": [
        {"id": "demo_channel_001", "name": "Personal", "type": "dm"}
    ],
    "discord": []
}
write(os.path.join(DEST, "channel_directory.json"), json.dumps(channel_directory, indent=2))
print("  channel_directory.json")


# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

total_size = sum(
    os.path.getsize(os.path.join(root, f))
    for root, _, files in os.walk(DEST)
    for f in files
)
print(f"\nDemo HERMES_HOME ready at {DEST}  ({total_size // 1024} KB total)")
