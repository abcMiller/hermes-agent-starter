import { ModelChatInput, ModelChatResult, ModelProvider, ToolCall } from './types.js';

export interface OpenAICompatibleProviderOptions {
  apiKey?: string;
  baseUrl: string;
  name?: string;
}

export class OpenAICompatibleProvider implements ModelProvider {
  name: string;
  private apiKey?: string;
  private baseUrl: string;

  constructor(options: OpenAICompatibleProviderOptions) {
    this.name = options.name ?? 'openai-compatible';
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
  }

  async chat(input: ModelChatInput): Promise<ModelChatResult> {
    if (!this.apiKey) {
      throw new Error('Missing HERMES_API_KEY for openai-compatible provider.');
    }

    const messages = input.messages.map((message) => {
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
          tool_calls: message.toolCalls.map((call) => ({
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

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        messages,
        tools: input.tools,
        tool_choice: input.tools.length > 0 ? 'auto' : undefined,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Provider request failed: ${response.status} ${response.statusText}\n${body}`);
    }

    const payload = await response.json() as any;
    const choice = payload.choices?.[0]?.message;
    const toolCalls: ToolCall[] | undefined = choice?.tool_calls?.map((call: any) => ({
      id: call.id,
      name: call.function?.name,
      arguments: safeJsonParse(call.function?.arguments),
    }));

    return {
      text: choice?.content ?? undefined,
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      raw: payload,
    };
  }
}

function safeJsonParse(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || raw.trim() === '') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
