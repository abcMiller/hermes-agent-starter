# CLAUDE.md - @hermes-clone/providers

This package abstracts LLM provider differences behind a unified interface.

## Structure

- `types.ts` - Core interfaces: ModelProvider, ChatMessage, ToolCall, ModelChatInput, ModelChatResult
- `OpenAICompatibleProvider.ts` - Implements OpenAI Chat Completions API
- `MockProvider.ts` - Demo/testing provider with hardcoded responses

## ModelProvider Interface

```ts
interface ModelProvider {
  name: string;
  chat(input: ModelChatInput): Promise<ModelChatResult>;
}
```

## ChatMessage Format

Supports four roles: `system | user | assistant | tool`

Special fields:
- `toolCallId` - Required for tool role messages
- `toolCalls` - Array of ToolCall for assistant messages

## OpenAI Compatibility

The `OpenAICompatibleProvider` transforms internal `ChatMessage` format to OpenAI wire format:
- Maps `tool` role to `{ role: 'tool', tool_call_id: ..., content: ... }`
- Maps assistant `toolCalls` to OpenAI `tool_calls` format with `{ id, type: 'function', function: { name, arguments } }`

This allows connecting to any OpenAI-compatible API (OpenAI, DeepSeek, OpenRouter, Kimi, GLM, etc.).

## MockProvider

For testing without API keys. Responds with tool_calls for keywords like "文件", "list", "ls", or "read.*README". Otherwise returns text response.

## Adding New Providers

1. Create a new class implementing `ModelProvider`
2. Transform `ModelChatInput` to provider-specific format
3. Transform response back to `ModelChatResult`
4. Register in `createRuntime.ts` (in agent-core package)
