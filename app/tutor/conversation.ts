import Anthropic from "@anthropic-ai/sdk";
import { SupabaseClient } from "@supabase/supabase-js";
import { Problem, StudentProfile } from "@/app/types";
import { updateMasteryCounts } from "@/app/queries/masteries";
import { classifyMisconception, matchWeakness } from "@/app/queries/claude";
import {
  getWeaknessesForTopic,
  incrementWeakness,
  insertWeakness,
} from "@/app/queries/weaknesses";
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
  /**
   * The detached classify→dedup→write pipeline's promise, when it fired this
   * turn (null otherwise). Never awaited inline — the route hands it to
   * `after()` so the write lands without blocking the reply stream. Always
   * resolves (never rejects): failures anywhere in the chain are caught and
   * logged inside the pipeline itself.
   */
  misconceptionPromise: Promise<void> | null;
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

/**
 * The tutor's ad-hoc gap-check question, for the misconception classifier —
 * there's no stored version of it (unlike the assignment problem's fixed
 * question/answer), so it's pulled from the last assistant turn in history.
 */
function lastAssistantMessage(history: Anthropic.MessageParam[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    const message = history[i];
    if (message.role === "assistant" && typeof message.content === "string") {
      return message.content;
    }
  }
  return "";
}

/**
 * Classifies a wrong answer, dedups it against the student's existing
 * weaknesses for the topic, and writes the result — insert if novel,
 * increment if it matches. Runs detached from the turn (see handleTurn):
 * callers fire this without awaiting it and stash the returned promise so the
 * reply stream never waits on it.
 */
async function runMisconceptionPipeline(
  deps: ConversationDeps,
  args: {
    studentId: string;
    topicId: string;
    topicName: string;
    question: string;
    correctAnswer: string | null;
    studentAnswer: string;
  },
): Promise<void> {
  const description = await classifyMisconception(
    {
      question: args.question,
      correctAnswer: args.correctAnswer,
      studentAnswer: args.studentAnswer,
      topicId: args.topicId,
      topicName: args.topicName,
    },
    deps.anthropic,
  );
  if (!description) return;

  const existing = await getWeaknessesForTopic(deps.supabase, args.studentId, args.topicId);
  const match = await matchWeakness(existing, description, deps.anthropic);
  // insertWeakness/incrementWeakness already log their own DB error and
  // return null on failure — check that return value here too, so this
  // summary line (the only observability this detached pipeline has) never
  // claims a write succeeded when it silently didn't.
  const written =
    match === "novel"
      ? await insertWeakness(deps.supabase, args.studentId, args.topicId, description)
      : await incrementWeakness(deps.supabase, match.id);

  const outcome = !written
    ? "failed"
    : match === "novel"
      ? "inserted"
      : `incremented(${match.id})`;
  console.log(`[misconception] topic=${args.topicId} result=${outcome}`);
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
  let misconceptionPromise: Promise<void> | null = null;
  if (
    (event?.type === "GAP_ATTEMPT" || event?.type === "SOLVE_ATTEMPT") &&
    !event.correct
  ) {
    const question =
      state.phase === "gap_check"
        ? lastAssistantMessage(history)
        : problem.questionContent;
    // A gap-check question only exists in `history` — there's no stored
    // fallback like there is for the assignment problem. On a history-cache
    // miss (an expected condition; see historyCache.ts) there's nothing to
    // classify against, so skip rather than send Haiku a blank question and
    // risk a confident-sounding misconception from no signal at all.
    if (state.phase !== "gap_check" || question) {
      const topicId =
        state.phase === "gap_check"
          ? (currentGap(state)?.topicId ?? "")
          : (problem.tops[0] ?? "");
      misconceptionFired = true;
      // Detached: never awaited here, so a slow or failing classify→dedup→write
      // chain never delays the reply stream below. The route hands this promise
      // to after() so it still resolves before the request lifecycle ends.
      misconceptionPromise = runMisconceptionPipeline(deps, {
        studentId: profile.student.id,
        topicId,
        topicName: profile.topicMasteryScores[topicId]?.name ?? "",
        question,
        correctAnswer: state.phase === "gap_check" ? null : problem.correctAnswer,
        studentAnswer: studentMessage,
      }).catch((err) => {
        console.error(`[misconception] pipeline failed for topic=${topicId}:`, err);
      });
    }
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
    misconceptionPromise,
    masteryUpdated,
    stream,
  };
}
