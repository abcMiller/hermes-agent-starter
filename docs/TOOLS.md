# 工具系统说明

## 1. Tool 接口

工具位于 `packages/tools`。

```ts
interface Tool<TArgs extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string
  description: string
  schema: TArgs
  execute(args: z.infer<TArgs>, context: ToolContext): Promise<ToolResult>
}
```

## 2. 新增工具步骤

1. 在 `packages/tools/src` 创建工具文件
2. 定义工具名
3. 定义 Zod schema
4. 实现 execute
5. 在 `createRuntime.ts` 注册工具
6. 写文档和测试

## 3. 工具安全原则

- 路径必须限制在 workspace 内
- Shell 默认关闭
- 高风险命令必须白名单
- 超时必须设置
- 工具错误必须结构化返回
- 不要把 API Key 写入工具结果

## 4. 当前内置工具

### list_files

参数：

```json
{ "path": "." }
```

### read_file

参数：

```json
{ "path": "README.md" }
```

### write_file

参数：

```json
{ "path": "notes/todo.md", "content": "hello" }
```

### run_shell

参数：

```json
{ "command": "ls", "args": ["-la"] }
```

默认关闭。开启：

```env
HERMES_ENABLE_SHELL=true
```
