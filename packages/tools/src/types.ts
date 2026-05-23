import { z } from 'zod';
import { ToolSchema } from '@hermes-clone/providers';

export interface ToolContext {
  workspaceDir: string;
  dataDir: string;
  signal?: AbortSignal;
}

export interface ToolResult {
  ok: boolean;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface Tool<TArgs extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  schema: TArgs;
  execute(args: z.infer<TArgs>, context: ToolContext): Promise<ToolResult>;
}

export function toOpenAIToolSchema(tool: Tool): ToolSchema {
  // This starter keeps JSON Schema simple and explicit. For production, use zod-to-json-schema.
  const shape = (tool.schema as any)._def?.shape?.() ?? {};
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const def = (value as any)._def;
    const typeName = def?.typeName;
    let type = 'string';
    if (typeName === 'ZodNumber') type = 'number';
    if (typeName === 'ZodBoolean') type = 'boolean';
    if (typeName === 'ZodArray') type = 'array';
    properties[key] = { type, description: def?.description ?? '' };
    if (!def?.isOptional) required.push(key);
  }

  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties,
        required,
        additionalProperties: false,
      },
    },
  };
}
