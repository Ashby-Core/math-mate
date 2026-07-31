import Anthropic from "@anthropic-ai/sdk";
import { JUDGE_MODEL } from "./constants";
import type { GapEntry, Phase } from "./stateMachine";

// Per-turn correctness judge (TS-3). A cheap Haiku classifier that decides, from
// the conversation so far, whether the student's latest message is an attempt to
// answer the question the tutor posed and, if so, whether it's correct. It runs
// before the (Sonnet) tutor reply so the phase can advance deterministically.

export type JudgeResult = {
  /** Did the student try to answer the tutor's question (vs. ask/chat)? */
  isAttempt: boolean;
  /** If an attempt, is it correct? (math equivalence, not string match) */
  correct: boolean;
};

export type JudgeArgs = {
  anthropic: Anthropic;
  /** The phase whose question is being graded — only "gap_check" or "solve". */
  phase: Extract<Phase, "gap_check" | "solve">;
  /** Conversation so far (prior turns), tutor's last question included. */
  history: Anthropic.MessageParam[];
  studentMessage: string;
  /** The gap being probed, in gap_check. */
  currentGap?: GapEntry | null;
  /** The problem's correct answer, in solve. */
  correctAnswer?: string;
};

const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    isAttempt: {
      type: "boolean",
      description:
        "true if the student's latest message tries to answer the tutor's question; false if it is a question, request for help, or off-topic chatter.",
    },
    correct: {
      type: "boolean",
      description:
        "true only if isAttempt and the answer is mathematically correct; false otherwise.",
    },
  },
  required: ["isAttempt", "correct"],
  additionalProperties: false,
} as const;

function judgeSystemPrompt(args: JudgeArgs): string {
  if (args.phase === "gap_check") {
    return `You are a strict grader inside a math tutoring system. Read the conversation and judge ONLY the student's most recent message against the question the tutor just asked.

The student is answering a follow-up question about the prerequisite topic "${
      args.currentGap?.name ?? "(unknown topic)"
    }".

Decide two things:
- isAttempt: did the student actually try to answer that question? A clarifying question, "I don't get it", or off-topic chatter is NOT an attempt.
- correct: if it is an attempt, is the answer correct? Judge mathematical equivalence, not exact text — e.g. 7/8, 0.875, and "seven eighths" are all equal.

Respond using the required structured format only.`;
  }

  // solve: the tutor scaffolds the student through intermediate sub-questions
  // (e.g. one arithmetic step at a time) before they state the problem's actual
  // final answer. Grade against that final answer specifically — a correct
  // response to an intermediate scaffolding step is not the same as solving the
  // problem, and must not be graded as if it were.
  return `You are a strict grader inside a math tutoring system. The tutor is scaffolding the student step by step toward the final answer of a math problem, asking intermediate sub-questions along the way that are not the problem itself.

The correct FINAL answer to the problem is: ${args.correctAnswer ?? "(unknown)"}.

Judge ONLY the student's most recent message:
- isAttempt: is the student attempting to state the final answer to the problem — as opposed to replying to one of the tutor's intermediate scaffolding sub-questions, asking a clarifying question, or off-topic chatter? A correct reply to an intermediate sub-step is NOT an attempt at the final answer.
- correct: true only if isAttempt AND the stated answer is mathematically equivalent to the final answer above.

Respond using the required structured format only.`;
}

/**
 * Classifies the student's latest message for the current phase. Returns
 * `{ isAttempt: false, correct: false }` if the model output can't be parsed,
 * so a flaky judge response never advances the phase or fires the MI pipeline.
 */
export async function judgeTurn(args: JudgeArgs): Promise<JudgeResult> {
  const response = await args.anthropic.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 128,
    system: judgeSystemPrompt(args),
    messages: [
      ...args.history,
      { role: "user", content: args.studentMessage },
    ],
    output_config: { format: { type: "json_schema", schema: JUDGE_SCHEMA } },
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) return { isAttempt: false, correct: false };

  try {
    const parsed = JSON.parse(text) as JudgeResult;
    return {
      isAttempt: Boolean(parsed.isAttempt),
      correct: Boolean(parsed.correct),
    };
  } catch {
    return { isAttempt: false, correct: false };
  }
}
