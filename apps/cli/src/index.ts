#!/usr/bin/env node
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { Command } from 'commander';
import { loadConfig } from '@hermes-clone/config';
import { createRuntime } from '@hermes-clone/agent-core';

const program = new Command();
program
  .name('hermes-clone')
  .description('Hermes Agent inspired CLI starter')
  .version('0.1.0');

program.command('chat')
  .description('Start an interactive agent chat')
  .option('-s, --session <id>', 'session id', 'default')
  .option('--once <text>', 'run one prompt and exit')
  .action(async (opts) => {
    const config = loadConfig(process.cwd());
    const runtime = await createRuntime(config);

    if (opts.once) {
      const result = await runtime.run({ sessionId: opts.session, text: opts.once });
      console.log(result.text);
      return;
    }

    console.log('Hermes Clone Agent CLI');
    console.log(`Provider: ${config.provider} | Model: ${config.model}`);
    console.log('输入 /exit 退出。\n');

    const rl = readline.createInterface({ input, output });
    try {
      while (true) {
        const text = await rl.question('你 > ');
        if (['/exit', 'exit', 'quit', '/q'].includes(text.trim())) break;
        if (!text.trim()) continue;
        const result = await runtime.run({ sessionId: opts.session, text });
        console.log(`\nAgent > ${result.text}\n`);
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

await program.parseAsync();
