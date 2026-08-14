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
  /**
   * solve only: the student explicitly flagged this message as their attempt
   * at the problem's overall answer (an explicit UI toggle, not inferred from
   * text). Deciding "was this a final answer or an intermediate step" from
   * conversation content alone is unreliable — see `judgeTurn`'s solve gate.
   */
  isFinalAttempt?: boolean;
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
        "true only if isAttempt and the value is mathematically equivalent to the problem's final answer; false otherwise. (In solve, whether this counts as finishing the problem is decided separately from this field — see judgeTurn.)",
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
  // step at a time) before they reach the problem's actual final answer.
  //
  // The two fields mean different things and must not be conflated: isAttempt
  // is a broad "did they give an answer at all" check (a false value suppresses
  // the turn's event entirely), while `correct` decides whether that answer
  // *finished the problem*. Framing isAttempt as "is this the final answer" is
  // a known trap: every message in a scaffold is structurally a reply to
  // whatever the tutor just asked, so that framing swallowed genuine final
  // answers too and the session could never complete.
  //
  // Value equivalence alone is not enough to decide "finished the problem"
  // either — a sub-step can produce a value that coincidentally equals the
  // final answer, and a live-model eval showed the judge cannot reliably tell
  // the two apart from conversation context alone (it inconsistently missed
  // even a clearly named sub-question like "what's 16 / 2?"). So that
  // distinction is NOT this prompt's job: it is decided deterministically in
  // `judgeTurn` from `args.isFinalAttempt`, an explicit signal the student sets
  // via a UI control, not inferred from text. This prompt only judges value
  // equivalence — the simpler, model-appropriate half of the question.
  return `You are a strict grader inside a math tutoring system. The tutor is scaffolding the student step by step toward the final answer of a math problem — this may involve several intermediate sub-questions before the student reaches it.

The correct FINAL answer to the problem is: ${args.correctAnswer ?? "(unknown)"}.

Judge ONLY the student's most recent message:
- isAttempt: is the student giving an answer — a specific value or expression — to whatever question the tutor just asked? A clarifying question, "I don't get it", or off-topic chatter is NOT an attempt.
- correct: true only if isAttempt AND the value the student gives is mathematically equivalent to the problem's FINAL answer above (e.g. 7/8, 0.875, and "seven eighths" are all equal). Judge equivalence only — whether this is actually the student's attempt at the overall final answer, as opposed to an intermediate scaffolding step, is decided separately and is not your concern here.

Respond using the required structured format only.`;
}

/**
 * Classifies the student's latest message for the current phase. Returns
 * `{ isAttempt: false, correct: false }` if the model output can't be parsed,
 * so a flaky judge response never advances the phase or fires the MI pipeline.
 *
 * In solve, a value match is only ever treated as *finishing the problem* when
 * `args.isFinalAttempt` is true. This is enforced here in code, not left to the
 * model's prompt-following: an eval showed the model does not reliably apply an
 * equivalent instruction from text alone. When `isFinalAttempt` is not true,
 * `correct` is forced false regardless of value equivalence — an intermediate
 * step that happens to match the final answer is not evidence the student is
 * done, and it costs one extra scaffold turn, not a wrongly-ended session.
 */
export async function judgeTurn(args: JudgeArgs): Promise<JudgeResult> {
  const response = await args.anthropic.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 128,
    system: judgeSystemPrompt(args),
    messages: [...args.history, { role: "user", content: args.studentMessage }],
    output_config: { format: { type: "json_schema", schema: JUDGE_SCHEMA } },
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) return { isAttempt: false, correct: false };

  try {
    const parsed = JSON.parse(text) as JudgeResult;
    const isAttempt = Boolean(parsed.isAttempt);
    let correct = Boolean(parsed.correct);
    if (args.phase === "solve" && !args.isFinalAttempt) correct = false;
    return { isAttempt, correct };
  } catch {
    return { isAttempt: false, correct: false };
  }
}
