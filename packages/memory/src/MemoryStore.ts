import fs from 'node:fs/promises';
import path from 'node:path';

export class MemoryStore {
  constructor(private dataDir: string) {}

  private memoryPath(name: 'USER.md' | 'MEMORY.md'): string {
    return path.join(this.dataDir, 'memories', name);
  }

  async ensure(): Promise<void> {
    await fs.mkdir(path.join(this.dataDir, 'memories'), { recursive: true });
    await ensureFile(this.memoryPath('USER.md'), '# USER.md\n\n记录用户偏好、沟通风格、常用工具和长期信息。\n');
    await ensureFile(this.memoryPath('MEMORY.md'), '# MEMORY.md\n\n记录项目背景、Agent 经验和长期工作上下文。\n');
  }

  async readUserMemory(): Promise<string> {
    await this.ensure();
    return fs.readFile(this.memoryPath('USER.md'), 'utf-8');
  }

  async readAgentMemory(): Promise<string> {
    await this.ensure();
    return fs.readFile(this.memoryPath('MEMORY.md'), 'utf-8');
  }
}

async function ensureFile(file: string, content: string): Promise<void> {
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, content, 'utf-8');
  }
}
