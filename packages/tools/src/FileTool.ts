import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { Tool } from './types.js';
import { resolveInsideWorkspace } from './pathSafety.js';

export const listFilesTool: Tool = {
  name: 'list_files',
  description: 'List files and directories inside the workspace. Use this before reading unknown files.',
  schema: z.object({
    path: z.string().default('.').describe('Relative path inside workspace'),
  }),
  async execute(args, context) {
    const target = resolveInsideWorkspace(context.workspaceDir, args.path);
    const entries = await fs.readdir(target, { withFileTypes: true });
    const lines = entries
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) => `${entry.isDirectory() ? 'dir ' : 'file'} ${entry.name}`);
    return { ok: true, content: lines.join('\n') || '(empty)' };
  },
};

export const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read a UTF-8 text file inside the workspace.',
  schema: z.object({
    path: z.string().describe('Relative file path inside workspace'),
  }),
  async execute(args, context) {
    const target = resolveInsideWorkspace(context.workspaceDir, args.path);
    const stat = await fs.stat(target);
    if (stat.size > 256_000) {
      return { ok: false, content: `File too large: ${args.path}` };
    }
    const content = await fs.readFile(target, 'utf-8');
    return { ok: true, content };
  },
};

export const writeFileTool: Tool = {
  name: 'write_file',
  description: 'Write a UTF-8 text file inside the workspace. Creates parent directories automatically.',
  schema: z.object({
    path: z.string().describe('Relative file path inside workspace'),
    content: z.string().describe('UTF-8 file content'),
  }),
  async execute(args, context) {
    const target = resolveInsideWorkspace(context.workspaceDir, args.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, args.content, 'utf-8');
    return { ok: true, content: `Wrote ${args.content.length} characters to ${args.path}` };
  },
};
