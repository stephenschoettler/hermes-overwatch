export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { profilePath } from '@/lib/hermes';
import { cookies } from 'next/headers';

interface SkillInfo {
  name: string;
  category: string;
  description: string;
  version: string;
  tags: string[];
  relatedSkills: string[];
  path: string;
  hasLinkedFiles: boolean;
}

function walkSkills(baseDir: string, category = ''): SkillInfo[] {
  const skills: SkillInfo[] = [];
  if (!fs.existsSync(baseDir)) return skills;

  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const entryPath = path.join(baseDir, entry.name);
    const skillFile = path.join(entryPath, 'SKILL.md');

    if (fs.existsSync(skillFile)) {
      // This is a skill directory
      try {
        const content = fs.readFileSync(skillFile, 'utf-8');
        const { data } = matter(content);
        const hermesMeta = data.metadata?.hermes || {};

        skills.push({
          name: data.name || entry.name,
          category: category || 'uncategorized',
          description: data.description || '',
          version: data.version || '',
          tags: hermesMeta.tags || [],
          relatedSkills: hermesMeta.related_skills || [],
          path: category ? `${category}/${entry.name}` : entry.name,
          hasLinkedFiles: hasSubFiles(entryPath),
        });
      } catch {}
    } else {
      // Might be a category directory — recurse
      const subCategory = category ? `${category}/${entry.name}` : entry.name;
      skills.push(...walkSkills(entryPath, subCategory));
    }
  }

  return skills;
}

function hasSubFiles(dir: string): boolean {
  for (const sub of ['references', 'templates', 'scripts', 'assets']) {
    if (fs.existsSync(path.join(dir, sub))) return true;
  }
  return false;
}

export async function GET(req: Request) {
  try {
  const { searchParams } = new URL(req.url);
  const profileParam = searchParams.get('profile');
  const cookieStore = await cookies();
  const profileName = (profileParam && profileParam !== 'system') ? profileParam : cookieStore.get('overwatch-profile')?.value;
    const url = new URL(req.url);
    const skillPath = url.searchParams.get('path');

    // If a specific skill is requested, return its full content
    if (skillPath) {
      const fullPath = path.join(profilePath(profileName, 'skills'), skillPath, 'SKILL.md');
      if (!fs.existsSync(fullPath)) {
        return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
      }
      const content = fs.readFileSync(fullPath, 'utf-8');
      const { data, content: body } = matter(content);
      return NextResponse.json({ frontmatter: data, content: body });
    }

    // Otherwise return the full skill index
    const skills = walkSkills(profilePath(profileName, 'skills'));

    // Group by category
    const categories: Record<string, SkillInfo[]> = {};
    for (const s of skills) {
      const cat = s.category;
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(s);
    }

    // Sort categories and skills within
    const sortedCategories = Object.keys(categories).sort();
    for (const cat of sortedCategories) {
      categories[cat].sort((a, b) => a.name.localeCompare(b.name));
    }

    return NextResponse.json({
      skills,
      categories,
      totalCount: skills.length,
      categoryCount: sortedCategories.length,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
