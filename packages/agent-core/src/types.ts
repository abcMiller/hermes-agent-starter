import { ModelProvider } from '@hermes-clone/providers';
import { ToolRegistry } from '@hermes-clone/tools';
import { MemoryStore, JsonSessionStore } from '@hermes-clone/memory';
import { SkillLoader } from '@hermes-clone/skills';
import { HermesConfig } from '@hermes-clone/config';

export interface AgentRuntimeOptions {
  config: HermesConfig;
  provider: ModelProvider;
  tools: ToolRegistry;
  memory: MemoryStore;
  sessions: JsonSessionStore;
  skills: SkillLoader;
}

export interface AgentRunInput {
  sessionId: string;
  text: string;
}

export interface AgentRunResult {
  text: string;
  iterations: number;
}
