/**
 * Chat role types
 */
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Single chat message
 */
export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

/**
 * Tool schema in OpenAI format
 */
export interface ToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * Tool call from model response
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Model chat input
 */
export interface ModelChatInput {
  messages: ChatMessage[];
  tools: ToolSchema[];
  model: string;
  stream?: boolean;  // 新增：是否启用流式输出
}

/**
 * Streaming delta for a single chunk
 */
export interface StreamDelta {
  role?: string;
  content?: string;
  toolCalls?: StreamToolCallDelta[];
}

/**
 * Streaming tool call delta
 */
export interface StreamToolCallDelta {
  index: number;
  id?: string;
  name?: string;
  arguments?: string;  // JSON fragment
}

/**
 * Streaming chunk from provider
 */
export interface StreamChunk {
  delta: StreamDelta;
  finishReason: string | null;
  usage?: TokenUsage;
}

/**
 * Model chat result (non-streaming)
 */
export interface ModelChatResult {
  text?: string;
  toolCalls?: ToolCall[];
  raw?: unknown;
  usage?: TokenUsage;  // 新增：token 使用统计
}

/**
 * Provider error types
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/**
 * 认证错误（不可重试）
 */
export class AuthenticationError extends ProviderError {
  constructor(message: string = 'Authentication failed. Check your API key.') {
    super(message, 'AUTHENTICATION_ERROR', 401, false);
    this.name = 'AuthenticationError';
  }
}

/**
 * 速率限制错误（可重试）
 */
export class RateLimitError extends ProviderError {
  constructor(message: string = 'Rate limit exceeded.') {
    super(message, 'RATE_LIMIT_ERROR', 429, true);
    this.name = 'RateLimitError';
  }
}

/**
 * 请求超时错误（可重试）
 */
export class TimeoutError extends ProviderError {
  constructor(message: string = 'Request timeout.') {
    super(message, 'TIMEOUT_ERROR', undefined, true);
    this.name = 'TimeoutError';
  }
}

/**
 * 网络错误（可重试）
 */
export class NetworkError extends ProviderError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR', undefined, true);
    this.name = 'NetworkError';
  }
}

/**
 * 模型错误（不可重试）
 */
export class ModelError extends ProviderError {
  constructor(message: string) {
    super(message, 'MODEL_ERROR', 400, false);
    this.name = 'ModelError';
  }
}

/**
 * 上下文长度超限（不可重试）
 */
export class ContextLengthExceededError extends ProviderError {
  constructor(message: string = 'Context length exceeded.') {
    super(message, 'CONTEXT_LENGTH_EXCEEDED', 400, false);
    this.name = 'ContextLengthExceededError';
  }
}

/**
 * Model provider interface
 */
export interface ModelProvider {
  name: string;

  /**
   * 非流式聊天
   */
  chat(input: ModelChatInput): Promise<ModelChatResult>;

  /**
   * 流式聊天（可选实现）
   * @returns AsyncGenerator yielding StreamChunk
   */
  chatStream?(input: ModelChatInput): AsyncGenerator<StreamChunk, ModelChatResult, unknown>;

  /**
   * 健康检查
   */
  healthCheck?(): Promise<boolean>;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: ['TIMEOUT_ERROR', 'NETWORK_ERROR', 'RATE_LIMIT_ERROR'],
};
