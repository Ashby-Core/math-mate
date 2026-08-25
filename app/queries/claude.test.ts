import { describe, expect, it, vi } from "vitest";
import type { UUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { classifyMisconception } from "./claude";

// Real Haiku classification. Uses a fake Anthropic client (same pattern as
// judge.test.ts) so no live API calls happen in tests.
describe("classifyMisconception", () => {
  const input = {
    problem: {
      id: "p1" as UUID,
      questionContent: "What is 3/4 + 1/8?",
      correctAnswer: "7/8",
      orderIndex: 0,
      tops: ["t1" as UUID],
    },
    correctAnswer: "7/8",
    studentAnswer: "4/12",
    topicId: "t1",
  };

  function makeAnthropic(responseText: string | null) {
    const create = vi.fn(async () => ({
      content: responseText ? [{ type: "text", text: responseText }] : [],
    }));
    return { anthropic: { messages: { create } } as unknown as Anthropic, create };
  }

  /** Pulls the `messages` array out of the first call the mocked `create` received. */
  function messagesOf(
    create: ReturnType<typeof vi.fn>,
  ): Anthropic.MessageParam[] {
    const [params] = create.mock.calls[0] as [Anthropic.MessageCreateParams];
    return params.messages;
  }

  it("resolves to null for a careless mistake", async () => {
    const { anthropic } = makeAnthropic(
      JSON.stringify({ misconception: null }),
    );

    await expect(classifyMisconception(input, anthropic)).resolves.toBeNull();
  });

  it("resolves to a truncated string for a genuine misconception", async () => {
    const long =
      "adds numerators and denominators separately instead of finding a common denominator first, every single time";
    const { anthropic } = makeAnthropic(
      JSON.stringify({ misconception: long }),
    );

    const result = await classifyMisconception(input, anthropic);
    expect(result).toBe(long.slice(0, 100));
    expect(result?.length).toBeLessThanOrEqual(100);
  });

  it("resolves to null on malformed JSON", async () => {
    const { anthropic } = makeAnthropic("not json");

    await expect(classifyMisconception(input, anthropic)).resolves.toBeNull();
  });

  it("resolves to null when no text block is returned", async () => {
    const { anthropic } = makeAnthropic(null);

    await expect(classifyMisconception(input, anthropic)).resolves.toBeNull();
  });

  it("resolves to null instead of throwing when the API call itself fails", async () => {
    const create = vi.fn(async () => {
      throw new Error("rate limited");
    });
    const anthropic = { messages: { create } } as unknown as Anthropic;

    await expect(classifyMisconception(input, anthropic)).resolves.toBeNull();
  });

  it("sends the problem and both values to the model", async () => {
    const { anthropic, create } = makeAnthropic(
      JSON.stringify({ misconception: null }),
    );

    await classifyMisconception(input, anthropic);

    const [message] = messagesOf(create);
    expect(message.content).toContain("What is 3/4 + 1/8?");
    expect(message.content).toContain("7/8");
    expect(message.content).toContain("4/12");
  });
});
