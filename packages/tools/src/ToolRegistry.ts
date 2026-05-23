import { Tool, ToolContext, ToolResult, toOpenAIToolSchema } from './types.js';

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }

  getSchemas() {
    return this.list().map(toOpenAIToolSchema);
  }

  async dispatch(name: string, rawArgs: unknown, context: ToolContext): Promise<ToolResult> {
    const tool = this.get(name);
    if (!tool) {
      return { ok: false, content: `Tool not found: ${name}` };
    }

    const parsed = tool.schema.safeParse(rawArgs);
    if (!parsed.success) {
      return {
        ok: false,
        content: `Invalid arguments for tool ${name}: ${parsed.error.message}`,
      };
    }

    try {
      return await tool.execute(parsed.data, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, content: `Tool ${name} failed: ${message}` };
    }
  }
}
