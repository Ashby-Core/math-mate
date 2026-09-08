import type Anthropic from "@anthropic-ai/sdk";
import { Redis } from "@upstash/redis";

// Student conversation transcript cache, keyed by session id. Deliberately
// behind an interface: the in-memory implementation here is process-local (so in
// a multi-instance/serverless deploy a miss is common — callers must handle it
// gracefully), and is swapped for a shared Redis-backed implementation later
// with no change to callers. Entries carry an inactivity TTL as a safety net for
// abandoned sessions; completed sessions are deleted explicitly.

const DEFAULT_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

const UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

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

export class RedisHistoryCache implements HistoryCache {
  constructor(private readonly redisClient: Redis, private readonly ttlMs: number = DEFAULT_TTL_MS) {}

  private key(sessionId: string): string {
    return `history:${sessionId}`;
  }

  async get(sessionId: string): Promise<Anthropic.MessageParam[] | null> {
    try {
      const messages = await this.redisClient.get<Anthropic.MessageParam[]>(
        this.key(sessionId),
      );
      return messages ?? null;
    } catch (error) {
      console.error("RedisHistoryCache.get failed", error);
      return null;
    }
  }

  async set(
    sessionId: string,
    messages: Anthropic.MessageParam[],
  ): Promise<void> {
    try {
      await this.redisClient.set(this.key(sessionId), messages, {
        ex: Math.ceil(this.ttlMs / 1000),
      });
    } catch (error) {
      console.error("RedisHistoryCache.set failed", error);
    }
  }

  // Not atomic: a concurrent append to the same key can clobber another's
  // write. Acceptable because the message endpoint only ever has one
  // in-flight turn per session (auth + status === "active" checks serialize
  // turns per session in practice) — the same kind of documented assumption
  // session bootstrap makes about its one known concurrency race (handled
  // there via a DB unique index, not locking). If a real concurrent-append
  // race is ever found, revisit with a Redis list (RPUSH/LRANGE) instead of a
  // JSON blob.
  async append(
    sessionId: string,
    ...messages: Anthropic.MessageParam[]
  ): Promise<void> {
    const existing = (await this.get(sessionId)) ?? [];
    await this.set(sessionId, [...existing, ...messages]);
  }

  async delete(sessionId: string): Promise<void> {
    try {
      await this.redisClient.del(this.key(sessionId));
    } catch (error) {
      console.error("RedisHistoryCache.delete failed", error);
    }
  }
}

/** Process-wide cache singleton used by the API routes. */
export const historyCache: HistoryCache = new InMemoryHistoryCache();

export const redisHistoryCache: HistoryCache = new RedisHistoryCache(new Redis({
  url: UPSTASH_REDIS_URL,
  token: UPSTASH_REDIS_REST_TOKEN,
}));