import type Anthropic from "@anthropic-ai/sdk";

// Student conversation transcript cache, keyed by session id. Deliberately
// behind an interface: the in-memory implementation here is process-local (so in
// a multi-instance/serverless deploy a miss is common — callers must handle it
// gracefully), and is swapped for a shared Redis-backed implementation later
// with no change to callers. Entries carry an inactivity TTL as a safety net for
// abandoned sessions; completed sessions are deleted explicitly.

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface HistoryCache {
  /** The cached transcript for a session, or null on miss/expiry. */
  get(sessionId: string): Promise<Anthropic.MessageParam[] | null>;
  /** Replace the cached transcript and (re)arm the TTL. */
  set(sessionId: string, messages: Anthropic.MessageParam[]): Promise<void>;
  /** Append messages to the cached transcript (creating it if absent). */
  append(sessionId: string, ...messages: Anthropic.MessageParam[]): Promise<void>;
  /** Drop the cached transcript (e.g. on session completion). */
  delete(sessionId: string): Promise<void>;
}

type Entry = { messages: Anthropic.MessageParam[]; expiresAt: number };

export class InMemoryHistoryCache implements HistoryCache {
  private store = new Map<string, Entry>();

  constructor(private readonly ttlMs: number = DEFAULT_TTL_MS) {}

  async get(sessionId: string): Promise<Anthropic.MessageParam[] | null> {
    const entry = this.store.get(sessionId);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(sessionId);
      return null;
    }
    return entry.messages;
  }

  async set(
    sessionId: string,
    messages: Anthropic.MessageParam[],
  ): Promise<void> {
    this.store.set(sessionId, {
      messages,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  async append(
    sessionId: string,
    ...messages: Anthropic.MessageParam[]
  ): Promise<void> {
    const existing = (await this.get(sessionId)) ?? [];
    await this.set(sessionId, [...existing, ...messages]);
  }

  async delete(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
  }
}

/** Process-wide cache singleton used by the API routes. */
export const historyCache: HistoryCache = new InMemoryHistoryCache();
