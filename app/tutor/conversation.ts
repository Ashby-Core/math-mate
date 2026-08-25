import Anthropic from "@anthropic-ai/sdk";
import { SupabaseClient } from "@supabase/supabase-js";
import { Problem, StudentProfile } from "@/app/types";
import { updateMasteryCounts } from "@/app/queries/masteries";
import { classifyMisconception } from "@/app/queries/claude";
import { TUTOR_MODEL } from "./constants";
import { buildSystemPrompt, TurnContext } from "./systemPrompt";
import { judgeTurn, JudgeResult } from "./judge";
import { advance, currentGap, TutoringEvent, TutoringState } from "./stateMachine";

// The per-turn conversation handler. Ties the system prompt and
// the phase state machine to live Claude calls: judge the student's
// message, advance the phase deterministically, fire the misconception
// pipeline on wrong answers, write live mastery updates, and stream the Sonnet
// reply. Dependencies are injected so the handler is unit-testable with mocks.

/** Bounded so a non-streaming caller can't hit an HTTP timeout; a cost guard. */
const REPLY_MAX_TOKENS = 1024;

/**
 * Seed user message for the opening turn. The Messages API can't start with an
 * assistant turn, so the unprompted greeting answers this synthetic message. The
 * caller persists `[seed, greeting]` as the opening history so later turns keep
 * the required user-first alternation.
 */
export const SESSION_SEED_MESSAGE = "Hi! I'm ready to start.";

type ReplyStream = ReturnType<Anthropic["messages"]["stream"]>;

export type ConversationDeps = {
  anthropic: Anthropic;
  supabase: SupabaseClient;
};

export type HandleTurnResult = {
  /** State after this turn (resolved before the stream is consumed). */
  state: TutoringState;
  /** The event dispatched, or null when the message wasn't an answer attempt. */
  event: TutoringEvent | null;
  /** The judge verdict, or null for intro/review turns (no judging). */
  judged: JudgeResult | null;
  /** Whether the MI pipeline was invoked (on a wrong answer). */
  misconceptionFired: boolean;
  /** Whether a mastery write ran this turn (a gap attempt, or the session's first solve attempt). */
  masteryUpdated: boolean;
  /** The streamed tutor reply (also exposes `.finalMessage()`). */
  stream: ReplyStream;
};

/** Builds the per-turn prompt context from the (post-transition) state. */
function turnContext(
  state: TutoringState,
  valueMatchesFinalAnswer?: boolean,
): TurnContext {
  return {
    phase: state.phase,
    currentGap: currentGap(state),
    resolvedCount: state.gaps.filter((g) => g.resolved).length,
    totalGaps: state.gaps.length,
    valueMatchesFinalAnswer,
  };
}

function streamReply(
  deps: ConversationDeps,
  profile: StudentProfile,
  problem: Problem,
  turn: TurnContext,
  history: Anthropic.MessageParam[],
  studentMessage: string,
): ReplyStream {
  return deps.anthropic.messages.stream({
    model: TUTOR_MODEL,
    max_tokens: REPLY_MAX_TOKENS,
    system: buildSystemPrompt(profile, problem, turn),
    messages: [...history, { role: "user", content: studentMessage }],
  });
}

/**
 * Opens a session: streams the Intro greeting against a synthetic seed message.
 * No judging, no state change — the session stays in `intro` until the student's
 * first real message drives `handleTurn`.
 */
export async function openSession(
  deps: ConversationDeps,
  args: { profile: StudentProfile; problem: Problem; state: TutoringState },
): Promise<{ state: TutoringState; stream: ReplyStream }> {
  const stream = streamReply(
    deps,
    args.profile,
    args.problem,
    turnContext(args.state),
    [],
    SESSION_SEED_MESSAGE,
  );
  return { state: args.state, stream };
}

/**
 * Processes one student turn: judge → advance → side effects → stream reply.
 * State and side effects are fully resolved before returning; the stream is only
 * the user-facing reply and never affects state.
 */
export async function handleTurn(
  deps: ConversationDeps,
  args: {
    profile: StudentProfile;
    problem: Problem;
    state: TutoringState;
    history: Anthropic.MessageParam[];
    studentMessage: string;
    /** solve only: student flagged this message as their final-answer attempt. */
    isFinalAttempt?: boolean;
  },
): Promise<HandleTurnResult> {
  const { profile, problem, state, history, studentMessage, isFinalAttempt } = args;

  // 1. Derive the transition event for this phase (judging only where needed).
  let event: TutoringEvent | null = null;
  let judged: JudgeResult | null = null;

  if (state.phase === "intro" || state.phase === "review") {
    event = { type: "ADVANCE" };
  } else if (state.phase === "gap_check") {
    judged = await judgeTurn({
      anthropic: deps.anthropic,
      phase: "gap_check",
      history,
      studentMessage,
      currentGap: currentGap(state),
    });
    if (judged.isAttempt)
      event = { type: "GAP_ATTEMPT", correct: judged.correct };
  } else if (state.phase === "solve") {
    judged = await judgeTurn({
      anthropic: deps.anthropic,
      phase: "solve",
      history,
      studentMessage,
      correctAnswer: problem.correctAnswer,
      isFinalAttempt,
    });
    if (judged.isAttempt)
      event = { type: "SOLVE_ATTEMPT", correct: judged.correct };
  }

  // 2. Advance the state machine. A correct solve answer collapses
  //    solve→review→completed in this one turn ("recap completes the session").
  let newState = event ? advance(state, event) : state;
  if (
    event?.type === "SOLVE_ATTEMPT" &&
    event.correct &&
    newState.phase === "review"
  ) {
    newState = advance(newState, { type: "ADVANCE" });
  }

  // 3. Side effects.
  let misconceptionFired = false;
  if (
    (event?.type === "GAP_ATTEMPT" || event?.type === "SOLVE_ATTEMPT") &&
    !event.correct
  ) {
    const topicId =
      state.phase === "gap_check"
        ? (currentGap(state)?.topicId ?? "")
        : (problem.tops[0] ?? "");
    await classifyMisconception(
      {
        problem,
        correctAnswer: problem.correctAnswer,
        studentAnswer: studentMessage,
        topicId,
      },
      deps.anthropic,
    );
    misconceptionFired = true;
  }

  // Mastery writes are live per-turn, not deferred to completion (TS-5):
  // - gap_check: every judged GAP_ATTEMPT is a real single-topic data point,
  //   correct or not — the tutor's follow-up question is still meaningful.
  // - solve: SOLVE_ATTEMPT is graded against the problem's fixed final answer
  //   regardless of what the tutor actually asked, so a correct intermediate
  //   scaffolding step is guaranteed `correct: false` by design — that's judge
  //   noise, not a real gap. Write once, on the first judged attempt of the
  //   session (whatever its correctness), then suppress further writes.
  let masteryUpdated = false;
  if (event?.type === "GAP_ATTEMPT") {
    const topicId = currentGap(state)?.topicId;
    if (topicId) {
      await updateMasteryCounts(
        deps.supabase,
        profile.student.id,
        topicId,
        event.correct,
      );
      masteryUpdated = true;
    }
  } else if (event?.type === "SOLVE_ATTEMPT" && !state.solveAttemptRecorded) {
    for (const topicId of new Set(problem.tops)) {
      await updateMasteryCounts(
        deps.supabase,
        profile.student.id,
        topicId,
        event.correct,
      );
    }
    newState = { ...newState, solveAttemptRecorded: true };
    masteryUpdated = true;
  }

  // 4. Stream the tutor reply, framed for the post-transition phase.
  const stream = streamReply(
    deps,
    profile,
    problem,
    turnContext(newState, judged?.valueMatchesFinalAnswer),
    history,
    studentMessage,
  );

  return {
    state: newState,
    event,
    judged,
    misconceptionFired,
    masteryUpdated,
    stream,
  };
}
