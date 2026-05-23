# CLAUDE.md - @hermes-clone/memory

This package provides long-term memory and session persistence.

## Structure

- `MemoryStore.ts` - Reads USER.md and MEMORY.md files
- `SessionStore.ts` - JSONL-based session event storage
- `index.ts` - Exports both classes

## MemoryStore

Reads two markdown files from `data/memories/`:

- **USER.md** - User preferences, communication style, common tools
- **MEMORY.md** - Project background, Agent experience, long-term context

Both files are auto-created with default content if missing. These are injected into the system prompt by `PromptBuilder` in every conversation.

## JsonSessionStore

Persists conversation events as JSONL (newline-delimited JSON) in `data/sessions/<sessionId>.jsonl`.

### Event Types

```ts
type SessionEventType = 'message' | 'tool_call' | 'tool_result' | 'error';
```

Each event has:
- `timestamp` - ISO 8601 timestamp
- `type` - Event type
- `payload` - Event-specific data

### Reading Sessions

`readMessages(sessionId, limit = 30)` returns only `message` type events as `ChatMessage[]`, filtered to last N entries. Tool calls are stored but not returned for model context (tool results are included as `tool` role messages).

### Session ID Safety

Session IDs are sanitized via `safeId()` which replaces non-alphanumeric characters (except `._-`) with underscores.

## Future Plans

Planned upgrade from JSONL to SQLite + FTS5 for:
- Full-text search across sessions
- Better performance with large histories
- Session summaries and compression
