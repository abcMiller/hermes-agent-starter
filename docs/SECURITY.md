# 安全设计

## 1. 默认安全策略

- ShellTool 默认关闭
- 文件工具限制在 workspace 内
- 会话日志不应记录 API Key
- 高风险操作需要人工确认
- 工具执行有超时
- Agent Loop 有最大迭代次数

## 2. ShellTool 风险

Shell 是最高风险工具。开启前请确认：

```env
HERMES_ENABLE_SHELL=true
HERMES_ALLOWED_SHELL_COMMANDS=pwd,ls,cat,echo,node,npm,pnpm,git
```

不建议加入：

- rm
- sudo
- curl
- wget
- ssh
- scp
- chmod
- chown

## 3. 文件访问边界

FileTool 只能访问 `HERMES_WORKSPACE_DIR` 下的文件。

例如：

```text
workspace/README.md        允许
../.env                    拒绝
/etc/passwd                拒绝
```

## 4. Provider Key 安全

- API Key 只从环境变量读取
- `doctor` 命令会隐藏 API Key
- 不要把 `.env` 提交到 Git

## 5. Gateway 后续安全要求

- 用户白名单
- 平台签名校验
- 消息限流
- 群聊权限控制
- 敏感工具二次确认

## 6. Plugin 后续安全要求

- 插件权限声明
- 插件默认禁用
- 插件异常隔离
- 插件可审计
