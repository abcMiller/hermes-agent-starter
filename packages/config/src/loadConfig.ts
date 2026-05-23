import 'dotenv/config';
import path from 'node:path';
import { HermesConfig } from './types.js';

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(cwd = process.cwd()): HermesConfig {
  const dataDir = path.resolve(cwd, process.env.HERMES_DATA_DIR ?? './data');
  const workspaceDir = path.resolve(cwd, process.env.HERMES_WORKSPACE_DIR ?? './workspace');

  return {
    provider: (process.env.HERMES_PROVIDER as HermesConfig['provider']) ?? 'mock',
    model: process.env.HERMES_MODEL ?? 'gpt-4o-mini',
    baseUrl: process.env.HERMES_BASE_URL ?? 'https://api.openai.com/v1',
    apiKey: process.env.HERMES_API_KEY,
    dataDir,
    workspaceDir,
    maxIterations: envInt('HERMES_MAX_ITERATIONS', 8),
    tools: {
      enableShell: envBool('HERMES_ENABLE_SHELL', false),
      shellTimeoutMs: envInt('HERMES_SHELL_TIMEOUT_MS', 15_000),
      allowedShellCommands: (process.env.HERMES_ALLOWED_SHELL_COMMANDS ?? 'pwd,ls,cat,echo,node,npm,pnpm,git')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    },
  };
}
