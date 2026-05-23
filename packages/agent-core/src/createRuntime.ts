import fs from 'node:fs/promises';
import { HermesConfig } from '@hermes-clone/config';
import { MemoryStore, JsonSessionStore } from '@hermes-clone/memory';
import { MockProvider, OpenAICompatibleProvider, ModelProvider } from '@hermes-clone/providers';
import { SkillLoader } from '@hermes-clone/skills';
import { createShellTool, listFilesTool, readFileTool, ToolRegistry, writeFileTool } from '@hermes-clone/tools';
import { AgentRuntime } from './AgentRuntime.js';

export async function createRuntime(config: HermesConfig): Promise<AgentRuntime> {
  await fs.mkdir(config.workspaceDir, { recursive: true });
  await fs.mkdir(config.dataDir, { recursive: true });

  const provider: ModelProvider = config.provider === 'mock'
    ? new MockProvider()
    : new OpenAICompatibleProvider({ apiKey: config.apiKey, baseUrl: config.baseUrl });

  const tools = new ToolRegistry()
    .register(listFilesTool)
    .register(readFileTool)
    .register(writeFileTool)
    .register(createShellTool({
      enabled: config.tools.enableShell,
      timeoutMs: config.tools.shellTimeoutMs,
      allowedCommands: config.tools.allowedShellCommands,
    }));

  const memory = new MemoryStore(config.dataDir);
  await memory.ensure();

  return new AgentRuntime({
    config,
    provider,
    tools,
    memory,
    sessions: new JsonSessionStore(config.dataDir),
    skills: new SkillLoader(config.dataDir),
  });
}
