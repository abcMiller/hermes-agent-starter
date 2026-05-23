# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hermes Agent Starter is a TypeScript monorepo implementing an Agent Runtime with tool calling, memory, skills, and CLI interface. It follows a modular architecture: Agent Core + Provider Layer + Tool System + Memory System + Skill System + Session Store.

## Commands

```bash
# Development
pnpm install              # Install dependencies (requires pnpm >= 9.0.0, Node >= 20.0.0)
pnpm dev                  # Start interactive CLI chat (uses tsx, no build needed)
pnpm cli chat             # Alternative way to start CLI
pnpm demo                 # Run MockProvider demo (no API key needed)

# Building
pnpm build                # Compile all packages
pnpm typecheck            # Type-check without emitting
pnpm clean                # Remove dist directories

# CLI Commands
pnpm cli doctor           # Print current runtime configuration
pnpm cli chat --once "<prompt>"    # Run single prompt and exit
pnpm cli chat -s <session-id>       # Use specific session
```

## Environment Configuration

Copy `.env.example` to `.env` and configure:

```env
HERMES_PROVIDER=mock|openai-compatible
HERMES_BASE_URL=https://api.openai.com/v1
HERMES_API_KEY=sk-xxx
HERMES_MODEL=gpt-4o-mini
HERMES_DATA_DIR=./data
HERMES_WORKSPACE_DIR=./workspace
HERMES_MAX_ITERATIONS=8

# Shell tool (disabled by default)
HERMES_ENABLE_SHELL=false
HERMES_ALLOWED_SHELL_COMMANDS=pwd,ls,cat,echo,node,npm,pnpm,git
HERMES_SHELL_TIMEOUT_MS=15000
```

The CLI supports any OpenAI-compatible provider (OpenAI, DeepSeek, OpenRouter, Kimi, GLM, etc.).

## Architecture

### Entry Points

- `apps/cli/src/index.ts` - CLI entry point using Commander.js
- `packages/agent-core/src/createRuntime.ts` - Runtime factory that assembles all components

### Core Flow

```
CLI → AgentRuntime.run() → PromptBuilder → Provider.chat()
                                          ↓
                                    tool_calls?
                                          ↓
                                    ToolRegistry.dispatch()
                                          ↓
                                    Provider.chat() (with tool results)
                                          ↓
                                    (repeat until text response or max iterations)
```

### Key Modules

**agent-core**: `AgentRuntime` orchestrates the agent loop, `PromptBuilder` assembles system prompt from memory/skills.

**providers**: `ModelProvider` interface abstracts LLM APIs. `OpenAICompatibleProvider` handles OpenAI-compatible endpoints. `MockProvider` for testing without API calls.

**tools**: `ToolRegistry` manages tool registration/dispatch. Tools use Zod schemas for validation. Built-in: `list_files`, `read_file`, `write_file`, `run_shell` (opt-in).

**memory**: `MemoryStore` reads `data/memories/USER.md` and `MEMORY.md`. `JsonSessionStore` persists conversation events as JSONL.

**skills**: `SkillLoader` scans `data/skills/*/SKILL.md` and matches by keyword against user input.

**config**: `loadConfig()` reads environment variables with type coercion (bool, int).

### Workspace Safety

File operations are restricted to `workspaceDir` via `resolveInsideWorkspace()` in `tools/src/pathSafety.ts`. Shell commands require whitelist configuration.

### Session Storage

Sessions stored as JSONL in `data/sessions/<sessionId>.jsonl`. Each line is a `SessionEvent` with timestamp, type, and payload. History is truncated to last 30 messages when loading.

### Skill Matching

`SkillLoader.loadRelevantSkills()` uses simple keyword matching. The hardcoded hints list includes: frontend, design, review, playwright, document, etc.

## Development Notes

- No build step needed for development (`tsx` runs TypeScript directly)
- Package exports use `workspace:*` protocol via pnpm
- Tool schemas manually converted from Zod to JSON Schema in `toOpenAIToolSchema()`
- Shell tool is **disabled by default** for security
- `AgentRuntime` enforces `maxIterations` to prevent infinite tool call loops

## Roadmap

See `docs/DEVELOPMENT_PLAN.md` for phased development plan. Current phase: Agent Core stabilization.
