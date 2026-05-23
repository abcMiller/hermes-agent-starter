import fs from 'node:fs/promises';
import path from 'node:path';
import { ChatMessage } from '@hermes-clone/providers';

export interface SessionEvent {
  timestamp: string;
  type: 'message' | 'tool_call' | 'tool_result' | 'error';
  payload: unknown;
}

export class JsonSessionStore {
  constructor(private dataDir: string) {}

  private sessionFile(sessionId: string): string {
    return path.join(this.dataDir, 'sessions', `${safeId(sessionId)}.jsonl`);
  }

  async append(sessionId: string, event: Omit<SessionEvent, 'timestamp'>): Promise<void> {
    await fs.mkdir(path.join(this.dataDir, 'sessions'), { recursive: true });
    const line = JSON.stringify({ timestamp: new Date().toISOString(), ...event }) + '\n';
    await fs.appendFile(this.sessionFile(sessionId), line, 'utf-8');
  }

  async readMessages(sessionId: string, limit = 30): Promise<ChatMessage[]> {
    try {
      const text = await fs.readFile(this.sessionFile(sessionId), 'utf-8');
      const events = text
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as SessionEvent);
      return events
        .filter((event) => event.type === 'message')
        .map((event) => event.payload as ChatMessage)
        .slice(-limit);
    } catch {
      return [];
    }
  }
}

function safeId(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, '_');
}
