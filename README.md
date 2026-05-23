# Hermes Agent Starter

这是根据《Hermes Agent 架构与流程图》初始化的一份 TypeScript 项目代码骨架。项目目标是复刻 Hermes Agent 的核心思想：

> Agent Core + Provider Layer + Tool System + Memory System + Skill System + Session Store + CLI。

当前版本是 **MVP Starter**，重点是把核心闭环跑通，而不是一次性完成 Web UI、Gateway、Scheduler、MCP 和 Plugin。

---

## 1. 当前已实现能力

- Monorepo 工程结构
- CLI 对话入口
- AgentRuntime 核心循环
- PromptBuilder
- ModelProvider 抽象
- MockProvider
- OpenAI-compatible Provider
- ToolRegistry
- FileTool：`list_files`、`read_file`、`write_file`
- ShellTool：`run_shell`，默认禁用，支持白名单和超时
- MemoryStore：读取 `USER.md` 和 `MEMORY.md`
- SkillLoader：按关键词加载 `SKILL.md`
- JsonSessionStore：JSONL 保存会话和工具调用事件
- 详细开发文档

---

## 2. 快速开始

### 2.1 安装依赖

```bash
pnpm install
```

### 2.2 使用 MockProvider 运行 Demo

无需 API Key：

```bash
pnpm demo
```

预期效果：

```text
工具已经执行完成。结果摘要：
{
  "ok": true,
  "content": "file README.md ..."
}
```

### 2.3 启动交互式 CLI

```bash
pnpm dev
```

或者：

```bash
pnpm cli chat
```

退出：

```text
/exit
```

---

## 3. 接入真实模型

当前 Provider 使用 OpenAI Chat Completions 兼容协议，所以可以接入：

- OpenAI
- DeepSeek OpenAI-compatible API
- OpenRouter
- Kimi 兼容网关
- GLM 兼容网关
- 自建 OpenAI-compatible 服务

复制环境变量：

```bash
cp .env.example .env
```

示例：

```env
HERMES_PROVIDER=openai-compatible
HERMES_BASE_URL=https://api.openai.com/v1
HERMES_API_KEY=sk-xxx
HERMES_MODEL=gpt-4o-mini
```

运行：

```bash
pnpm cli chat
```

---

## 4. 项目结构

```text
hermes-agent-starter/
├─ apps/
│  └─ cli/                    # CLI 入口
│
├─ packages/
│  ├─ agent-core/             # AgentRuntime、PromptBuilder、运行时组装
│  ├─ providers/              # 模型 Provider 抽象与实现
│  ├─ tools/                  # ToolRegistry、FileTool、ShellTool
│  ├─ memory/                 # MemoryStore、SessionStore
│  ├─ skills/                 # SkillLoader
│  └─ config/                 # 环境变量配置加载
│
├─ data/
│  ├─ memories/
│  │  ├─ USER.md              # 用户长期偏好
│  │  └─ MEMORY.md            # 项目和 Agent 长期记忆
│  ├─ skills/                 # 可复用技能
│  └─ sessions/               # 运行后生成 JSONL 会话记录
│
├─ workspace/                 # 工具默认可访问工作区
├─ docs/                      # 架构、开发、工具、安全文档
└─ config/                    # 配置模板
```

---

## 5. 核心运行流程

```text
用户输入
  ↓
CLI 标准化请求
  ↓
AgentRuntime.run()
  ↓
PromptBuilder 读取 Memory 和 Skills
  ↓
Provider 调用大模型
  ↓
模型直接回答？
  ├─ 是：保存消息并返回
  └─ 否：解析 tool_call
        ↓
      ToolRegistry.dispatch()
        ↓
      工具结果写回 messages
        ↓
      再次调用模型
```

---

## 6. Tool Calling 设计

每个工具由四部分组成：

```ts
interface Tool {
  name: string
  description: string
  schema: ZodSchema
  execute(args, context): Promise<ToolResult>
}
```

当前内置工具：

| 工具 | 作用 | 默认状态 |
|---|---|---|
| `list_files` | 列出 workspace 文件 | 开启 |
| `read_file` | 读取 workspace 文件 | 开启 |
| `write_file` | 写入 workspace 文件 | 开启 |
| `run_shell` | 执行白名单命令 | 默认关闭 |

Shell 默认关闭。开启方式：

```env
HERMES_ENABLE_SHELL=true
HERMES_ALLOWED_SHELL_COMMANDS=pwd,ls,cat,echo,node,npm,pnpm,git
```

---

## 7. Memory 与 Skills

### 7.1 Memory

`data/memories/USER.md`：用户偏好、沟通风格、常用工具。  
`data/memories/MEMORY.md`：项目背景、Agent 经验、长期工作上下文。

每次会话开始时，PromptBuilder 会读取这两个文件并注入 system prompt。

### 7.2 Skills

每个 Skill 是一个目录：

```text
data/skills/frontend-design/SKILL.md
```

Skill 适合记录“怎么做”，例如：

- 前端页面设计流程
- 代码审查流程
- Playwright 自动化流程
- 文档写作规范

---

## 8. 开发命令

```bash
pnpm install      # 安装依赖
pnpm dev          # 启动 CLI chat
pnpm demo         # MockProvider 工具调用演示
pnpm build        # 编译所有包
pnpm typecheck    # 类型检查
pnpm cli doctor   # 查看运行配置
```

---

## 9. 下一步开发路线

优先级建议：

1. Agent Core 稳定化
2. Provider 适配更多模型
3. 增加 WebSearchTool
4. SessionStore 从 JSONL 升级到 SQLite + FTS5
5. 增加 ContextCompressor
6. 增加 Web UI
7. 增加飞书 / 企业微信 Gateway
8. 增加 Scheduler
9. 增加 MCP Client
10. 增加 Plugin System

详细计划见：

- `docs/DEVELOPMENT_PLAN.md`
- `docs/ARCHITECTURE.md`
- `docs/FLOW.md`
- `docs/SECURITY.md`
