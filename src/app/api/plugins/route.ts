export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { profilePath, readProfileYaml } from '@/lib/hermes';
import { cookies } from 'next/headers';

interface PluginManifest {
  name: string;
  version: string;
  description: string;
  pip_dependencies?: string[];
  external_dependencies?: { name: string; install?: string; check?: string }[];
  requires_env?: string[];
  hooks?: string[];
}

interface PluginInfo {
  name: string;
  version: string;
  description: string;
  location: 'user' | 'builtin' | 'pip';
  category: string;
  path: string;
  enabled: boolean;
  dependencies: string[];
  requiredEnv: string[];
  missingEnv: string[];
  hooks: string[];
  hasInit: boolean;
}

interface HermesConfig {
  plugins?: {
    disabled?: string[];
  };
}

function scanPluginDir(baseDir: string, location: 'user' | 'builtin', category = ''): PluginInfo[] {
  const plugins: PluginInfo[] = [];
  if (!fs.existsSync(baseDir)) return plugins;

  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name === '__pycache__') continue;
    const entryPath = path.join(baseDir, entry.name);
    const manifestPath = path.join(entryPath, 'plugin.yaml');

    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = yaml.load(fs.readFileSync(manifestPath, 'utf-8')) as PluginManifest;
        const requiredEnv = manifest.requires_env || [];
        const missingEnv = requiredEnv.filter(e => !process.env[e]);

        const deps: string[] = [];
        if (manifest.pip_dependencies) deps.push(...manifest.pip_dependencies.map(d => `pip: ${d}`));
        if (manifest.external_dependencies) deps.push(...manifest.external_dependencies.map(d => `ext: ${d.name}`));

        plugins.push({
          name: manifest.name || entry.name,
          version: manifest.version || '?',
          description: manifest.description || '',
          location,
          category: category || 'general',
          path: entryPath,
          enabled: true, // will be overridden below
          dependencies: deps,
          requiredEnv,
          missingEnv,
          hooks: manifest.hooks || [],
          hasInit: fs.existsSync(path.join(entryPath, '__init__.py')),
        });
      } catch {}
    } else {
      // Might be a category directory — recurse
      plugins.push(...scanPluginDir(entryPath, location, entry.name));
    }
  }
  return plugins;
}

export async function GET(req: Request) {
  try {
  const { searchParams } = new URL(req.url);
  const profileParam = searchParams.get('profile');
  const cookieStore = await cookies();
  const profileName = (profileParam && profileParam !== 'system') ? profileParam : cookieStore.get('overwatch-profile')?.value;
    const config = readProfileYaml<HermesConfig>(profileName, 'config.yaml');
    const disabled = new Set(config?.plugins?.disabled || []);

    // Scan user plugins
    const userPlugins = scanPluginDir(profilePath(profileName, 'plugins'), 'user');

    // Scan built-in plugins
    const builtinPlugins = scanPluginDir(profilePath(profileName, 'hermes-agent/plugins'), 'builtin');

    const allPlugins = [...userPlugins, ...builtinPlugins].map(p => ({
      ...p,
      enabled: !disabled.has(p.name),
    }));

    // Group by category
    const categories: Record<string, PluginInfo[]> = {};
    for (const p of allPlugins) {
      if (!categories[p.category]) categories[p.category] = [];
      categories[p.category].push(p);
    }

    // Available hooks
    const allHooks = Array.from(new Set(allPlugins.flatMap(p => p.hooks))).sort();

    return NextResponse.json({
      plugins: allPlugins,
      categories,
      totalCount: allPlugins.length,
      enabledCount: allPlugins.filter(p => p.enabled).length,
      userCount: userPlugins.length,
      builtinCount: builtinPlugins.length,
      hooks: allHooks,
      disabledNames: Array.from(disabled),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
