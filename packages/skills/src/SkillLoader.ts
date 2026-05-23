import fs from 'node:fs/promises';
import path from 'node:path';

export interface LoadedSkill {
  id: string;
  path: string;
  content: string;
}

export class SkillLoader {
  constructor(private dataDir: string) {}

  private skillsDir(): string {
    return path.join(this.dataDir, 'skills');
  }

  async loadRelevantSkills(input: string, maxSkills = 3): Promise<LoadedSkill[]> {
    await fs.mkdir(this.skillsDir(), { recursive: true });
    const dirs = await fs.readdir(this.skillsDir(), { withFileTypes: true });
    const skills: LoadedSkill[] = [];

    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      const file = path.join(this.skillsDir(), dir.name, 'SKILL.md');
      try {
        const content = await fs.readFile(file, 'utf-8');
        if (matches(input, dir.name, content)) {
          skills.push({ id: dir.name, path: file, content });
        }
      } catch {
        // ignore invalid skill folders
      }
    }

    return skills.slice(0, maxSkills);
  }
}

function matches(input: string, id: string, content: string): boolean {
  const lower = input.toLowerCase();
  const haystack = `${id}\n${content}`.toLowerCase();
  const hints = [
    id,
    'frontend', '前端', '页面', 'ui', 'design',
    'review', '审查', '代码',
    'playwright', '浏览器', '自动化',
    'document', '文档', 'readme',
  ];
  return hints.some((hint) => lower.includes(hint.toLowerCase()) && haystack.includes(hint.toLowerCase()));
}
