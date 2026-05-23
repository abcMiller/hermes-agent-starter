/**
 * Hermes Agent 配置接口
 */
export interface HermesConfig {
  /**
   * Provider 类型
   * - mock: Mock Provider（测试用）
   * - openai-compatible: OpenAI 兼容 API（OpenAI、DeepSeek、OpenRouter、Kimi、GLM 等）
   * - ollama: Ollama 本地模型
   */
  provider: 'mock' | 'openai-compatible' | 'ollama';

  /**
   * 模型名称
   * OpenAI: gpt-4o-mini, gpt-4o, etc.
   * DeepSeek: deepseek-chat, deepseek-coder
   * Ollama: llama3, mistral, qwen, etc.
   */
  model: string;

  /**
   * API Base URL
   * OpenAI: https://api.openai.com/v1
   * DeepSeek: https://api.deepseek.com
   * Ollama: http://localhost:11434
   */
  baseUrl: string;

  /**
   * API Key（Ollama 不需要）
   */
  apiKey?: string;

  /**
   * 数据目录路径
   */
  dataDir: string;

  /**
   * 工作区目录路径
   */
  workspaceDir: string;

  /**
   * 最大迭代次数
   */
  maxIterations: number;

  /**
   * 工具配置
   */
  tools: {
    /** 是否启用 Shell 工具 */
    enableShell: boolean;
    /** Shell 命令超时时间（毫秒） */
    shellTimeoutMs: number;
    /** 允许的 Shell 命令白名单 */
    allowedShellCommands: string[];
  };
}
