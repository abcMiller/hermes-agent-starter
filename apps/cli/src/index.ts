#!/usr/bin/env node
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { Command } from 'commander';
import { loadConfig } from '@hermes-clone/config';
import { createRuntime } from '@hermes-clone/agent-core';
import { ProviderResolver } from '@hermes-clone/providers';
import { ConsoleLogger } from '@hermes-clone/agent-core';

/**
 * 简单的控制台日志（带颜色）
 */
class ColoredLogger extends ConsoleLogger {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.HERMES_DEBUG === 'true') {
      console.debug(`\x1b[90m[DEBUG] ${message}\x1b[0m`, meta ?? '');
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.info(`\x1b[36m[INFO] ${message}\x1b[0m`, meta ?? '');
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`\x1b[33m[WARN] ${message}\x1b[0m`, meta ?? '');
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    console.error(`\x1b[31m[ERROR] ${message}\x1b[0m`, error ?? '', meta ?? '');
  }
}

const program = new Command();
program
  .name('hermes-clone')
  .description('Hermes Agent inspired CLI starter')
  .version('0.1.0');

program.command('chat')
  .description('Start an interactive agent chat')
  .option('-s, --session <id>', 'session id', 'default')
  .option('--once <text>', 'run one prompt and exit')
  .option('--stream', 'enable streaming output')
  .option('--debug', 'enable debug logging')
  .action(async (opts) => {
    const config = loadConfig(process.cwd());
    const logger = new ColoredLogger();

    // 验证配置
    const validation = ProviderResolver.validateConfig(config);
    if (!validation.valid) {
      console.error(`\x1b[31m配置错误: ${validation.error}\x1b[0m`);
      console.log('运行 \x1b[36mhermes-clone providers\x1b[0m 查看支持的 Provider 配置示例');
      process.exit(1);
    }

    if (opts.debug) {
      process.env.HERMES_DEBUG = 'true';
    }

    const runtime = await createRuntime(config, { logger });

    if (opts.once) {
      const result = await runtime.run(
        { sessionId: opts.session, text: opts.once, stream: opts.stream },
        {
          onText: opts.stream ? (text) => process.stdout.write(text) : undefined,
        }
      );

      if (opts.stream) {
        process.stdout.write('\n');
      } else {
        console.log(result.text);
      }

      // 显示 Token 统计
      if (result.usage) {
        console.log(`\n\x1b[90mTokens: ${result.usage.totalTokens} (prompt: ${result.usage.promptTokens}, completion: ${result.usage.completionTokens})\x1b[0m`);
      }
      return;
    }

    console.log('\x1b[1m\x1b[36mHermes Clone Agent CLI\x1b[0m');
    console.log(`Provider: \x1b[33m${config.provider}\x1b[0m | Model: \x1b[33m${config.model}\x1b[0m`);
    if (opts.stream) {
      console.log(`\x1b[32mStreaming: enabled\x1b[0m`);
    }
    console.log('输入 /exit 退出。\n');

    const rl = readline.createInterface({ input, output });
    try {
      while (true) {
        const text = await rl.question('\x1b[1m你 > \x1b[0m');
        if (['/exit', 'exit', 'quit', '/q'].includes(text.trim())) break;
        if (!text.trim()) continue;

        const result = await runtime.run(
          { sessionId: opts.session, text, stream: opts.stream },
          {
            onText: opts.stream ? (chunk) => process.stdout.write(chunk) : undefined,
          }
        );

        if (!opts.stream) {
          console.log(`\n\x1b[1mAgent > \x1b[0m${result.text}\n`);
        } else {
          process.stdout.write('\n\n');
        }

        // 显示 Token 统计
        if (result.usage) {
          console.log(`\x1b[90m迭代: ${result.iterations} | Tokens: ${result.usage.totalTokens} (prompt: ${result.usage.promptTokens}, completion: ${result.usage.completionTokens})\x1b[0m`);
        }
      }
    } finally {
      rl.close();
    }
  });

program.command('doctor')
  .description('Print runtime configuration')
  .action(() => {
    const config = loadConfig(process.cwd());
    const safe = { ...config, apiKey: config.apiKey ? '***' : undefined };
    console.log(JSON.stringify(safe, null, 2));
  });

program.command('health')
  .description('Check provider health')
  .action(async () => {
    const config = loadConfig(process.cwd());

    // 验证配置
    const validation = ProviderResolver.validateConfig(config);
    if (!validation.valid) {
      console.error(`\x1b[31m配置错误: ${validation.error}\x1b[0m`);
      process.exit(1);
    }

    const runtime = await createRuntime(config);

    console.log(`\x1b[1mProvider:\x1b[0m ${config.provider}`);
    console.log(`\x1b[1mModel:\x1b[0m ${config.model}`);
    console.log(`\x1b[1mBase URL:\x1b[0m ${config.baseUrl}`);
    console.log('\nChecking provider health...\n');

    try {
      const result = await runtime.run({ sessionId: '_health', text: 'ping' });
      console.log(`\x1b[32m✓ Provider is healthy\x1b[0m`);
      if (result.usage) {
        console.log(`  Tokens: ${result.usage.totalTokens}`);
      }
    } catch (error) {
      console.log(`\x1b[31m✗ Provider error:\x1b[0m`, error);
      process.exit(1);
    }
  });

program.command('providers')
  .description('List supported providers and configuration examples')
  .option('--detailed', 'show detailed configuration examples')
  .action((opts) => {
    const examples = ProviderResolver.getConfigExamples();

    console.log('\x1b[1m\x1b[36m支持的 Provider:\x1b[0m\n');

    for (const [name, example] of Object.entries(examples)) {
      console.log(`\x1b[1m${name}:\x1b[0m`);
      console.log(`  ${example.description}`);

      if (opts.detailed) {
        console.log(`  \x1b[90m环境变量配置:\x1b[0m`);
        for (const [key, value] of Object.entries(example.envVars)) {
          console.log(`    \x1b[33m${key}\x1b[0m=${value}`);
        }
      }
      console.log('');
    }

    if (!opts.detailed) {
      console.log('使用 \x1b[36m--detailed\x1b[0m 查看详细配置示例\n');
    }
  });

await program.parseAsync();
