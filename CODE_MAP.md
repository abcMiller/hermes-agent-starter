# Code Map - Hermes Agent Starter

This document provides a visual map of the codebase structure and key dependencies.

## Project Structure

```
hermes-agent-starter/
├── apps/
│   └── cli/                    # CLI Entry Point
│       └── src/
│           └── index.ts        # Commander.js CLI, chat/doctor commands
│
├── packages/
│   ├── agent-core/             # Core Agent Runtime
│   │   └── src/
│   │       ├── AgentRuntime.ts      # Main agent loop orchestration
│   │       ├── PromptBuilder.ts     # System prompt assembly
│   │       ├── createRuntime.ts     # Factory for assembling runtime
│   │       └── types.ts             # Core interfaces
│   │
│   ├── providers/              # LLM Provider Abstraction
│   │   └── src/
│   │       ├── types.ts             # ModelProvider, ChatMessage interfaces
│   │       ├── OpenAICompatibleProvider.ts
│   │       └── MockProvider.ts
│   │
│   ├── tools/                  # Tool System
│   │   └── src/
│   │       ├── types.ts             # Tool interface, ToolRegistry
│   │       ├── ToolRegistry.ts      # Registration and dispatch
│   │       ├── FileTool.ts          # list_files, read_file, write_file
│   │       ├── ShellTool.ts         # run_shell (opt-in)
│   │       └── pathSafety.ts        # Workspace boundary enforcement
│   │
│   ├── memory/                 # Memory & Session Storage
│   │   └── src/
│   │       ├── MemoryStore.ts       # USER.md / MEMORY.md reader
│   │       ├── SessionStore.ts      # JSONL session persistence
│   │       └── index.ts
│   │
│   ├── skills/                 # Skill Loading System
│   │   └── src/
│   │       ├── SkillLoader.ts       # Keyword-based skill matching
│   │       └── index.ts
│   │
│   └── config/                 # Configuration Management
│       └── src/
│           ├── types.ts             # HermesConfig interface
│           ├── loadConfig.ts        # Environment variable parsing
│           └── index.ts
│
├── data/                       # Runtime Data Directory
│   ├── memories/
│   │   ├── USER.md             # User preferences (auto-created)
│   │   └── MEMORY.md           # Project memory (auto-created)
│   ├── skills/                 # Skill definitions
│   │   └── <skill-id>/SKILL.md
│   └── sessions/               # JSONL session logs
│       └── <sessionId>.jsonl
│
├── workspace/                  # Default workspace for tools
├── docs/                       # Architecture documentation
└── config/                     # Configuration templates
```

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI App                              │
│                    (apps/cli/src/index.ts)                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    createRuntime()                           │
│              (agent-core/src/createRuntime.ts)               │
└─────┬─────────┬─────────┬─────────┬─────────┬───────────────┘
      │         │         │         │         │
      ▼         ▼         ▼         ▼         ▼
┌──────────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐
│ Provider │ │Tools │ │Memory│ │Skills│ │  Config  │
└──────────┘ └──────┘ └──────┘ └──────┘ └──────────┘
```

## Package Dependencies

```
@hermes-clone/agent-core
├── @hermes-clone/config
├── @hermes-clone/providers
├── @hermes-clone/tools
├── @hermes-clone/memory
└── @hermes-clone/skills

@hermes-clone/tools
└── @hermes-clone/providers

@hermes-clone/memory
└── @hermes-clone/providers

@hermes-clone/cli
├── @hermes-clone/agent-core
└── (all other packages via agent-core)
```

## Execution Flow

```
User Input
    │
    ▼
┌───────────────────┐
│   CLI (index.ts)  │
└─────────┬─────────┘
          │
          ▼
┌───────────────────────────────────────────┐
│        AgentRuntime.run()                 │
│  ┌─────────────────────────────────────┐  │
│  │ 1. Load session history             │  │
│  │ 2. PromptBuilder.buildSystemPrompt()│  │
│  │    ├─ MemoryStore (USER/MEMORY.md)  │  │
│  │    └─ SkillLoader (match keywords)  │  │
│  │ 3. Provider.chat()                  │  │
│  │ 4. If tool_calls:                   │  │
│  │    ToolRegistry.dispatch()          │  │
│  │    └─ loop back to step 3           │  │
│  │ 5. Save to SessionStore             │  │
│  └─────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

## Key File Locations

| Function | File |
|----------|------|
| CLI commands | `apps/cli/src/index.ts` |
| Agent loop | `packages/agent-core/src/AgentRuntime.ts` |
| Prompt assembly | `packages/agent-core/src/PromptBuilder.ts` |
| Runtime factory | `packages/agent-core/src/createRuntime.ts` |
| Provider interface | `packages/providers/src/types.ts` |
| Tool registry | `packages/tools/src/ToolRegistry.ts` |
| File tools | `packages/tools/src/FileTool.ts` |
| Session storage | `packages/memory/src/SessionStore.ts` |
| Config loading | `packages/config/src/loadConfig.ts` |
| Skill loading | `packages/skills/src/SkillLoader.ts` |
| Path safety | `packages/tools/src/pathSafety.ts` |
