import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { InMemoryHistoryCache } from "./historyCache";

const msg = (content: string): Anthropic.MessageParam => ({
  role: "user",
  content,
});

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
