import {
  ModelChatInput,
  ModelChatResult,
  ModelProvider,
  ToolCall,
  TokenUsage,
  NetworkError,
  TimeoutError,
  ProviderError,
  StreamChunk,
} from './types.js';

/**
 * Ollama Provider options
 *
 * Ollama 是一个本地运行大模型的工具，支持多种开源模型。
 * 默认运行在 http://localhost:11434
 */
export interface OllamaProviderOptions {
  /** Ollama 服务地址，默认 localhost:11434 */
  baseUrl?: string;
  /** 自定义名称 */
  name?: string;
  /** 请求超时时间（毫秒），Ollama 本地推理可能需要更长时间 */
  timeout?: number;
  /** 是否启用流式输出（Ollama 原生支持） */
  stream?: boolean;
}

/**
 * Ollama 模型信息
 */
export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

/**
 * Ollama API 响应格式
 */
interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Ollama Provider - 本地模型支持
 *
 * 支持：
 * - 无需 API Key（本地运行）
 * - 开源模型（Llama, Mistral, Gemma, Qwen 等）
 * - 流式输出
 * - Token 统计
 * - 自动重试（本地模型通常稳定，但仍有网络超时可能）
 *
 * 使用方法：
 * 1. 安装 Ollama: https://ollama.com
 * 2. 运行服务: ollama serve
 * 3. 拉取模型: ollama pull llama2
 * 4. 配置: HERMES_PROVIDER=ollama, HERMES_MODEL=llama2
 */
export class OllamaProvider implements ModelProvider {
  name: string;
  private baseUrl: string;
  private timeout: number;
  private enableStream: boolean;

  constructor(options: OllamaProviderOptions = {}) {
    this.name = options.name ?? 'ollama';
    this.baseUrl = (options.baseUrl ?? 'http://localhost:11434').replace(/\/$/, '');
    this.timeout = options.timeout ?? 120000; // 默认 2 分钟（本地模型可能慢）
    this.enableStream = options.stream ?? false;
  }

  /**
   * 非流式聊天
   */
  async chat(input: ModelChatInput): Promise<ModelChatResult> {
    try {
      return await this.chatInternal(input, false);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * 流式聊天
   */
  async *chatStream(input: ModelChatInput): AsyncGenerator<StreamChunk, ModelChatResult, unknown> {
    const body = JSON.stringify({
      model: input.model,
      messages: this.transformMessages(input.messages),
      tools: input.tools.length > 0 ? this.transformTools(input.tools) : undefined,
      stream: true,
    });

    const response = await this.fetchWithTimeout(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });

    await this.handleResponseError(response);

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let fullText = '';
    let promptEvalCount = 0;
    let evalCount = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);

            if (data.message?.content) {
              const content = data.message.content;
              fullText += content;

              yield {
                delta: { content },
                finishReason: data.done ? 'stop' : null,
              };
            }

            if (data.prompt_eval_count) promptEvalCount = data.prompt_eval_count;
            if (data.eval_count) evalCount = data.eval_count;
          } catch {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // 返回最终结果
    return {
      text: fullText,
      raw: { fullText },
      usage: {
        promptTokens: promptEvalCount,
        completionTokens: evalCount,
        totalTokens: promptEvalCount + evalCount,
      },
    };
  }

  /**
   * 健康检查 - 检查 Ollama 服务是否运行
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      }, 5000);

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 获取已安装的模型列表
   */
  async listModels(): Promise<OllamaModel[]> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/api/tags`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new NetworkError(`Failed to list models: ${response.statusText}`);
    }

    const data = await response.json() as { models: OllamaModel[] };
    return data.models ?? [];
  }

  /**
   * 内部聊天实现
   */
  private async chatInternal(input: ModelChatInput, stream: boolean): Promise<ModelChatResult> {
    // Ollama 使用不同的 API 格式
    const body = JSON.stringify({
      model: input.model,
      messages: this.transformMessages(input.messages),
      tools: input.tools.length > 0 ? this.transformTools(input.tools) : undefined,
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
      },
    });

    const response = await this.fetchWithTimeout(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });

    await this.handleResponseError(response);

    const data = await response.json() as OllamaChatResponse;

    return {
      text: data.message?.content ?? '',
      raw: data,
      usage: this.parseTokenUsage(data),
    };
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
        signal: controller.signal as any,
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
   * 处理响应错误
   */
  private async handleResponseError(response: Response): Promise<void> {
    if (!response.ok) {
      let errorMessage = `Ollama request failed: ${response.status} ${response.statusText}`;

      try {
        const text = await response.text();
        errorMessage += `\n${text}`;
      } catch {
        // 忽略
      }

      if (response.status >= 500) {
        throw new NetworkError(errorMessage);
      }

      throw new ProviderError(errorMessage, 'OLLAMA_ERROR', response.status, false);
    }
  }

  /**
   * 转换错误类型
   */
  private handleError(error: unknown): Error {
    if (error instanceof ProviderError || error instanceof TimeoutError || error instanceof NetworkError) {
      return error;
    }

    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
        return new NetworkError(`Ollama service not running at ${this.baseUrl}. Start it with "ollama serve"`);
      }
    }

    return new ProviderError(String(error), 'UNKNOWN_ERROR', undefined, false);
  }

  /**
   * 解析 Token 使用量
   */
  private parseTokenUsage(data: OllamaChatResponse): TokenUsage {
    return {
      promptTokens: data.prompt_eval_count ?? 0,
      completionTokens: data.eval_count ?? 0,
      totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
    };
  }

  /**
   * 转换消息格式（Ollama 格式与 OpenAI 类似）
   */
  private transformMessages(messages: any[]): any[] {
    return messages.map((message) => {
      if (message.role === 'tool') {
        // Ollama 不支持 tool 角色，转换为 user 角色并标注
        return {
          role: 'user',
          content: `[Tool: ${message.name}] ${message.content}`,
        };
      }
      if (message.role === 'assistant' && message.toolCalls?.length) {
        // Ollama 不支持 tool_calls，转换为文本
        const toolCallsText = message.toolCalls
          .map((call: ToolCall) => `[Call Tool: ${call.name} with ${JSON.stringify(call.arguments)}]`)
          .join('\n');
        return {
          role: 'assistant',
          content: `${message.content || ''}\n${toolCallsText}`,
        };
      }
      return {
        role: message.role,
        content: message.content,
      };
    });
  }

  /**
   * 转换工具格式（Ollama 使用 Function Call）
   */
  private transformTools(tools: any[]): any[] {
    // Ollama 支持函数调用，格式类似 OpenAI
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    }));
  }
}
