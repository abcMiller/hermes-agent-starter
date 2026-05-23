# CLAUDE.md - @hermes-clone/tools

This package provides the tool registration and execution system.

## Structure

- `types.ts` - Tool interface, ToolContext, ToolResult, toOpenAIToolSchema()
- `ToolRegistry.ts` - Registers, validates, and dispatches tools
- `FileTool.ts` - list_files, read_file, write_file tools
- `ShellTool.ts` - run_shell tool (opt-in via config)
- `pathSafety.ts` - Resolves paths within workspace boundary

## Tool Interface

```ts
interface Tool<TArgs extends ZodTypeAny> {
  name: string;
  description: string;
  schema: ZodSchema;
  execute(args: z.infer<TArgs>, context: ToolContext): Promise<ToolResult>;
}
```

## ToolContext

Provides execution context:
- `workspaceDir` - Base path for file operations (enforced boundary)
- `dataDir` - Path to data directory
- `signal` - Optional AbortSignal for cancellation

## Built-in Tools

| Tool | Description | Default Status |
|------|-------------|----------------|
| `list_files` | List files in workspace | Enabled |
| `read_file` | Read UTF-8 file (max 256KB) | Enabled |
| `write_file` | Write UTF-8 file (creates dirs) | Enabled |
| `run_shell` | Execute whitelisted shell commands | **Disabled** |

## Adding New Tools

1. Create tool object implementing `Tool` interface
2. Use Zod for argument schema
3. Return `{ ok: boolean, content: string, metadata? }`
4. Register in `createRuntime.ts`:

```ts
tools.register(myNewTool)
```

## Schema Conversion

`toOpenAIToolSchema()` manually converts Zod schema to JSON Schema. Supports primitive types (string, number, boolean, array) and extracts descriptions from Zod defs. For production, consider using `zod-to-json-schema`.

## Path Safety

`resolveInsideWorkspace()` in `pathSafety.ts` ensures file operations cannot escape the workspace directory. All file tools must use this for path resolution.
