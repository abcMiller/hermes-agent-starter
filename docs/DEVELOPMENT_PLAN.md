# 开发计划

## Phase 0：项目初始化

当前已完成：

- Monorepo
- TypeScript
- CLI
- Provider 抽象
- Agent Core
- Tools
- Memory
- Skills
- 文档

## Phase 1：Agent Core 稳定化

目标：让核心对话循环稳定可靠。

任务：

1. 增加流式输出
2. 增加更完整的错误类型
3. 增加 retry / timeout
4. 增加模型响应日志
5. 增加上下文窗口统计
6. 增加 max tool calls 限制

验收标准：

- Provider 异常不会导致进程崩溃
- 工具失败能返回给模型继续处理
- Agent 不会无限循环调用工具

## Phase 2：Provider 扩展

目标：支持更多低成本大模型 API。

任务：

1. DeepSeek Provider 配置示例
2. OpenRouter 配置示例
3. GLM 配置示例
4. Kimi 配置示例
5. Ollama 本地模型 Provider
6. ProviderResolver

验收标准：

- 通过配置切换 Provider
- 所有 Provider 转换成统一 ModelChatResult

## Phase 3：Tool System 增强

任务：

1. WebSearchTool
2. HttpRequestTool
3. CodeExecutionTool
4. PatchFileTool
5. Tool 权限策略
6. Tool 调用审计日志

验收标准：

- 每个工具有 schema
- 每个工具有测试
- 高风险工具默认关闭

## Phase 4：Memory 升级

任务：

1. JSONL SessionStore 升级 SQLite
2. 增加 FTS5 全文搜索
3. 增加会话摘要
4. 增加 Memory 写入候选机制
5. 增加人工确认写入长期记忆

验收标准：

- 可以搜索历史会话
- 记忆不会被自动污染

## Phase 5：Skill System 增强

任务：

1. Skill 元数据 frontmatter
2. SkillSearch 排序
3. SkillWriter 自动生成技能草稿
4. SkillImprover 改进已有技能
5. Skill 测试样例

验收标准：

- Agent 可以自动选择合适 Skill
- 新 Skill 可以被持续沉淀

## Phase 6：Web UI

任务：

1. Web Chat
2. 会话列表
3. 工具调用可视化
4. Memory 编辑器
5. Skill 浏览器
6. 模型切换

## Phase 7：Gateway

优先接入：

1. 飞书
2. 企业微信
3. Telegram
4. Email

核心任务：

- PlatformAdapter
- GatewayRunner
- 用户身份映射
- session_key 路由
- 消息限流

## Phase 8：Scheduler

任务：

1. JobStore
2. Cron parser
3. JobRunner
4. 执行日志
5. 失败重试
6. 通知渠道

## Phase 9：MCP / Plugin

任务：

1. MCP Client
2. MCP 工具发现
3. 插件目录加载
4. 权限声明
5. 插件沙箱

## 推荐开发顺序

```text
Agent Core
  ↓
Provider
  ↓
ToolRegistry
  ↓
Memory
  ↓
Skills
  ↓
Web UI
  ↓
Gateway
  ↓
Scheduler
  ↓
MCP / Plugin
```
