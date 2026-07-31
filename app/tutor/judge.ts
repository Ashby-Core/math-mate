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

  // solve: the tutor scaffolds the student step by step (e.g. one arithmetic
  // step at a time) before they reach the problem's actual final answer. Every
  // message in that scaffold is, structurally, "a reply to the tutor's last
  // question" — so isAttempt must stay a broad "did they give an answer at
  // all" check. The distinction that actually matters (an intermediate step
  // vs. the real final answer) is decided entirely by `correct`, via equivalence
  // against the final answer — never by guessing which question prompted it.
  return `You are a strict grader inside a math tutoring system. The tutor is scaffolding the student step by step toward the final answer of a math problem — this may involve several intermediate sub-questions before the student reaches it.

The correct FINAL answer to the problem is: ${args.correctAnswer ?? "(unknown)"}.

Judge ONLY the student's most recent message:
- isAttempt: is the student giving an answer — a specific value or expression — to whatever question the tutor just asked? A clarifying question, "I don't get it", or off-topic chatter is NOT an attempt.
- correct: true only if isAttempt AND the value the student gives is mathematically equivalent to the problem's FINAL answer above — not merely correct for an intermediate scaffolding step. E.g. if the final answer is 8 and the student correctly answers an intermediate step with 6, that is isAttempt: true but correct: false, since 6 is not the final answer.

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
