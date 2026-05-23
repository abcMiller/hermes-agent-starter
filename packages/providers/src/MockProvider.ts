import { ModelChatInput, ModelChatResult, ModelProvider } from './types.js';

function latestUserText(input: ModelChatInput): string {
  return [...input.messages].reverse().find((message) => message.role === 'user')?.content ?? '';
}

function hasToolResult(input: ModelChatInput): boolean {
  return input.messages.some((message) => message.role === 'tool');
}

export class MockProvider implements ModelProvider {
  name = 'mock';

  async chat(input: ModelChatInput): Promise<ModelChatResult> {
    const userText = latestUserText(input);

    if (!hasToolResult(input) && /(文件|目录|list|ls|查看当前)/i.test(userText)) {
      return {
        toolCalls: [
          {
            id: `mock_tool_${Date.now()}`,
            name: 'list_files',
            arguments: { path: '.' },
          },
        ],
      };
    }

    if (!hasToolResult(input) && /(读取|read).+README/i.test(userText)) {
      return {
        toolCalls: [
          {
            id: `mock_tool_${Date.now()}`,
            name: 'read_file',
            arguments: { path: 'README.md' },
          },
        ],
      };
    }

    const toolOutputs = input.messages.filter((message) => message.role === 'tool').map((message) => message.content);
    if (toolOutputs.length > 0) {
      return {
        text: `工具已经执行完成。结果摘要：\n\n${toolOutputs.join('\n\n').slice(0, 2500)}`,
      };
    }

    return {
      text: `MockProvider 回复：我收到了你的请求：“${userText}”。\n\n当前项目已经具备 Agent Core、Provider、ToolRegistry、Memory、Skills 和 CLI 的最小骨架。把 HERMES_PROVIDER 改成 openai-compatible 并配置 API Key 后即可接入真实模型。`,
    };
  }
}
