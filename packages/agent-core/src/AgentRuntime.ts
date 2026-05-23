import { ChatMessage } from '@hermes-clone/providers';
import { PromptBuilder } from './PromptBuilder.js';
import { AgentRunInput, AgentRunResult, AgentRuntimeOptions } from './types.js';

/**
 * AgentRuntime - Agent 核心运行时
 *
 * 职责：
 * 1. 协调整个 Agent 对话循环
 * 2. 管理与 Provider 的交互（调用大模型）
 * 3. 处理工具调用（tool_calls）的执行和结果回传
 * 4. 持久化所有会话事件到 SessionStore
 * 5. 防止无限循环（通过 maxIterations 限制）
 *
 * 核心流程：
 * 用户输入 → 构建消息 → 调用模型 → 解析响应
 *   ├─ 无 tool_calls：返回文本结果
 *   └─ 有 tool_calls：执行工具 → 回传结果 → 再次调用模型（循环）
 */
export class AgentRuntime {
  /** PromptBuilder 用于构建系统提示词（包含记忆和技能） */
  private promptBuilder: PromptBuilder;

  /**
   * 构造函数
   * @param options - Agent 运行时所需的所有依赖组件
   */
  constructor(private options: AgentRuntimeOptions) {
    // 初始化 PromptBuilder，传入 memory 和 skills 用于构建系统提示
    this.promptBuilder = new PromptBuilder({ memory: options.memory, skills: options.skills });
  }

  /**
   * 运行一次 Agent 交互
   *
   * 这是 Agent 的核心方法，实现了完整的对话循环：
   * 1. 加载历史消息
   * 2. 构建系统提示词
   * 3. 循环调用模型直到获得文本响应或达到最大迭代次数
   *
   * @param input - 用户输入（会话 ID 和文本内容）
   * @returns Agent 的响应文本和消耗的迭代次数
   */
  async run(input: AgentRunInput): Promise<AgentRunResult> {
    // ========== 步骤 1: 加载会话历史 ==========
    // 从 SessionStore 读取该会话的历史消息（最近 30 条）
    const history = await this.options.sessions.readMessages(input.sessionId);

    // ========== 步骤 2: 构建系统提示词 ==========
    // PromptBuilder 会读取 USER.md 和 MEMORY.md，并匹配相关 Skills
    const systemPrompt = await this.promptBuilder.buildSystemPrompt(input.text);

    // ========== 步骤 3: 组装完整的消息列表 ==========
    const messages: ChatMessage[] = [
      // 系统提示词：包含 Agent 角色定义、用户记忆、项目记忆、相关技能
      { role: 'system', content: systemPrompt },
      // 历史消息：过滤掉 system 角色避免重复（已在 systemPrompt 中包含）
      ...history.filter((message) => message.role !== 'system'),
      // 当前用户输入
      { role: 'user', content: input.text },
    ];

    // ========== 步骤 4: 持久化用户消息 ==========
    // 将用户的输入保存到会话记录中
    await this.options.sessions.append(input.sessionId, { type: 'message', payload: { role: 'user', content: input.text } });

    // ========== 步骤 5: Agent 主循环 ==========
    // 循环调用模型，直到：
    // - 模型返回纯文本响应（不包含 tool_calls）
    // - 达到最大迭代次数（防止无限循环）
    for (let iteration = 1; iteration <= this.options.config.maxIterations; iteration++) {
      // --- 调用大模型 ---
      const result = await this.options.provider.chat({
        model: this.options.config.model,           // 模型名称（如 deepseek-chat）
        messages,                                    // 完整的对话上下文
        tools: this.options.tools.getSchemas(),     // 可用工具的 JSON Schema 描述
      });

      // --- 处理模型响应 ---

      // 情况 A: 模型请求调用工具
      if (result.toolCalls?.length) {
        // 保存 assistant 的 tool_calls 消息
        messages.push({ role: 'assistant', content: result.text ?? '', toolCalls: result.toolCalls });
        await this.options.sessions.append(input.sessionId, { type: 'message', payload: messages[messages.length - 1] });

        // 执行每个工具调用
        for (const call of result.toolCalls) {
          // 记录工具调用事件
          await this.options.sessions.append(input.sessionId, { type: 'tool_call', payload: call });

          // 通过 ToolRegistry 分发并执行工具
          const toolResult = await this.options.tools.dispatch(call.name, call.arguments, {
            workspaceDir: this.options.config.workspaceDir,  // 工作区目录（文件操作边界）
            dataDir: this.options.config.dataDir,            // 数据目录
          });

          // 将工具结果序列化为 JSON 字符串
          const content = JSON.stringify(toolResult, null, 2);

          // 构建 tool 角色的消息（将结果回传给模型）
          const toolMessage: ChatMessage = {
            role: 'tool',
            toolCallId: call.id,    // 关联到原始 tool_call 的 ID
            name: call.name,        // 工具名称
            content                 // 工具执行结果（JSON 字符串）
          };

          // 将工具结果添加到消息列表
          messages.push(toolMessage);

          // 持久化工具执行结果
          await this.options.sessions.append(input.sessionId, { type: 'tool_result', payload: { call, toolResult } });
          await this.options.sessions.append(input.sessionId, { type: 'message', payload: toolMessage });
        }

        // 工具执行完毕，继续循环，再次调用模型让模型基于工具结果继续推理
        continue;
      }

      // --- 情况 B: 模型返回纯文本响应（无 tool_calls）---

      const finalText = result.text ?? '';
      const assistantMessage: ChatMessage = { role: 'assistant', content: finalText };

      // 保存最终响应
      messages.push(assistantMessage);
      await this.options.sessions.append(input.sessionId, { type: 'message', payload: assistantMessage });

      // 返回结果给用户
      return { text: finalText, iterations: iteration };
    }

    // ========== 步骤 6: 达到最大迭代次数（异常情况）==========
    // 如果循环结束仍未返回，说明达到了最大迭代次数限制
    // 这通常意味着模型在循环调用工具，需要人工介入
    const fallback = `达到最大迭代次数 ${this.options.config.maxIterations}，已停止。请缩小任务范围或检查工具调用是否循环。`;
    await this.options.sessions.append(input.sessionId, { type: 'error', payload: fallback });
    return { text: fallback, iterations: this.options.config.maxIterations };
  }
}
