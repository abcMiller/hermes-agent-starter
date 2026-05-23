import {
  ModelChatInput,
  ModelChatResult,
  ModelProvider,
  ToolCall,
  StreamChunk,
  StreamToolCallDelta,
  TokenUsage,
  ProviderError,
  AuthenticationError,
  RateLimitError,
  TimeoutError,
  NetworkError,
  ModelError,
  ContextLengthExceededError,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
} from './types.js';

/**
 * OpenAI Compatible Provider options
 */
export interface OpenAICompatibleProviderOptions {
  apiKey?: string;
  baseUrl: string;
  name?: string;
  timeout?: number;           // 请求超时时间（毫秒）
  retryConfig?: RetryConfig;  // 重试配置
}

/**
 * OpenAI Compatible Provider
 *
 * 支持：
 * - 标准 OpenAI Chat Completions API
 * - 流式输出（SSE）
 * - Token 使用统计
 * - 错误分类和重试
 * - 请求超时控制
 */
export class OpenAICompatibleProvider implements ModelProvider {
  name: string;
  private apiKey?: string;
  private baseUrl: string;
  private timeout: number;
  private retryConfig: RetryConfig;

  // 用于累积流式输出的 tool_calls
  private streamToolCallsBuffer = new Map<number, StreamToolCallDelta>();

  constructor(options: OpenAICompatibleProviderOptions) {
    this.name = options.name ?? 'openai-compatible';
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.timeout = options.timeout ?? 60000; // 默认 60 秒
    this.retryConfig = options.retryConfig ?? DEFAULT_RETRY_CONFIG;
  }

  /**
   * 非流式聊天（带重试）
   */
  async chat(input: ModelChatInput): Promise<ModelChatResult> {
    return this.withRetry(async () => {
      if (!this.apiKey) {
        throw new AuthenticationError('Missing HERMES_API_KEY for openai-compatible provider.');
      }

      const messages = this.transformMessages(input.messages);
      const body = JSON.stringify({
        model: input.model,
        messages,
        tools: input.tools,
        tool_choice: input.tools.length > 0 ? 'auto' : undefined,
        stream: false,
      });

      const response = await this.fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body,
      });

      await this.handleResponseError(response);

      const payload = await response.json();
      return this.parseChatResponse(payload);
    });
  }

  /**
   * 流式聊天（带重试）
   *
   * 返回 AsyncGenerator，每次产生一个 StreamChunk
   * 最终返回完整的 ModelChatResult
   */
  async *chatStream(input: ModelChatInput): AsyncGenerator<StreamChunk, ModelChatResult, unknown> {
    // 清空之前的 buffer
    this.streamToolCallsBuffer.clear();

    if (!this.apiKey) {
      throw new AuthenticationError('Missing HERMES_API_KEY for openai-compatible provider.');
    }

    const messages = this.transformMessages(input.messages);
    const body = JSON.stringify({
      model: input.model,
      messages,
      tools: input.tools,
      tool_choice: input.tools.length > 0 ? 'auto' : undefined,
      stream: true,
    });

    const response = await this.fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body,
    });

    await this.handleResponseError(response);

    // 流式读取响应
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // 累积结果
    let fullText = '';
    let finishReason: string | null = null;
    let usage: TokenUsage | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              const chunk = this.parseStreamChunk(data);

              // 累积文本
              if (chunk.delta.content) {
                fullText += chunk.delta.content;
              }

              // 保存 finish reason
              if (chunk.finishReason) {
                finishReason = chunk.finishReason;
              }

              // 保存 usage
              if (chunk.usage) {
                usage = chunk.usage;
              }

              // yield chunk 给调用者
              yield chunk;
            } catch (e) {
              // 忽略解析错误（可能是空行或其他）
            }
          }
        }
      }

      // 返回最终结果
      const toolCalls = this.finalizeStreamToolCalls();

      return {
        text: fullText || undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage,
      };
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) return false;

      const response = await this.fetchWithTimeout(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
        },
      }, 5000); // 5 秒超时

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 带超时的 fetch
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit & { body?: string },
    timeout?: number
  ): Promise<Response> {
    const ms = timeout ?? this.timeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ms);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(`Request timeout after ${ms}ms`);
      }

      if (error instanceof TypeError) {
        throw new NetworkError(error.message);
      }

      throw error;
    }
  }

  /**
   * 处理响应错误，转换为对应的错误类型
   */
  private async handleResponseError(response: Response): Promise<void> {
    if (!response.ok) {
      let errorMessage = `Provider request failed: ${response.status} ${response.statusText}`;
      let errorData: unknown;

      try {
        const text = await response.text();
        errorMessage += `\n${text}`;
        errorData = JSON.parse(text);
      } catch {
        // 忽略解析错误
      }

      // 根据状态码分类错误
      switch (response.status) {
        case 401:
        case 403:
          throw new AuthenticationError(errorMessage);
        case 429:
          throw new RateLimitError(errorMessage);
        case 400:
          // 检查是否是上下文长度超限
          if (this.isContextLengthError(errorData)) {
            throw new ContextLengthExceededError(errorMessage);
          }
          throw new ModelError(errorMessage);
        default:
          if (response.status >= 500) {
            throw new NetworkError(errorMessage);
          }
          throw new ProviderError(errorMessage, 'UNKNOWN_ERROR', response.status, false);
      }
    }
  }

  /**
   * 检查是否是上下文长度错误
   */
  private isContextLengthError(errorData: unknown): boolean {
    if (typeof errorData === 'object' && errorData !== null) {
      const err = errorData as { error?: { code?: string; message?: string } };
      const code = err.error?.code?.toLowerCase() ?? '';
      const message = err.error?.message?.toLowerCase() ?? '';
      return (
        code.includes('context_length_exceeded') ||
        message.includes('context length') ||
        message.includes('too long') ||
        message.includes('maximum')
      );
    }
    return false;
  }

  /**
   * 带重试的执行
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    let delay = this.retryConfig.initialDelayMs;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // 检查是否可重试
        const providerError = error instanceof ProviderError ? error : undefined;
        const isRetryable = providerError?.retryable ?? false;

        if (!isRetryable || attempt === this.retryConfig.maxRetries) {
          throw error;
        }

        // 等待后重试
        await this.sleep(delay);
        delay = Math.min(delay * this.retryConfig.backoffMultiplier, this.retryConfig.maxDelayMs);
      }
    }

    throw lastError ?? new Error('Retry failed');
  }

  /**
   * 解析非流式响应
   */
  private parseChatResponse(payload: any): ModelChatResult {
    const choice = payload.choices?.[0];
    if (!choice) {
      throw new ModelError('Invalid response: no choices returned');
    }

    const message = choice.message;
    const toolCalls: ToolCall[] | undefined = message?.tool_calls?.map((call: any) => ({
      id: call.id,
      name: call.function?.name,
      arguments: safeJsonParse(call.function?.arguments),
    }));

    return {
      text: message?.content ?? undefined,
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      raw: payload,
      usage: this.parseTokenUsage(payload.usage),
    };
  }

  /**
   * 解析流式响应 chunk
   */
  private parseStreamChunk(data: any): StreamChunk {
    const choice = data.choices?.[0];
    const delta = choice?.delta ?? {};

    // 处理 tool_calls delta
    const toolCallDeltas: StreamToolCallDelta[] | undefined = delta.tool_calls?.map((tc: any) => {
      const toolCallDelta: StreamToolCallDelta = {
        index: tc.index,
      };

      if (tc.id) toolCallDelta.id = tc.id;
      if (tc.function?.name) toolCallDelta.name = tc.function.name;
      if (tc.function?.arguments) toolCallDelta.arguments = tc.function.arguments;

      // 累积到 buffer
      this.accumulateToolCall(toolCallDelta);

      return toolCallDelta;
    });

    return {
      delta: {
        role: delta.role,
        content: delta.content,
        toolCalls: toolCallDeltas,
      },
      finishReason: choice?.finish_reason ?? null,
      usage: data.usage ? this.parseTokenUsage(data.usage) : undefined,
    };
  }

  /**
   * 累积 tool call delta
   */
  private accumulateToolCall(delta: StreamToolCallDelta): void {
    const existing = this.streamToolCallsBuffer.get(delta.index);

    if (delta.id) {
      this.streamToolCallsBuffer.set(delta.index, { index: delta.index, id: delta.id });
    } else if (existing) {
      if (delta.name) existing.name = delta.name;
      if (delta.arguments !== undefined) {
        existing.arguments = (existing.arguments || '') + delta.arguments;
      }
    }
  }

  /**
   * 完成 stream tool calls，转换为完整的 ToolCall[]
   */
  private finalizeStreamToolCalls(): ToolCall[] {
    const result: ToolCall[] = [];

    for (const [index, delta] of this.streamToolCallsBuffer) {
      if (delta.id && delta.name) {
        result.push({
          id: delta.id,
          name: delta.name,
          arguments: delta.arguments ? safeJsonParse(delta.arguments) : {},
        });
      }
    }

    return result;
  }

  /**
   * 解析 token 使用量
   */
  private parseTokenUsage(usage: any): TokenUsage | undefined {
    if (!usage) return undefined;

    return {
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens: usage.total_tokens ?? 0,
    };
  }

  /**
   * 转换消息格式为 OpenAI 格式
   */
  private transformMessages(messages: any[]): any[] {
    return messages.map((message) => {
      if (message.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: message.toolCallId,
          content: message.content,
        };
      }
      if (message.role === 'assistant' && message.toolCalls?.length) {
        return {
          role: 'assistant',
          content: message.content || null,
          tool_calls: message.toolCalls.map((call: ToolCall) => ({
            id: call.id,
            type: 'function',
            function: {
              name: call.name,
              arguments: JSON.stringify(call.arguments ?? {}),
            },
          })),
        };
      }
      return {
        role: message.role,
        content: message.content,
      };
    });
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * 安全的 JSON 解析
 */
function safeJsonParse(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || raw.trim() === '') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
