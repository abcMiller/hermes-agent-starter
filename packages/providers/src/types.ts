export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ModelChatInput {
  messages: ChatMessage[];
  tools: ToolSchema[];
  model: string;
}

export interface ModelChatResult {
  text?: string;
  toolCalls?: ToolCall[];
  raw?: unknown;
}

export interface ModelProvider {
  name: string;
  chat(input: ModelChatInput): Promise<ModelChatResult>;
}
