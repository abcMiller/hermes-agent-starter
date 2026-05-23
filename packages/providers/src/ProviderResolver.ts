import {
  ModelProvider,
  MockProvider,
  OpenAICompatibleProvider,
  OpenAICompatibleProviderOptions,
  OllamaProvider,
  OllamaProviderOptions,
} from './index.js';
import { HermesConfig } from '@hermes-clone/config';

/**
 * Provider 解析器
 *
 * 根据配置自动创建对应的 Provider 实例
 */
export class ProviderResolver {
  /**
   * 根据 HermesConfig 创建对应的 Provider
   *
   * 支持的 provider 类型：
   * - mock: MockProvider（测试用）
   * - openai-compatible: OpenAICompatibleProvider（OpenAI、DeepSeek、OpenRouter 等）
   * - ollama: OllamaProvider（本地模型）
   *
   * @param config - Hermes 配置
   * @returns 对应的 Provider 实例
   */
  static resolve(config: HermesConfig): ModelProvider {
    switch (config.provider) {
      case 'mock':
        return new MockProvider();

      case 'openai-compatible':
        return new OpenAICompatibleProvider({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          name: this.extractProviderName(config.baseUrl),
          timeout: 60000,
        });

      case 'ollama':
        return new OllamaProvider({
          baseUrl: config.baseUrl || 'http://localhost:11434',
          name: 'ollama',
          timeout: 120000,
        });

      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  /**
   * 从 URL 中提取 Provider 名称
   */
  private static extractProviderName(baseUrl: string): string {
    const url = new URL(baseUrl);
    const hostname = url.hostname;

    // 常见 Provider 的域名映射
    const nameMap: Record<string, string> = {
      'api.openai.com': 'openai',
      'api.deepseek.com': 'deepseek',
      'openrouter.ai': 'openrouter',
      'api.moonshot.cn': 'kimi',
      'open.bigmodel.cn': 'glm',
      'api.anthropic.com': 'anthropic',
    };

    // 查找匹配的域名
    for (const [domain, name] of Object.entries(nameMap)) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return name;
      }
    }

    // 自定义域名，返回 hostname
    return hostname.replace(/\./g, '-');
  }

  /**
   * 获取所有支持的 Provider 类型
   */
  static getSupportedProviders(): string[] {
    return ['mock', 'openai-compatible', 'ollama'];
  }

  /**
   * 验证 Provider 配置是否有效
   */
  static validateConfig(config: HermesConfig): { valid: boolean; error?: string } {
    switch (config.provider) {
      case 'mock':
        return { valid: true };

      case 'openai-compatible':
        if (!config.apiKey) {
          return { valid: false, error: 'HERMES_API_KEY is required for openai-compatible provider' };
        }
        if (!config.baseUrl) {
          return { valid: false, error: 'HERMES_BASE_URL is required for openai-compatible provider' };
        }
        return { valid: true };

      case 'ollama':
        // Ollama 不需要 API key
        return { valid: true };

      default:
        return { valid: false, error: `Unknown provider: ${config.provider}` };
    }
  }

  /**
   * 获取 Provider 配置示例
   */
  static getConfigExamples(): Record<string, { description: string; envVars: Record<string, string> }> {
    return {
      'mock': {
        description: 'Mock Provider - 用于测试和开发，不需要 API Key',
        envVars: {
          'HERMES_PROVIDER': 'mock',
        },
      },
      'openai-compatible': {
        description: 'OpenAI 兼容 API - 支持 OpenAI、DeepSeek、OpenRouter、Kimi、GLM 等',
        envVars: {
          'HERMES_PROVIDER': 'openai-compatible',
          'HERMES_BASE_URL': 'https://api.openai.com/v1',
          'HERMES_API_KEY': 'sk-xxx',
          'HERMES_MODEL': 'gpt-4o-mini',
        },
      },
      'deepseek': {
        description: 'DeepSeek - 高性价比国产大模型',
        envVars: {
          'HERMES_PROVIDER': 'openai-compatible',
          'HERMES_BASE_URL': 'https://api.deepseek.com',
          'HERMES_API_KEY': 'sk-xxx',
          'HERMES_MODEL': 'deepseek-chat',
        },
      },
      'openrouter': {
        description: 'OpenRouter - 聚合多种模型的 API 服务',
        envVars: {
          'HERMES_PROVIDER': 'openai-compatible',
          'HERMES_BASE_URL': 'https://openrouter.ai/api/v1',
          'HERMES_API_KEY': 'sk-or-xxx',
          'HERMES_MODEL': 'anthropic/claude-3-haiku',
        },
      },
      'kimi': {
        description: 'Kimi (Moonshot) - 国产长文本大模型',
        envVars: {
          'HERMES_PROVIDER': 'openai-compatible',
          'HERMES_BASE_URL': 'https://api.moonshot.cn/v1',
          'HERMES_API_KEY': 'sk-xxx',
          'HERMES_MODEL': 'moonshot-v1-8k',
        },
      },
      'glm': {
        description: 'GLM (智谱 AI) - ChatGLM 系列模型',
        envVars: {
          'HERMES_PROVIDER': 'openai-compatible',
          'HERMES_BASE_URL': 'https://open.bigmodel.cn/api/paas/v4',
          'HERMES_API_KEY': 'xxx',
          'HERMES_MODEL': 'glm-4',
        },
      },
      'ollama': {
        description: 'Ollama - 本地运行开源模型（Llama, Mistral, Qwen 等）',
        envVars: {
          'HERMES_PROVIDER': 'ollama',
          'HERMES_BASE_URL': 'http://localhost:11434',
          'HERMES_MODEL': 'llama3:8b',
        },
      },
    };
  }
}
