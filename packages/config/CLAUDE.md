# CLAUDE.md - @hermes-clone/config

This package provides environment-based configuration loading.

## Structure

- `types.ts` - HermesConfig interface definition
- `loadConfig.ts` - Environment variable parsing with type coercion

## Configuration Schema

```ts
interface HermesConfig {
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
```

## Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `HERMES_PROVIDER` | enum | `mock` | `mock` or `openai-compatible` |
| `HERMES_MODEL` | string | `gpt-4o-mini` | Model identifier |
| `HERMES_BASE_URL` | string | `https://api.openai.com/v1` | API endpoint |
| `HERMES_API_KEY` | string | - | API key (optional for mock) |
| `HERMES_DATA_DIR` | path | `./data` | Data directory (absolute path) |
| `HERMES_WORKSPACE_DIR` | path | `./workspace` | Workspace root (absolute path) |
| `HERMES_MAX_ITERATIONS` | int | `8` | Max tool call iterations |
| `HERMES_ENABLE_SHELL` | bool | `false` | Enable shell tool |
| `HERMES_SHELL_TIMEOUT_MS` | int | `15000` | Shell command timeout |
| `HERMES_ALLOWED_SHELL_COMMANDS` | csv | `pwd,ls,cat,...` | Whitelisted commands |

## Type Coercion

- **Boolean**: `envBool()` accepts `1`, `true`, `yes`, `on` (case-insensitive) as true
- **Integer**: `envInt()` parses with `parseInt()`, falls back to default if NaN
- **Paths**: Resolved relative to `cwd()` (or custom base dir passed to `loadConfig()`)

## Usage

```ts
import { loadConfig } from '@hermes-clone/config';

const config = loadConfig(); // Uses process.cwd()
const config = loadConfig('/custom/base');
```

Load via `dotenv/config` (imported at top of `loadConfig.ts`) - ensure `.env` file exists in working directory.
