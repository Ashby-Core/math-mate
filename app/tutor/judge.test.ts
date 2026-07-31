import { describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { judgeTurn } from "./judge";

function makeAnthropic(responseText: string | null) {
  const create = vi.fn(async () => ({
    content: responseText ? [{ type: "text", text: responseText }] : [],
  }));
  return { anthropic: { messages: { create } } as unknown as Anthropic, create };
}

/** Pulls the `system` prompt out of the first call the mocked `create` received. */
function systemPromptOf(create: ReturnType<typeof vi.fn>): string {
  const [params] = create.mock.calls[0] as [Anthropic.MessageCreateParams];
  return params.system as string;
}

describe("judgeTurn", () => {
  it("returns the parsed verdict on a well-formed response", async () => {
    const { anthropic } = makeAnthropic(
      JSON.stringify({ isAttempt: true, correct: true }),
    );

    const result = await judgeTurn({
      anthropic,
      phase: "solve",
      history: [],
      studentMessage: "8",
      correctAnswer: "8",
    });

    expect(result).toEqual({ isAttempt: true, correct: true });
  });

  it("falls back to a non-advancing verdict on malformed JSON", async () => {
    const { anthropic } = makeAnthropic("not json");

    const result = await judgeTurn({
      anthropic,
      phase: "solve",
      history: [],
      studentMessage: "8",
      correctAnswer: "8",
    });

    expect(result).toEqual({ isAttempt: false, correct: false });
  });

  it("falls back to a non-advancing verdict when no text block is returned", async () => {
    const { anthropic } = makeAnthropic(null);

    const result = await judgeTurn({
      anthropic,
      phase: "solve",
      history: [],
      studentMessage: "8",
      correctAnswer: "8",
    });

    expect(result).toEqual({ isAttempt: false, correct: false });
  });

  it("grades the solve phase against the final answer, not an intermediate scaffolding step", async () => {
    const { anthropic, create } = makeAnthropic(
      JSON.stringify({ isAttempt: true, correct: true }),
    );

    await judgeTurn({
      anthropic,
      phase: "solve",
      history: [],
      studentMessage: "6",
      correctAnswer: "8",
    });

    const system = systemPromptOf(create);
    expect(system).toContain("FINAL answer to the problem is: 8");
    expect(system).toContain("intermediate sub-step is NOT an attempt at the final answer");
    // The prior wording graded against "the question the tutor just asked",
    // which conflated a correct scaffolding step with solving the problem.
    expect(system).not.toContain("judge ONLY the student's most recent message against the question the tutor just asked");
  });

  it("grades the gap_check phase against the named prerequisite topic", async () => {
    const { anthropic, create } = makeAnthropic(
      JSON.stringify({ isAttempt: true, correct: true }),
    );

    await judgeTurn({
      anthropic,
      phase: "gap_check",
      history: [],
      studentMessage: "7/8",
      currentGap: { topicId: "t1", name: "Adding Fractions", resolved: false },
    });

    const system = systemPromptOf(create);
    expect(system).toContain('"Adding Fractions"');
  });
});
