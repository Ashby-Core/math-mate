import { describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { classifyMisconception, MisconceptionInput } from "./claude";

// Real Haiku classification. Uses a fake Anthropic client (same pattern as
// judge.test.ts) so no live API calls happen in tests.
describe("classifyMisconception", () => {
  const input: MisconceptionInput = {
    question: "What is 3/4 + 1/8?",
    correctAnswer: "7/8",
    studentAnswer: "4/12",
    topicId: "t1",
    topicName: "Adding Fractions",
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

  it("resolves to null instead of throwing when the API call itself fails, and logs it", async () => {
    const create = vi.fn(async () => {
      throw new Error("rate limited");
    });
    const anthropic = { messages: { create } } as unknown as Anthropic;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(classifyMisconception(input, anthropic)).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });

  it("sends the topic, question, and both values to the model", async () => {
    const { anthropic, create } = makeAnthropic(
      JSON.stringify({ misconception: null }),
    );

    await classifyMisconception(input, anthropic);

    const [message] = messagesOf(create);
    expect(message.content).toContain("Adding Fractions");
    expect(message.content).toContain("What is 3/4 + 1/8?");
    expect(message.content).toContain("7/8");
    expect(message.content).toContain("4/12");
  });

  it("classifies against topicName and the model's own knowledge when correctAnswer is null (a gap-check attempt)", async () => {
    // A gap-check question is invented by the tutor on the fly and has no
    // stored correct answer — this is what conversation.ts passes for a wrong
    // GAP_ATTEMPT, distinct from a solve attempt's fixed problem answer.
    const gapCheckInput: MisconceptionInput = {
      question: "What is 1/2 + 1/4?",
      correctAnswer: null,
      studentAnswer: "2/6",
      topicId: "t1",
      topicName: "Adding Fractions",
    };
    const { anthropic, create } = makeAnthropic(
      JSON.stringify({ misconception: "adds denominators together" }),
    );

    const result = await classifyMisconception(gapCheckInput, anthropic);

    expect(result).toBe("adds denominators together");
    const [message] = messagesOf(create);
    expect(message.content).toContain("What is 1/2 + 1/4?");
    expect(message.content).not.toContain("What is 3/4 + 1/8?"); // never the assignment problem
    expect(message.content).toContain(
      "not given — use your own knowledge of the topic",
    );
  });
});
