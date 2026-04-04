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
