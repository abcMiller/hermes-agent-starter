# CLAUDE.md - @hermes-clone/agent-core

This package contains the core Agent Runtime orchestration logic.

## Structure

- `AgentRuntime.ts` - Main agent loop: calls Provider, handles tool_calls, manages iterations
- `PromptBuilder.ts` - Assembles system prompt from Memory (USER.md/MEMORY.md) and Skills
- `createRuntime.ts` - Factory that assembles all dependencies into an AgentRuntime instance
- `types.ts` - Shared interfaces (AgentRuntimeOptions, AgentRunInput, AgentRunResult)

## Agent Loop Flow

1. Load session history from SessionStore
2. Build system prompt via PromptBuilder (reads memory, matches skills)
3. Call Provider.chat() with messages + tool schemas
4. If tool_calls returned:
   - Execute each via ToolRegistry.dispatch()
   - Append tool results to messages
   - Loop back to step 3
5. Else: return text response

## Dependencies

This package depends on all other Hermes packages:
- `@hermes-clone/config` - HermesConfig interface
- `@hermes-clone/providers` - ModelProvider, ChatMessage
- `@hermes-clone/tools` - ToolRegistry
- `@hermes-clone/memory` - MemoryStore, JsonSessionStore
- `@hermes-clone/skills` - SkillLoader

## Key Concepts

**maxIterations**: Prevents infinite tool call loops. Configured via `HERMES_MAX_ITERATIONS` (default: 8).

**Session Persistence**: Every event (message, tool_call, tool_result, error) is appended to SessionStore as JSONL.
