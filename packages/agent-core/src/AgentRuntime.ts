import { ChatMessage, TokenUsage, ProviderError, ModelChatResult } from '@hermes-clone/providers';
import { PromptBuilder } from './PromptBuilder.js';
import { AgentRunInput, AgentRunResult, AgentRuntimeOptions, ConsoleLogger, StreamCallbacks } from './types.js';

/**
 * AgentRuntime - Agent 核心运行时
 *
 * 职责：
 * 1. 协调整个 Agent 对话循环
 * 2. 管理与 Provider 的交互（调用大模型）
 * 3. 处理工具调用（tool_calls）的执行和结果回传
 * 4. 持久化所有会话事件到 SessionStore
 * 5. 防止无限循环（通过 maxIterations 和 maxToolCalls 限制）
 * 6. 收集 Token 使用统计
 * 7. 记录请求/响应日志
 * 8. 支持流式输出
 *
 * 核心流程：
 * 用户输入 → 构建消息 → 调用模型 → 解析响应
 *   ├─ 无 tool_calls：返回文本结果
 *   └─ 有 tool_calls：执行工具 → 回传结果 → 再次调用模型（循环）
 */
export class AgentRuntime {
  /** PromptBuilder 用于构建系统提示词（包含记忆和技能） */
  private promptBuilder: PromptBuilder;
  /** 日志记录器 */
  private logger: NonNullable<AgentRuntimeOptions['logger']>;
  /** 工具调用计数器（防止工具调用循环） */
  private toolCallCount = 0;

  /**
   * 构造函数
   * @param options - Agent 运行时所需的所有依赖组件
   */
  constructor(private options: AgentRuntimeOptions) {
    this.promptBuilder = new PromptBuilder({ memory: options.memory, skills: options.skills });
    this.logger = options.logger ?? new ConsoleLogger();
  }

  /**
   * 运行一次 Agent 交互（非流式）
   *
   * 这是 Agent 的核心方法，实现了完整的对话循环：
   * 1. 加载历史消息
   * 2. 构建系统提示词
   * 3. 循环调用模型直到获得文本响应或达到最大迭代次数
   *
   * @param input - 用户输入（会话 ID 和文本内容）
   * @param callbacks - 流式输出回调（可选）
   * @returns Agent 的响应文本、迭代次数和 Token 统计
   */
  async run(input: AgentRunInput, callbacks?: StreamCallbacks): Promise<AgentRunResult> {
    // 重置工具调用计数
    this.toolCallCount = 0;
    const usageByIteration: TokenUsage[] = [];
    const maxToolCalls = this.options.maxToolCalls ?? 20;

    // ========== 步骤 1: 加载会话历史 ==========
    this.logger.debug('Loading session history', { sessionId: input.sessionId });
    const history = await this.options.sessions.readMessages(input.sessionId);

    // ========== 步骤 2: 构建系统提示词 ==========
    this.logger.debug('Building system prompt');
    const systemPrompt = await this.promptBuilder.buildSystemPrompt(input.text);

    // ========== 步骤 3: 组装完整的消息列表 ==========
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.filter((message) => message.role !== 'system'),
      { role: 'user', content: input.text },
    ];

    // ========== 步骤 4: 持久化用户消息 ==========
    await this.options.sessions.append(input.sessionId, { type: 'message', payload: { role: 'user', content: input.text } });
    this.logger.info('User input received', { sessionId: input.sessionId, textLength: input.text.length });

    // ========== 步骤 5: Agent 主循环 ==========
    for (let iteration = 1; iteration <= this.options.config.maxIterations; iteration++) {
      this.logger.debug(`Starting iteration ${iteration}`);

      // 检查工具调用次数限制
      if (this.toolCallCount >= maxToolCalls) {
        const errorMsg = `达到最大工具调用次数 ${maxToolCalls}，已停止。可能存在工具调用循环。`;
        this.logger.warn(errorMsg, { toolCallCount: this.toolCallCount });
        await this.options.sessions.append(input.sessionId, { type: 'error', payload: errorMsg });
        return {
          text: errorMsg,
          iterations: iteration,
          usage: this.sumUsage(usageByIteration),
          usageByIteration,
        };
      }

      try {
        // --- 调用大模型 ---
        const startTime = Date.now();
        const result = input.stream && this.options.provider.chatStream
          ? await this.streamChat(messages, callbacks)
          : await this.options.provider.chat({
              model: this.options.config.model,
              messages,
              tools: this.options.tools.getSchemas(),
            });

        const duration = Date.now() - startTime;
        this.logger.info('Provider response received', {
          iteration,
          duration: `${duration}ms`,
          hasToolCalls: !!result.toolCalls?.length,
          textLength: result.text?.length ?? 0,
          usage: result.usage,
        });

        // 记录 Token 使用
        if (result.usage) {
          usageByIteration.push(result.usage);
        }

        // --- 处理模型响应 ---

        // 情况 A: 模型请求调用工具
        if (result.toolCalls?.length) {
          this.toolCallCount += result.toolCalls.length;
          this.logger.debug('Processing tool calls', { count: result.toolCalls.length, totalCalls: this.toolCallCount });

          messages.push({ role: 'assistant', content: result.text ?? '', toolCalls: result.toolCalls });
          await this.options.sessions.append(input.sessionId, { type: 'message', payload: messages[messages.length - 1] });

          // 执行每个工具调用
          for (const call of result.toolCalls) {
            this.logger.debug('Executing tool', { name: call.name });
            await this.options.sessions.append(input.sessionId, { type: 'tool_call', payload: call });

            // 回调通知
            callbacks?.onToolCall?.({ name: call.name, arguments: call.arguments });

            const toolStartTime = Date.now();
            const toolResult = await this.options.tools.dispatch(call.name, call.arguments, {
              workspaceDir: this.options.config.workspaceDir,
              dataDir: this.options.config.dataDir,
            });
            const toolDuration = Date.now() - toolStartTime;

            this.logger.info('Tool executed', {
              name: call.name,
              ok: toolResult.ok,
              duration: `${toolDuration}ms`,
              contentLength: toolResult.content.length,
            });

            // 回调通知
            callbacks?.onToolResult?.({ name: call.name, ok: toolResult.ok, content: toolResult.content });

            const content = JSON.stringify(toolResult, null, 2);
            const toolMessage: ChatMessage = {
              role: 'tool',
              toolCallId: call.id,
              name: call.name,
              content,
            };

            messages.push(toolMessage);
            await this.options.sessions.append(input.sessionId, { type: 'tool_result', payload: { call, toolResult } });
            await this.options.sessions.append(input.sessionId, { type: 'message', payload: toolMessage });
          }

          continue;
        }

        // --- 情况 B: 模型返回纯文本响应 ---
        const finalText = result.text ?? '';
        const assistantMessage: ChatMessage = { role: 'assistant', content: finalText };

        messages.push(assistantMessage);
        await this.options.sessions.append(input.sessionId, { type: 'message', payload: assistantMessage });

        this.logger.info('Agent run completed', {
          iterations: iteration,
          toolCalls: this.toolCallCount,
          textLength: finalText.length,
        });

        return {
          text: finalText,
          iterations: iteration,
          usage: this.sumUsage(usageByIteration),
          usageByIteration,
        };

      } catch (error) {
        // 处理 Provider 错误
        if (error instanceof ProviderError) {
          this.logger.error('Provider error', error, {
            code: error.code,
            retryable: error.retryable,
            statusCode: error.statusCode,
          });

          // 如果是不可重试的错误（如认证错误、上下文过长），直接返回
          if (!error.retryable) {
            const errorMsg = `Provider error (${error.code}): ${error.message}`;
            await this.options.sessions.append(input.sessionId, { type: 'error', payload: errorMsg });
            return {
              text: errorMsg,
              iterations: iteration,
              usage: this.sumUsage(usageByIteration),
              usageByIteration,
            };
          }

          // 可重试的错误已在 Provider 层处理，这里记录后继续
          this.logger.warn('Provider error was retried but still failed', { error: error.message });
          continue;
        }

        // 其他未预期的错误
        this.logger.error('Unexpected error in agent loop', error as Error);
        const errorMsg = `运行时错误: ${error instanceof Error ? error.message : String(error)}`;
        await this.options.sessions.append(input.sessionId, { type: 'error', payload: errorMsg });
        return {
          text: errorMsg,
          iterations: iteration,
          usage: this.sumUsage(usageByIteration),
          usageByIteration,
        };
      }
    }

    // ========== 步骤 6: 达到最大迭代次数 ==========
    const fallback = `达到最大迭代次数 ${this.options.config.maxIterations}，已停止。请缩小任务范围或检查工具调用是否循环。`;
    this.logger.warn(fallback, { iterations: this.options.config.maxIterations, toolCalls: this.toolCallCount });
    await this.options.sessions.append(input.sessionId, { type: 'error', payload: fallback });
    return {
      text: fallback,
      iterations: this.options.config.maxIterations,
      usage: this.sumUsage(usageByIteration),
      usageByIteration,
    };
  }

  /**
   * 流式聊天处理
   */
  private async streamChat(messages: ChatMessage[], callbacks?: StreamCallbacks): Promise<ModelChatResult> {
    const provider = this.options.provider;
    if (!provider.chatStream) {
      throw new Error('Provider does not support streaming');
    }

    let fullText = '';
    let finalResult: ModelChatResult | undefined;

    // chatStream 返回 AsyncGenerator<StreamChunk, ModelChatResult>
    // 最终的 ModelChatResult 作为迭代器的返回值
    const generator = provider.chatStream({
      model: this.options.config.model,
      messages,
      tools: this.options.tools.getSchemas(),
      stream: true,
    });

    try {
      for await (const chunk of generator) {
        if (chunk.delta.content) {
          fullText += chunk.delta.content;
          callbacks?.onText?.(chunk.delta.content);
        }
      }
    } finally {
      // 迭代结束后，获取最终结果（这是 AsyncGenerator 的 return value）
      const iteratorResult = await generator.next();
      finalResult = iteratorResult.value as ModelChatResult;
    }

    // 如果 provider 没有返回最终结果，用累积的文本构建
    return finalResult || { text: fullText };
  }

  /**
   * 累计 Token 使用量
   */
  private sumUsage(usages: TokenUsage[]): TokenUsage | undefined {
    if (usages.length === 0) return undefined;

    return usages.reduce(
      (acc, usage) => ({
        promptTokens: acc.promptTokens + usage.promptTokens,
        completionTokens: acc.completionTokens + usage.completionTokens,
        totalTokens: acc.totalTokens + usage.totalTokens,
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    );
  }
}
