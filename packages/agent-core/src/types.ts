import { ModelProvider, TokenUsage } from '@hermes-clone/providers';
import { ToolRegistry } from '@hermes-clone/tools';
import { MemoryStore, JsonSessionStore } from '@hermes-clone/memory';
import { SkillLoader } from '@hermes-clone/skills';
import { HermesConfig } from '@hermes-clone/config';

/**
 * AgentRuntime 运行时依赖配置
 */
export interface AgentRuntimeOptions {
  config: HermesConfig;
  provider: ModelProvider;
  tools: ToolRegistry;
  memory: MemoryStore;
  sessions: JsonSessionStore;
  skills: SkillLoader;
  /** 日志回调 */
  logger?: Logger;
  /** 最大工具调用次数（防止工具调用循环） */
  maxToolCalls?: number;
}

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 日志接口
 */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
}

/**
 * 默认控制台日志实现
 */
export class ConsoleLogger implements Logger {
  debug(message: string, meta?: Record<string, unknown>): void {
    console.debug(`[DEBUG] ${message}`, meta ?? '');
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.info(`[INFO] ${message}`, meta ?? '');
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`[WARN] ${message}`, meta ?? '');
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    console.error(`[ERROR] ${message}`, error ?? '', meta ?? '');
  }
}

/**
 * Agent 单次运行输入
 */
export interface AgentRunInput {
  sessionId: string;
  text: string;
  /** 是否启用流式输出 */
  stream?: boolean;
}

/**
 * Agent 单次运行结果
 */
export interface AgentRunResult {
  text: string;
  iterations: number;
  /** 总 Token 使用量 */
  usage?: TokenUsage;
  /** 各迭代 Token 使用量明细 */
  usageByIteration?: TokenUsage[];
}

/**
 * 流式输出回调
 */
export interface StreamCallbacks {
  /** 收到文本片段时调用 */
  onText?: (text: string) => void;
  /** 收到工具调用时调用 */
  onToolCall?: (toolCall: { name: string; arguments: Record<string, unknown> }) => void;
  /** 工具执行完成时调用 */
  onToolResult?: (result: { name: string; ok: boolean; content: string }) => void;
}
