import { spawn } from 'node:child_process';
import { z } from 'zod';
import { Tool } from './types.js';

export interface ShellToolOptions {
  enabled: boolean;
  allowedCommands: string[];
  timeoutMs: number;
}

export function createShellTool(options: ShellToolOptions): Tool {
  return {
    name: 'run_shell',
    description: 'Run a safe allow-listed shell command in the workspace. Disabled by default.',
    schema: z.object({
      command: z.string().describe('Command binary, for example ls'),
      args: z.array(z.string()).default([]).describe('Command arguments'),
    }),
    async execute(args, context) {
      if (!options.enabled) {
        return { ok: false, content: 'Shell tool is disabled. Set HERMES_ENABLE_SHELL=true to enable it.' };
      }
      if (!options.allowedCommands.includes(args.command)) {
        return { ok: false, content: `Command is not allowed: ${args.command}` };
      }

      return new Promise((resolve) => {
        const child = spawn(args.command, args.args, {
          cwd: context.workspaceDir,
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
          child.kill('SIGTERM');
          resolve({ ok: false, content: `Command timed out after ${options.timeoutMs}ms` });
        }, options.timeoutMs);

        child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
        child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        child.on('close', (code) => {
          clearTimeout(timer);
          resolve({
            ok: code === 0,
            content: [`exit=${code}`, stdout.trim() && `stdout:\n${stdout.trim()}`, stderr.trim() && `stderr:\n${stderr.trim()}`]
              .filter(Boolean)
              .join('\n\n'),
          });
        });
        child.on('error', (error) => {
          clearTimeout(timer);
          resolve({ ok: false, content: error.message });
        });
      });
    },
  };
}
