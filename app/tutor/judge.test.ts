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

/** Pulls the `messages` array out of the first call the mocked `create` received. */
function messagesOf(
  create: ReturnType<typeof vi.fn>,
): Anthropic.MessageParam[] {
  const [params] = create.mock.calls[0] as [Anthropic.MessageCreateParams];
  return params.messages;
}

// NOTE ON COVERAGE: the Anthropic client is mocked, so the *parsed* verdict
// (isAttempt/correct as the model reports them) is whatever the fixture canned
// — these tests can't assert how the model judges math equivalence in the
// wild. What they can and do assert is real behaviour for the one part of
// solve-phase grading that isn't left to the model: the deterministic
// isFinalAttempt gate in judgeTurn (see below), plus that the grading rules
// and tutor's last message reach the model at all.

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
      isFinalAttempt: true,
    });

    expect(result).toEqual({
      isAttempt: true,
      correct: true,
      valueMatchesFinalAnswer: true,
    });
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

  it("grades the solve phase's isAttempt/correct fields by value equivalence to the final answer", async () => {
    const { anthropic, create } = makeAnthropic(
      JSON.stringify({ isAttempt: true, correct: true }),
    );

    await judgeTurn({
      anthropic,
      phase: "solve",
      history: [],
      studentMessage: "6",
      correctAnswer: "8",
      isFinalAttempt: true,
    });

    const system = systemPromptOf(create);
    expect(system).toContain("FINAL answer to the problem is: 8");
    expect(system).toContain(
      "correct: true only if isAttempt AND the value the student gives is mathematically equivalent to the problem's FINAL answer above",
    );
    // Regression guard: isAttempt must stay a broad "did they give an answer at
    // all" check. Framing it as "the final answer, as opposed to a reply to an
    // intermediate sub-question" made the classifier treat every scaffolded
    // reply (even the genuinely final one) as a sub-question reply, so it
    // never fired true and the session could never complete.
    expect(system).not.toContain("as opposed to replying to one of the tutor's intermediate scaffolding sub-questions");
    // The prompt no longer asks the model to guess intermediate-vs-final from
    // conversation context — a live-model eval showed that guess is unreliable
    // even when the tutor names the sub-quantity explicitly. That decision is
    // made deterministically in judgeTurn from isFinalAttempt (see below).
    expect(system).not.toContain("only if the tutor was asking for the final answer");
  });

  it("forwards history and the student's message to the model", async () => {
    const { anthropic, create } = makeAnthropic(
      JSON.stringify({ isAttempt: true, correct: true }),
    );

    const history: Anthropic.MessageParam[] = [
      { role: "assistant", content: "What's 8 * 6?" },
    ];

    await judgeTurn({
      anthropic,
      phase: "solve",
      history,
      studentMessage: "48",
      correctAnswer: "48",
      isFinalAttempt: true,
    });

    expect(messagesOf(create)).toEqual([
      { role: "assistant", content: "What's 8 * 6?" },
      { role: "user", content: "48" },
    ]);
  });

  it("forces correct: false in solve when isFinalAttempt is not set, even if the model reports correct: true", async () => {
    // Reproduces the reported bug: a scaffolding sub-step's value (8 * 6 = 48)
    // coincidentally equals the problem's final answer, and the model grades
    // pure value equivalence as true. Without an explicit isFinalAttempt
    // signal, that must never count as finishing the problem.
    const { anthropic } = makeAnthropic(
      JSON.stringify({ isAttempt: true, correct: true }),
    );

    const result = await judgeTurn({
      anthropic,
      phase: "solve",
      history: [{ role: "assistant", content: "What's 8 * 6?" }],
      studentMessage: "48",
      correctAnswer: "48",
      // isFinalAttempt omitted — the student did not flag this as their
      // overall-answer attempt.
    });

    expect(result).toEqual({
      isAttempt: true,
      correct: false,
      // The raw model verdict survives the gate — this is exactly what the
      // tutor's per-turn prompt uses to nudge toward the toggle instead of
      // guessing the session is over.
      valueMatchesFinalAnswer: true,
    });
  });

  it("does not force correct: false in solve when isFinalAttempt is true", async () => {
    const { anthropic } = makeAnthropic(
      JSON.stringify({ isAttempt: true, correct: true }),
    );

    const result = await judgeTurn({
      anthropic,
      phase: "solve",
      history: [{ role: "assistant", content: "So what's the final answer?" }],
      studentMessage: "48",
      correctAnswer: "48",
      isFinalAttempt: true,
    });

    expect(result).toEqual({
      isAttempt: true,
      correct: true,
      valueMatchesFinalAnswer: true,
    });
  });

  it("still forces correct: false when isFinalAttempt is true but the value doesn't match", async () => {
    const { anthropic } = makeAnthropic(
      JSON.stringify({ isAttempt: true, correct: false }),
    );

    const result = await judgeTurn({
      anthropic,
      phase: "solve",
      history: [],
      studentMessage: "50",
      correctAnswer: "48",
      isFinalAttempt: true,
    });

    // isFinalAttempt only removes the "was this the final question" ambiguity —
    // it never overrides the model's own math-equivalence judgment.
    expect(result).toEqual({
      isAttempt: true,
      correct: false,
      valueMatchesFinalAnswer: false,
    });
  });

  it("never reports valueMatchesFinalAnswer: true for a schema-legal but inconsistent verdict where isAttempt is false", async () => {
    // The JSON schema only validates each field's type, not their
    // relationship — a model could return isAttempt: false, correct: true (a
    // clarifying question that happens to contain the right-looking value).
    // If valueMatchesFinalAnswer leaked true here, the tutor's per-turn prompt
    // would nudge the student to confirm a "final answer" they never gave.
    const { anthropic } = makeAnthropic(
      JSON.stringify({ isAttempt: false, correct: true }),
    );

    const result = await judgeTurn({
      anthropic,
      phase: "solve",
      history: [],
      studentMessage: "wait, is the answer 48 or something else?",
      correctAnswer: "48",
      isFinalAttempt: true,
    });

    expect(result).toEqual({
      isAttempt: false,
      correct: false,
      valueMatchesFinalAnswer: false,
    });
  });

  it("does not apply the solve-only isFinalAttempt gate in gap_check", async () => {
    const { anthropic } = makeAnthropic(
      JSON.stringify({ isAttempt: true, correct: true }),
    );

    const result = await judgeTurn({
      anthropic,
      phase: "gap_check",
      history: [],
      studentMessage: "7/8",
      currentGap: { topicId: "t1", name: "Adding Fractions", resolved: false },
      // isFinalAttempt is solve-only and left unset here; gap_check correctness
      // must not be affected by it either way.
    });

    expect(result).toEqual({ isAttempt: true, correct: true });
    // valueMatchesFinalAnswer is a solve-only concept — gap_check must not set
    // it, since TurnContext only reads it for the solve-phase nudge.
    expect(result.valueMatchesFinalAnswer).toBeUndefined();
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
