export interface HermesConfig {
  provider: 'mock' | 'openai-compatible';
  model: string;
  baseUrl: string;
  apiKey?: string;
  dataDir: string;
  workspaceDir: string;
  maxIterations: number;
  tools: {
    enableShell: boolean;
    shellTimeoutMs: number;
    allowedShellCommands: string[];
  };
}
