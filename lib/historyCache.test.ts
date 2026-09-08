import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import type { Redis } from "@upstash/redis";
import { InMemoryHistoryCache, RedisHistoryCache } from "./historyCache";

const msg = (content: string): Anthropic.MessageParam => ({
  role: "user",
  content,
});

/** Fake covering only the Upstash methods RedisHistoryCache actually calls. */
class FakeUpstashRedis {
  private store = new Map<string, { value: unknown; expiresAt: number | null }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(
    key: string,
    value: unknown,
    opts?: { ex?: number },
  ): Promise<"OK"> {
    this.store.set(key, {
      value,
      expiresAt: opts?.ex ? Date.now() + opts.ex * 1000 : null,
    });
    return "OK";
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }
}

describe("InMemoryHistoryCache", () => {
  it("returns null on a miss", async () => {
    const cache = new InMemoryHistoryCache();
    expect(await cache.get("nope")).toBeNull();
  });

  it("round-trips set → get", async () => {
    const cache = new InMemoryHistoryCache();
    await cache.set("s1", [msg("hi")]);
    expect(await cache.get("s1")).toEqual([msg("hi")]);
  });

  it("append creates then extends the transcript", async () => {
    const cache = new InMemoryHistoryCache();
    await cache.append("s1", msg("a"));
    await cache.append("s1", msg("b"), msg("c"));
    expect(await cache.get("s1")).toEqual([msg("a"), msg("b"), msg("c")]);
  });

  it("delete drops the entry", async () => {
    const cache = new InMemoryHistoryCache();
    await cache.set("s1", [msg("hi")]);
    await cache.delete("s1");
    expect(await cache.get("s1")).toBeNull();
  });

  it("expires entries after the TTL", async () => {
    vi.useFakeTimers();
    try {
      const cache = new InMemoryHistoryCache(1000);
      await cache.set("s1", [msg("hi")]);

      vi.advanceTimersByTime(999);
      expect(await cache.get("s1")).toEqual([msg("hi")]); // still alive

      vi.advanceTimersByTime(2);
      expect(await cache.get("s1")).toBeNull(); // expired
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("RedisHistoryCache", () => {
  it("returns null on a miss", async () => {
    const cache = new RedisHistoryCache(new FakeUpstashRedis() as unknown as Redis);
    expect(await cache.get("nope")).toBeNull();
  });

  it("round-trips set → get", async () => {
    const cache = new RedisHistoryCache(new FakeUpstashRedis() as unknown as Redis);
    await cache.set("s1", [msg("hi")]);
    expect(await cache.get("s1")).toEqual([msg("hi")]);
  });

  it("append creates then extends the transcript", async () => {
    const cache = new RedisHistoryCache(new FakeUpstashRedis() as unknown as Redis);
    await cache.append("s1", msg("a"));
    await cache.append("s1", msg("b"), msg("c"));
    expect(await cache.get("s1")).toEqual([msg("a"), msg("b"), msg("c")]);
  });

  it("delete drops the entry", async () => {
    const cache = new RedisHistoryCache(new FakeUpstashRedis() as unknown as Redis);
    await cache.set("s1", [msg("hi")]);
    await cache.delete("s1");
    expect(await cache.get("s1")).toBeNull();
  });

  it("expires entries after the TTL", async () => {
    vi.useFakeTimers();
    try {
      const cache = new RedisHistoryCache(
        new FakeUpstashRedis() as unknown as Redis,
        1000,
      );
      await cache.set("s1", [msg("hi")]);

      vi.advanceTimersByTime(999);
      expect(await cache.get("s1")).toEqual([msg("hi")]); // still alive

      vi.advanceTimersByTime(2);
      expect(await cache.get("s1")).toBeNull(); // expired
    } finally {
      vi.useRealTimers();
    }
  });

  it("swallows client errors and returns null/void instead of throwing", async () => {
    const errorClient = {
      get: vi.fn().mockRejectedValue(new Error("redis down")),
      set: vi.fn().mockRejectedValue(new Error("redis down")),
      del: vi.fn().mockRejectedValue(new Error("redis down")),
    };
    const cache = new RedisHistoryCache(errorClient as unknown as Redis);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(cache.get("s1")).resolves.toBeNull();
    await expect(cache.set("s1", [msg("hi")])).resolves.toBeUndefined();
    await expect(cache.delete("s1")).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledTimes(3);

    consoleError.mockRestore();
  });
});

describe.skipIf(!process.env.UPSTASH_REDIS_REST_URL)(
  "RedisHistoryCache — live smoke test",
  () => {
    // Manual "does this actually work" check against a real Upstash instance.
    // Not run in CI: gated on real (disposable/test) credentials being present.
    it("round-trips against the real Upstash instance", async () => {
      const { Redis } = await import("@upstash/redis");
      const client = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      const cache = new RedisHistoryCache(client);
      const sessionId = `test-smoke-${Date.now()}`;

      try {
        expect(await cache.get(sessionId)).toBeNull();
        await cache.set(sessionId, [msg("hi")]);
        expect(await cache.get(sessionId)).toEqual([msg("hi")]);
        await cache.append(sessionId, msg("again"));
        expect(await cache.get(sessionId)).toEqual([msg("hi"), msg("again")]);
      } finally {
        await cache.delete(sessionId);
      }
    });
  },
);
