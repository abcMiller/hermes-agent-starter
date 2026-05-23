import fs from 'node:fs/promises';
import { HermesConfig } from '@hermes-clone/config';
import { MemoryStore, JsonSessionStore } from '@hermes-clone/memory';
import { ProviderResolver, ModelProvider } from '@hermes-clone/providers';
import { SkillLoader } from '@hermes-clone/skills';
import { createShellTool, listFilesTool, readFileTool, ToolRegistry, writeFileTool } from '@hermes-clone/tools';
import { AgentRuntime } from './AgentRuntime.js';
import { AgentRuntimeOptions } from './types.js';

/**
 * 创建 AgentRuntime 的额外选项
 */
export interface CreateRuntimeOptions {
  /** 自定义日志记录器 */
  logger?: AgentRuntimeOptions['logger'];
  /** 最大工具调用次数 */
  maxToolCalls?: number;
  /** 自定义 Provider（用于测试） */
  provider?: ModelProvider;
}

/**
 * 创建并初始化 AgentRuntime
 *
 * @param config - Hermes 配置
 * @param options - 额外的运行时选项
 * @returns 初始化完成的 AgentRuntime 实例
 */
export async function createRuntime(
  config: HermesConfig,
  options: CreateRuntimeOptions = {}
): Promise<AgentRuntime> {
  // 确保必要的目录存在
  await fs.mkdir(config.workspaceDir, { recursive: true });
  await fs.mkdir(config.dataDir, { recursive: true });

  // 使用 ProviderResolver 或自定义 Provider
  const provider: ModelProvider = options.provider ?? ProviderResolver.resolve(config);

  // 注册工具
  const tools = new ToolRegistry()
    .register(listFilesTool)
    .register(readFileTool)
    .register(writeFileTool)
    .register(createShellTool({
      enabled: config.tools.enableShell,
      timeoutMs: config.tools.shellTimeoutMs,
      allowedCommands: config.tools.allowedShellCommands,
    }));

  // 初始化 Memory
  const memory = new MemoryStore(config.dataDir);
  await memory.ensure();

  // 创建 AgentRuntime
  return new AgentRuntime({
    config,
    provider,
    tools,
    memory,
    sessions: new JsonSessionStore(config.dataDir),
    skills: new SkillLoader(config.dataDir),
    logger: options.logger,
    maxToolCalls: options.maxToolCalls,
  });
}
