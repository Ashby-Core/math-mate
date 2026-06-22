import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Problem, StudentProfile } from "@/app/types";
import { updateMasteryCounts } from "@/app/queries/masteries";
import { handleTurn, openSession } from "./conversation";
import { advance, initTutoringState } from "./stateMachine";
import type { JudgeResult } from "./judge";

// updateMasteryCounts is module-imported by the handler (not injected), so mock
// the module to observe completion writes.
vi.mock("@/app/queries/masteries", () => ({ updateMasteryCounts: vi.fn() }));
const mockUpdate = vi.mocked(updateMasteryCounts);

const FRACTIONS = "11111111-1111-1111-1111-111111111111" as UUID;
const DIVISION = "22222222-2222-2222-2222-222222222222" as UUID;
const PROBLEM_ID = "99999999-9999-9999-9999-999999999999" as UUID;

function makeProfile(mastery: number | null): StudentProfile {
  return {
    courseName: "Intro to Fractions",
    student: { id: "student-1", name: "Ada Lovelace" },
    topicMasteryScores: { [FRACTIONS]: { name: "Adding Fractions", mastery } },
    weaknesses: {},
  };
}

function makeProblem(tops: UUID[]): Problem {
  return {
    id: PROBLEM_ID,
    questionContent: "What is 3/4 + 1/8?",
    correctAnswer: "7/8",
    orderIndex: 0,
    tops,
  };
}

// Fake Anthropic client: messages.create returns the canned judge verdict;
// messages.stream returns a sentinel (tests never consume the stream).
function makeDeps(judge: JudgeResult = { isAttempt: false, correct: false }) {
  const create = vi.fn(async () => ({
    content: [{ type: "text", text: JSON.stringify(judge) }],
  }));
  const stream = vi.fn(() => ({ sentinel: "stream" }));
  const anthropic = { messages: { create, stream } } as unknown as Anthropic;
  const inferMisconception = vi.fn(async () => null);
  const supabase = {} as unknown as SupabaseClient;
  return {
    deps: { anthropic, supabase, inferMisconception },
    create,
    stream,
    inferMisconception,
  };
}

const GAP_PROFILE = makeProfile(0.3); // below threshold → one gap
const OK_PROFILE = makeProfile(0.9); // no gap
const PROBLEM = makeProblem([FRACTIONS]);

const gapCheckState = () =>
  advance(initTutoringState(GAP_PROFILE, PROBLEM), { type: "ADVANCE" });
const solveState = () =>
  advance(gapCheckState(), { type: "GAP_ATTEMPT", correct: true });

beforeEach(() => vi.clearAllMocks());

describe("openSession", () => {
  it("streams the greeting without judging, transitioning, or writing", async () => {
    const { deps, create, stream } = makeDeps();
    const state = initTutoringState(GAP_PROFILE, PROBLEM);

    const result = await openSession(deps, {
      profile: GAP_PROFILE,
      problem: PROBLEM,
      state,
    });

    expect(result.state).toBe(state); // unchanged: still intro
    expect(create).not.toHaveBeenCalled(); // no judge
    expect(stream).toHaveBeenCalledTimes(1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("handleTurn — intro", () => {
  it("advances intro → gap_check on the first message (no judge)", async () => {
    const { deps, create, inferMisconception } = makeDeps();
    const result = await handleTurn(deps, {
      profile: GAP_PROFILE,
      problem: PROBLEM,
      state: initTutoringState(GAP_PROFILE, PROBLEM),
      history: [],
      studentMessage: "hi!",
    });

    expect(result.event).toEqual({ type: "ADVANCE" });
    expect(result.state.phase).toBe("gap_check");
    expect(result.judged).toBeNull();
    expect(create).not.toHaveBeenCalled();
    expect(inferMisconception).not.toHaveBeenCalled();
    expect(result.masteryUpdated).toBe(false);
  });

  it("advances intro → solve when there are no gaps", async () => {
    const { deps } = makeDeps();
    const result = await handleTurn(deps, {
      profile: OK_PROFILE,
      problem: PROBLEM,
      state: initTutoringState(OK_PROFILE, PROBLEM),
      history: [],
      studentMessage: "ready",
    });

    expect(result.state.phase).toBe("solve");
  });
});

describe("handleTurn — gap_check", () => {
  it("resolves the gap and unlocks the problem on a correct answer", async () => {
    const { deps, inferMisconception } = makeDeps({ isAttempt: true, correct: true });
    const result = await handleTurn(deps, {
      profile: GAP_PROFILE,
      problem: PROBLEM,
      state: gapCheckState(),
      history: [],
      studentMessage: "3/8",
    });

    expect(result.event).toEqual({ type: "GAP_ATTEMPT", correct: true });
    expect(result.state.phase).toBe("solve"); // single gap resolved
    expect(inferMisconception).not.toHaveBeenCalled();
  });

  it("stays in gap_check and fires MI on a wrong answer", async () => {
    const { deps, inferMisconception } = makeDeps({ isAttempt: true, correct: false });
    const state = gapCheckState();
    const result = await handleTurn(deps, {
      profile: GAP_PROFILE,
      problem: PROBLEM,
      state,
      history: [],
      studentMessage: "1/4",
    });

    expect(result.state).toBe(state); // no-op
    expect(result.misconceptionFired).toBe(true);
    expect(inferMisconception).toHaveBeenCalledTimes(1);
    expect(inferMisconception).toHaveBeenCalledWith(
      expect.objectContaining({ topicId: FRACTIONS, studentAnswer: "1/4" }),
    );
  });

  it("treats a clarifying question as not-an-attempt (no event, no MI)", async () => {
    const { deps, inferMisconception } = makeDeps({ isAttempt: false, correct: false });
    const result = await handleTurn(deps, {
      profile: GAP_PROFILE,
      problem: PROBLEM,
      state: gapCheckState(),
      history: [],
      studentMessage: "what does numerator mean?",
    });

    expect(result.event).toBeNull();
    expect(result.judged).toEqual({ isAttempt: false, correct: false });
    expect(result.state.phase).toBe("gap_check");
    expect(inferMisconception).not.toHaveBeenCalled();
  });
});

describe("handleTurn — solve & completion", () => {
  it("completes the session and updates mastery on a correct answer", async () => {
    const { deps, inferMisconception } = makeDeps({ isAttempt: true, correct: true });
    const state = solveState();
    const result = await handleTurn(deps, {
      profile: GAP_PROFILE,
      problem: PROBLEM,
      state,
      history: [],
      studentMessage: "7/8",
    });

    expect(result.event).toEqual({ type: "SOLVE_ATTEMPT", correct: true });
    expect(result.state.status).toBe("completed");
    expect(result.masteryUpdated).toBe(true);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({}, "student-1", FRACTIONS, true);
    expect(inferMisconception).not.toHaveBeenCalled();
  });

  it("stays in solve and fires MI on a wrong answer", async () => {
    const { deps, inferMisconception } = makeDeps({ isAttempt: true, correct: false });
    const state = solveState();
    const result = await handleTurn(deps, {
      profile: GAP_PROFILE,
      problem: PROBLEM,
      state,
      history: [],
      studentMessage: "1",
    });

    expect(result.state).toBe(state);
    expect(result.misconceptionFired).toBe(true);
    expect(result.masteryUpdated).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("dedupes mastery writes across duplicate problem topics", async () => {
    const dupProblem = makeProblem([FRACTIONS, FRACTIONS]);
    const profile = makeProfile(0.3);
    const state = advance(
      advance(initTutoringState(profile, dupProblem), { type: "ADVANCE" }),
      { type: "GAP_ATTEMPT", correct: true },
    ); // → solve
    const { deps } = makeDeps({ isAttempt: true, correct: true });

    await handleTurn(deps, {
      profile,
      problem: dupProblem,
      state,
      history: [],
      studentMessage: "7/8",
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it("does not re-run mastery when the session is already completed", async () => {
    const { deps } = makeDeps();
    const completed = {
      phase: "review" as const,
      status: "completed" as const,
      gaps: [{ topicId: DIVISION, name: "x", resolved: true }],
    };
    const result = await handleTurn(deps, {
      profile: GAP_PROFILE,
      problem: PROBLEM,
      state: completed,
      history: [],
      studentMessage: "thanks!",
    });

    expect(result.state).toBe(completed); // ADVANCE is a no-op once completed
    expect(result.masteryUpdated).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
