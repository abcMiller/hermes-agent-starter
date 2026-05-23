# 流程图说明

当前文档提供纯文本流程图，避免 Mermaid 在部分环境无法渲染。

## 1. 主流程

```text
用户输入
  ↓
CLI 接收输入
  ↓
创建或复用 sessionId
  ↓
AgentRuntime.run(input)
  ↓
读取 Session 历史
  ↓
PromptBuilder 构建 system prompt
  ↓
Provider.chat(messages, tools)
  ↓
判断模型响应
  ├─ 普通文本：保存 assistant message，返回用户
  └─ tool_calls：进入工具调用流程
```

## 2. 工具调用流程

```text
模型返回 tool_calls
  ↓
AgentRuntime 保存 assistant tool_call 消息
  ↓
遍历每个 tool_call
  ↓
ToolRegistry 查找工具
  ↓
Zod 校验参数
  ↓
执行 tool.execute(args, context)
  ↓
返回 ToolResult
  ↓
写入 tool message
  ↓
再次调用模型
```

## 3. Memory 注入流程

```text
会话开始
  ↓
读取 USER.md
  ↓
读取 MEMORY.md
  ↓
拼接进 system prompt
  ↓
模型在回答时使用长期上下文
```

## 4. Skill 加载流程

```text
用户输入
  ↓
SkillLoader 扫描 data/skills
  ↓
按关键词匹配 SKILL.md
  ↓
最多加载 3 个 Skill
  ↓
注入 system prompt
  ↓
Agent 按 Skill 中的流程执行任务
```

## 5. 防止死循环

```text
Agent Loop
  ↓
每次模型调用 iteration + 1
  ↓
如果 iteration > HERMES_MAX_ITERATIONS
  ↓
停止执行并返回错误
```
