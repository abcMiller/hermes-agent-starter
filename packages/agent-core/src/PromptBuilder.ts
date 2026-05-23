import { MemoryStore } from '@hermes-clone/memory';
import { SkillLoader } from '@hermes-clone/skills';

export interface PromptBuilderOptions {
  memory: MemoryStore;
  skills: SkillLoader;
}

export class PromptBuilder {
  constructor(private options: PromptBuilderOptions) {}

  async buildSystemPrompt(userInput: string): Promise<string> {
    const [userMemory, agentMemory, skills] = await Promise.all([
      this.options.memory.readUserMemory(),
      this.options.memory.readAgentMemory(),
      this.options.skills.loadRelevantSkills(userInput),
    ]);

    const skillBlock = skills.length
      ? skills.map((skill) => `## Skill: ${skill.id}\n${skill.content}`).join('\n\n---\n\n')
      : '当前没有匹配到专用 Skill。';

    return [
      '# Hermes Clone Agent System Prompt',
      '',
      '你是一个本地运行的 Agent Runtime，具备工具调用、记忆读取、技能加载和任务执行能力。',
      '你需要遵循以下原则：',
      '- 先理解任务，再决定是否调用工具。',
      '- 工具调用后必须根据工具结果继续推理。',
      '- 不要编造工具结果。',
      '- 对危险操作保持谨慎，必要时请求用户确认。',
      '- 默认使用简洁、清晰的中文回答。',
      '',
      '# USER.md',
      userMemory,
      '',
      '# MEMORY.md',
      agentMemory,
      '',
      '# Loaded Skills',
      skillBlock,
    ].join('\n');
  }
}
