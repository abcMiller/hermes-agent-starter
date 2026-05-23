# 架构说明

## 1. 架构定位

本项目是一个 Hermes Agent 风格的 Agent Runtime Starter。核心目标是把 Agent 能力拆成清晰模块：

```text
用户入口层
  ↓
Agent Core
  ↓
Provider / Tools / Memory / Skills / Session
```

## 2. 总体架构

```text
Entry Layer
├─ CLI
├─ Web API             后续实现
├─ Gateway             后续实现
└─ Scheduler           后续实现

Agent Core
├─ AgentRuntime
├─ PromptBuilder
├─ Loop Controller     当前合并在 AgentRuntime 中
├─ Tool Dispatch
└─ Session Persistence

Capability Layer
├─ ToolRegistry
├─ MemoryStore
├─ SkillLoader
└─ Plugin / MCP        后续实现

Provider Layer
├─ MockProvider
└─ OpenAICompatibleProvider
```

## 3. 模块职责

### AgentRuntime

负责完整的 Agent Loop：

1. 读取历史消息
2. 构建系统 Prompt
3. 调用 Provider
4. 解析 tool call
5. 执行工具
6. 将工具结果追加到上下文
7. 继续调用模型
8. 保存最终结果

### PromptBuilder

负责组装：

- 系统角色说明
- 用户长期记忆 USER.md
- 项目长期记忆 MEMORY.md
- 匹配到的 Skills

### Provider

负责屏蔽不同模型 API 的差异。Agent Core 只依赖统一的 `ModelProvider` 接口。

### ToolRegistry

负责注册、查询和执行工具。

### MemoryStore

负责读取长期记忆文件。

### SkillLoader

负责扫描 `data/skills/*/SKILL.md` 并按用户输入进行简单匹配。

### SessionStore

当前使用 JSONL 保存事件，便于调试。后续可以替换为 SQLite + FTS5。

## 4. 为什么先做 CLI

CLI 是最小入口，不涉及用户系统、Webhook、前端状态和权限系统。先用 CLI 跑通 Agent Core，可以降低复杂度。

## 5. 后续扩展点

- Web UI：复用 AgentRuntime
- Gateway：消息平台只做 Adapter
- Scheduler：定时创建 AgentRuntime 执行任务
- MCP：把 MCP 工具注册到 ToolRegistry
- Plugin：插件可注册工具和 Hook
