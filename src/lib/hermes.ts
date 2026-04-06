import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';

/**
 * Resolve the Hermes home directory.
 * Priority: HERMES_HOME env > ~/.hermes
 */
export function getHermesHome(): string {
  if (process.env.HERMES_HOME) return process.env.HERMES_HOME;
  return path.join(process.env.HOME || '/home/' + (process.env.USER || 'user'), '.hermes');
}

export function hermesPath(...segments: string[]): string {
  return path.join(getHermesHome(), ...segments);
}

export function readHermesFile(relativePath: string): string | null {
  try {
    return fs.readFileSync(hermesPath(relativePath), 'utf-8');
  } catch {
    return null;
  }
}

export function readHermesJson<T = unknown>(relativePath: string): T | null {
  const content = readHermesFile(relativePath);
  if (!content) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export function readHermesYaml<T = unknown>(relativePath: string): T | null {
  const content = readHermesFile(relativePath);
  if (!content) return null;
  try {
    return yaml.load(content) as T;
  } catch {
    return null;
  }
}

// ── Profile resolution ────────────────────────────────────────────────

// Always $HOME/.hermes/profiles/
export function getProfilesRoot(): string {
  const home = process.env.HOME || '/home/' + (process.env.USER || 'user');
  return path.join(home, '.hermes', 'profiles');
}

const PROFILE_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

// Resolve profile name to absolute path. Validates name.
export function resolveProfileHome(name: string): string {
  if (!name || name === 'default') return getHermesHome();
  if (!PROFILE_NAME_RE.test(name)) return getHermesHome();
  const profileDir = path.join(getProfilesRoot(), name);
  if (!fs.existsSync(profileDir)) return getHermesHome();
  return profileDir;
}

// Get active profile home from a profile name (typically read from cookie by caller)
export function getActiveProfileHome(profileName?: string): string {
  if (!profileName) return getHermesHome();
  return resolveProfileHome(profileName);
}

// Drop-in replacement for hermesPath() scoped to active profile
export function profilePath(profileName: string | undefined, ...segments: string[]): string {
  return path.join(getActiveProfileHome(profileName), ...segments);
}

// Profile-aware file readers (parallel to readHermesFile/Json/Yaml)
export function readProfileFile(profileName: string | undefined, relativePath: string): string | null {
  try {
    return fs.readFileSync(profilePath(profileName, relativePath), 'utf-8');
  } catch {
    return null;
  }
}

export function readProfileJson<T = unknown>(profileName: string | undefined, relativePath: string): T | null {
  const content = readProfileFile(profileName, relativePath);
  if (!content) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export function readProfileYaml<T = unknown>(profileName: string | undefined, relativePath: string): T | null {
  const content = readProfileFile(profileName, relativePath);
  if (!content) return null;
  try {
    return yaml.load(content) as T;
  } catch {
    return null;
  }
}

// Helper to get gateway service name for a profile
export function getGatewayServiceName(profileHome: string, profileName?: string): string {
  try {
    const pidFile = path.join(profileHome, 'gateway.pid');
    const raw = fs.readFileSync(pidFile, 'utf-8').trim();
    if (raw.startsWith('{')) {
      const data = JSON.parse(raw);
      if (data.service_name) return data.service_name;
    }
  } catch {}
  if (!profileName || profileName === 'default') return 'hermes-gateway';
  return `hermes-gateway-${profileName}`;
}

// List all available profiles
export function listProfiles(): { name: string; path: string; isDefault: boolean }[] {
  const profiles: { name: string; path: string; isDefault: boolean }[] = [];
  const defaultPath = getHermesHome();
  if (fs.existsSync(path.join(defaultPath, 'state.db'))) {
    profiles.push({ name: 'default', path: defaultPath, isDefault: true });
  }
  const root = getProfilesRoot();
  if (fs.existsSync(root)) {
    try {
      const entries = fs.readdirSync(root, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && PROFILE_NAME_RE.test(entry.name)) {
          profiles.push({
            name: entry.name,
            path: path.join(root, entry.name),
            isDefault: false,
          });
        }
      }
    } catch {}
  }
  return profiles;
}

// ── Secret redaction ──────────────────────────────────────────────────

const SECRET_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /token/i,
  /password/i,
  /auth/i,
  /credential/i,
  /bearer/i,
  /authorization/i,
];

const SAFE_KEYS = new Set([
  'timeout', 'model', 'voice', 'provider', 'base_url', 'url',
  'command', 'args', 'enabled', 'backend', 'device', 'mode',
  'ref_audio', 'ref_text', 'voice_id', 'model_id',
]);

/**
 * Recursively redact values that look like secrets.
 * Keys matching SECRET_PATTERNS get their values replaced with '••••••••'
 * unless the key is in the SAFE_KEYS allowlist.
 */
export function redactSecrets(obj: unknown, parentKey = ''): unknown {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item, i) => redactSecrets(item, parentKey));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();

      if (SAFE_KEYS.has(lowerKey)) {
        result[key] = redactSecrets(value, key);
        continue;
      }

      const isSecret = SECRET_PATTERNS.some(p => p.test(lowerKey));
      if (isSecret && typeof value === 'string' && value.length > 0) {
        result[key] = '••••••••';
      } else {
        result[key] = redactSecrets(value, key);
      }
    }
    return result;
  }

  // Redact string values that look like tokens/keys (long alphanumeric strings)
  // but only when the parent key suggests it's sensitive
  if (typeof obj === 'string' && parentKey) {
    const parentIsSecret = SECRET_PATTERNS.some(p => p.test(parentKey.toLowerCase()));
    if (parentIsSecret && obj.length > 0) {
      return '••••••••';
    }
  }

  return obj;
}
