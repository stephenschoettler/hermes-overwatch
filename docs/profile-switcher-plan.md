# Profile Switcher — Implementation Plan

Multi-profile support for Overwatch. Each Hermes profile is a fully independent
HERMES_HOME. Overwatch needs to enumerate them, let the user switch between them,
and scope all API reads to the active profile.

---

## How Hermes Profiles Work (source: hermes_cli/profiles.py)

- **Default profile**: `~/.hermes/` — always exists, no migration needed
- **Named profiles**: `~/.hermes/profiles/<name>/` — each is a full HERMES_HOME
- **Profiles root**: always `~/.hermes/profiles/` anchored to `$HOME`, never to
  the current `HERMES_HOME` (so `coder profile list` works from any profile)
- **Active profile file**: `~/.hermes/active_profile` — sticky default set with
  `hermes profile use <name>`; plain text file containing the profile name
- **Contents**: each profile has its own `state.db`, `config.yaml`, `.env`,
  `memories/`, `skills/`, `cron/`, `logs/`, `gateway.pid`, `gateway_state.json`
- **Wrapper scripts**: `~/.local/bin/<name>` → `exec hermes -p <name> "$@"`

---

## Architecture Decision: Cookie-Scoped Profile

Profile selection stored in an `overwatch-profile` cookie (HttpOnly, SameSite=Lax).
Value is the **profile name** (`default`, `coder`, `work`) — NOT the raw path.
The server resolves name → path, which lets us validate it cleanly.

Alternatives considered:
- **Query param** — leaks into every URL, annoying
- **Separate port per profile** — requires port management, no cross-profile UX
- **Server-side session** — overkill for a local personal tool

---

## Changes Required

### 1. `src/lib/hermes.ts` — profile resolution

Add two new exports alongside existing `getHermesHome()` / `hermesPath()`:

```ts
// Always reads from $HOME/.hermes/profiles/ — not from HERMES_HOME
export function getProfilesRoot(): string

// Resolve profile name → absolute path. Validates against known profiles.
// name='default' → ~/.hermes
// name='coder'   → ~/.hermes/profiles/coder
// Unknown name   → falls back to getHermesHome() (safe default)
export function resolveProfileHome(name: string): string

// Use inside API route handlers. Reads 'overwatch-profile' cookie via
// next/headers cookies(). Falls back to getHermesHome() if no cookie or
// cookie value doesn't resolve to a real directory.
export function getActiveProfileHome(): string

// Drop-in replacement for hermesPath() — uses getActiveProfileHome()
export function profilePath(...segments: string[]): string
```

`getActiveProfileHome()` calls `cookies()` from `next/headers`. This only works
inside Next.js route handlers (which is the only place we call it), so no changes
to the static utility use cases.

**Security**: `resolveProfileHome()` validates the name matches
`^[a-z0-9][a-z0-9_-]{0,63}$` or is `"default"`. Rejects arbitrary paths.
Checks that the resolved directory actually exists before accepting it.

### 2. All API routes — swap `hermesPath` → `profilePath`

17 route files use `hermesPath()`. Mechanical find-and-replace:
- `import { hermesPath, ... }` → add `profilePath` to the import
- `hermesPath(...)` → `profilePath(...)`

No logic changes — `profilePath` has the same signature, just reads the active
profile instead of the env var.

Routes that are **exempt** (don't read from HERMES_HOME):
- `api/auth/login`, `api/auth/logout` — auth only
- `api/health` — health check

Routes that need **extra care**:
- `api/system/restart` — currently hardcodes `hermes-gateway` service name.
  Named profiles have a different systemd unit: `hermes-gateway-<name>`.
  Fix: read service name from active profile's `gateway.pid` JSON (contains
  `service_name` field per Hermes source), fall back to `hermes-gateway` for
  default. See §4 below.
- `api/system/logs` — `journalctl --user -u hermes-gateway` needs the profile's
  unit name too. Same fix.
- `api/system/deploy` — Overwatch deploy is always self (not profile-scoped).
  No change needed.

### 3. `src/app/api/profiles/route.ts` — new route

```
GET /api/profiles
```

Returns the full profile list. Reads from `~/.hermes/profiles/` (always `$HOME`-
anchored, ignores HERMES_HOME) plus the default profile.

Response shape:
```ts
{
  profiles: [
    {
      name: string          // 'default' | 'coder' | ...
      path: string          // absolute path (for display only)
      isDefault: boolean
      isActive: boolean     // matches current overwatch-profile cookie
      gatewayRunning: boolean
      model: string | null
      provider: string | null
      skillCount: number
      sessionCount: number  // quick SELECT COUNT(*) from state.db if exists
      lastActive: string | null  // MAX(started_at) from state.db
    }
  ],
  activeProfile: string     // name of active profile
}
```

`gatewayRunning`: read `gateway.pid` — parse JSON if it starts with `{`, else
parse as plain int. Call `kill(pid, 0)` equivalent: check `/proc/<pid>/stat`.

`sessionCount` + `lastActive`: open state.db read-only, run
`SELECT COUNT(*), MAX(started_at) FROM sessions`. Gracefully skip if db missing.

### 4. `src/app/api/profiles/switch/route.ts` — new route

```
POST /api/profiles/switch  { name: string }
```

Validates the name, resolves it, sets the `overwatch-profile` cookie.
Returns `{ ok: true, profile: ProfileInfo }`.

```ts
cookies().set('overwatch-profile', name, {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 365, // 1 year
})
```

### 5. System routes — profile-aware service names

`api/system/restart` and `api/system/logs` need the correct systemd unit name.

Add helper `getGatewayServiceName(profileHome: string): string`:
- Read `<profileHome>/gateway.pid` — if it's JSON and has a `service_name`
  field, use that
- Otherwise: `profileName === 'default'` → `hermes-gateway`,
  named → `hermes-gateway-<name>`
- Fall back to `hermes-gateway` if anything fails

### 6. `src/app/layout.tsx` — Profile Switcher in sidebar

Add a `ProfileSwitcher` client component above the nav list.

**Collapsed state** (default): shows active profile name with a small
`ChevronDown` icon. Style: `text-neutral-400`, subtle — doesn't compete with
the nav.

**Expanded state**: dropdown card listing all profiles. Each row shows:
- Profile name (bold if active, `text-white` / `text-neutral-400`)
- Model + provider (`text-neutral-500`, small)
- Gateway status dot (green/gray, no pulse)
- Session count
- Click → POST `/api/profiles/switch`, reload page

**Data**: fetched once on mount with `useEffect`. Polls every 60s (gateway
status can change).

**Placement**: between the `Eye` logo/title block and the nav `<ul>`.
Separator lines above and below to keep it visually distinct from nav items.

**Active profile indicator**: small colored left border or `■` marker on the
current profile row. Consistent with the active nav item style.

---

## Out of Scope (v1)

- **Cross-profile analytics** — aggregate view across all profiles. Interesting
  but adds real complexity to every query.
- **Profile creation/deletion from UI** — use the `hermes profile` CLI. Overwatch
  is an observer, not a manager.
- **Profile-scoped auth passwords** — one `OVERWATCH_PASSWORD` gates the whole
  Overwatch instance. Fine for personal use.
- **Gateway restart for named profiles** — only implemented if `gateway.pid`
  has a parseable `service_name`. Otherwise the restart button is hidden for
  non-default profiles to avoid accidentally targeting the wrong unit.

---

## Implementation Order

1. `src/lib/hermes.ts` — add `getProfilesRoot`, `resolveProfileHome`,
   `getActiveProfileHome`, `profilePath`
2. `src/app/api/profiles/route.ts` — GET list
3. `src/app/api/profiles/switch/route.ts` — POST switch
4. Swap `hermesPath` → `profilePath` in all 17 route files
5. Fix service name in `system/restart` and `system/logs`
6. `ProfileSwitcher` component in `layout.tsx`
7. Build + smoke test with a real named profile
8. Update `seed-demo.py` to optionally seed a second profile for screenshot
   testing

---

## File Changelist

| File | Change |
|------|--------|
| `src/lib/hermes.ts` | Add 4 new exports |
| `src/app/api/profiles/route.ts` | New |
| `src/app/api/profiles/switch/route.ts` | New |
| `src/app/api/system/restart/route.ts` | Profile-aware service name |
| `src/app/api/system/logs/route.ts` | Profile-aware unit name |
| `src/app/api/system/status/route.ts` | `profilePath` swap |
| `src/app/api/stats/route.ts` | `profilePath` swap |
| `src/app/api/sessions/route.ts` | `profilePath` swap |
| `src/app/api/sessions/[id]/route.ts` | `profilePath` swap |
| `src/app/api/activity/route.ts` | `profilePath` swap |
| `src/app/api/analytics/route.ts` | `profilePath` swap |
| `src/app/api/models/route.ts` | `profilePath` swap |
| `src/app/api/tools/route.ts` | `profilePath` swap |
| `src/app/api/tasks/route.ts` | `profilePath` swap |
| `src/app/api/crons/route.ts` | `profilePath` swap |
| `src/app/api/skills/route.ts` | `profilePath` swap |
| `src/app/api/memory/route.ts` | `profilePath` swap |
| `src/app/api/config/route.ts` | `profilePath` swap |
| `src/app/api/plugins/route.ts` | `profilePath` swap |
| `src/app/api/context/route.ts` | `profilePath` swap |
| `src/app/api/delegation/route.ts` | `profilePath` swap |
| `src/app/api/automation/code-execution/route.ts` | `profilePath` swap |
| `src/app/api/automation/channels/route.ts` | `profilePath` swap |
| `src/app/layout.tsx` | Add `ProfileSwitcher` component |
| `scripts/seed-demo.py` | Optional second profile in `/tmp/hermes-demo/profiles/` |

25 files total. The 17 `profilePath` swaps are mechanical.
The 6 substantive changes are `hermes.ts`, the two new routes, two system
route fixes, and `layout.tsx`.
