import { describe, expect, it } from "vitest";
import type { UUID } from "crypto";
import { Problem, StudentProfile } from "@/app/types";
import {
  advance,
  canApply,
  computeGaps,
  currentGap,
  fromPersisted,
  initTutoringState,
  isComplete,
  isProblemUnlocked,
  toPersisted,
  type TutoringState,
} from "./stateMachine";

const FRACTIONS = "11111111-1111-1111-1111-111111111111" as UUID;
const DIVISION = "22222222-2222-2222-2222-222222222222" as UUID;
const DECIMALS = "33333333-3333-3333-3333-333333333333" as UUID;
const MISSING = "44444444-4444-4444-4444-444444444444" as UUID;
const PROBLEM_ID = "99999999-9999-9999-9999-999999999999" as UUID;

function makeProblem(tops: UUID[]): Problem {
  return {
    id: PROBLEM_ID,
    questionContent: "What is 3/4 + 1/8?",
    correctAnswer: "7/8",
    orderIndex: 0,
    tops,
  };
}

// Two gaps (0.3, 0.5), one OK (0.9), one unassessed (null).
function fullProfile(): StudentProfile {
  return {
    courseName: "Intro to Fractions",
    student: { id: "student-1", name: "Ada Lovelace" },
    topicMasteryScores: {
      [FRACTIONS]: { name: "Adding Fractions", mastery: 0.3 },
      [DIVISION]: { name: "Long Division", mastery: 0.9 },
      [DECIMALS]: { name: "Decimals", mastery: null },
    },
    weaknesses: {},
  };
}

describe("computeGaps", () => {
  it("keeps only below-threshold topics, in tops order", () => {
    const profile: StudentProfile = {
      ...fullProfile(),
      topicMasteryScores: {
        [DIVISION]: { name: "Long Division", mastery: 0.5 },
        [FRACTIONS]: { name: "Adding Fractions", mastery: 0.3 },
      },
    };
    // tops order is DIVISION, then FRACTIONS — gaps must preserve that.
    const gaps = computeGaps(profile, makeProblem([DIVISION, FRACTIONS]));
    expect(gaps.map((g) => g.topicId)).toEqual([DIVISION, FRACTIONS]);
    expect(gaps.every((g) => !g.resolved)).toBe(true);
  });

  it("excludes OK, unassessed (null), and missing-from-profile topics", () => {
    const gaps = computeGaps(
      fullProfile(),
      makeProblem([FRACTIONS, DIVISION, DECIMALS, MISSING]),
    );
    expect(gaps.map((g) => g.topicId)).toEqual([FRACTIONS]);
  });

  it("dedupes duplicate topic ids", () => {
    const gaps = computeGaps(fullProfile(), makeProblem([FRACTIONS, FRACTIONS]));
    expect(gaps).toHaveLength(1);
  });
});

describe("advance — happy path", () => {
  it("runs intro → gap_check → solve → review → completed with one gap", () => {
    const profile: StudentProfile = {
      ...fullProfile(),
      topicMasteryScores: { [FRACTIONS]: { name: "Adding Fractions", mastery: 0.3 } },
    };
    let state = initTutoringState(profile, makeProblem([FRACTIONS]));
    expect(state.phase).toBe("intro");
    expect(isProblemUnlocked(state)).toBe(false);

    state = advance(state, { type: "ADVANCE" });
    expect(state.phase).toBe("gap_check");
    expect(currentGap(state)?.topicId).toBe(FRACTIONS);
    expect(isProblemUnlocked(state)).toBe(false);

    state = advance(state, { type: "GAP_ATTEMPT", correct: true });
    expect(state.phase).toBe("solve");
    expect(currentGap(state)).toBeNull();
    expect(isProblemUnlocked(state)).toBe(true);

    state = advance(state, { type: "SOLVE_ATTEMPT", correct: true });
    expect(state.phase).toBe("review");

    state = advance(state, { type: "ADVANCE" });
    expect(state.status).toBe("completed");
    expect(isComplete(state)).toBe(true);
  });

  it("skips gap_check straight to solve when there are no gaps", () => {
    const profile: StudentProfile = {
      ...fullProfile(),
      topicMasteryScores: { [DIVISION]: { name: "Long Division", mastery: 0.9 } },
    };
    let state = initTutoringState(profile, makeProblem([DIVISION]));
    expect(state.gaps).toHaveLength(0);

    state = advance(state, { type: "ADVANCE" });
    expect(state.phase).toBe("solve");
    expect(isProblemUnlocked(state)).toBe(true);
  });

  it("resolves multiple gaps one at a time, in order, before unlocking", () => {
    const profile: StudentProfile = {
      ...fullProfile(),
      topicMasteryScores: {
        [FRACTIONS]: { name: "Adding Fractions", mastery: 0.3 },
        [DIVISION]: { name: "Long Division", mastery: 0.5 },
      },
    };
    let state = initTutoringState(profile, makeProblem([FRACTIONS, DIVISION]));
    state = advance(state, { type: "ADVANCE" });
    expect(currentGap(state)?.topicId).toBe(FRACTIONS);

    state = advance(state, { type: "GAP_ATTEMPT", correct: true });
    expect(state.phase).toBe("gap_check"); // second gap still open
    expect(currentGap(state)?.topicId).toBe(DIVISION);

    state = advance(state, { type: "GAP_ATTEMPT", correct: true });
    expect(state.phase).toBe("solve"); // both resolved
  });
});

describe("advance — no-op behavior", () => {
  function gapCheckState(): TutoringState {
    const profile: StudentProfile = {
      ...fullProfile(),
      topicMasteryScores: { [FRACTIONS]: { name: "Adding Fractions", mastery: 0.3 } },
    };
    return advance(initTutoringState(profile, makeProblem([FRACTIONS])), {
      type: "ADVANCE",
    });
  }

  it("treats an incorrect gap answer as a no-op (gap stays open)", () => {
    const state = gapCheckState();
    const next = advance(state, { type: "GAP_ATTEMPT", correct: false });
    expect(next).toBe(state); // same reference — unchanged
    expect(currentGap(next)?.resolved).toBe(false);
  });

  it("treats an incorrect solve answer as a no-op (stays in solve)", () => {
    const solveState = advance(gapCheckState(), {
      type: "GAP_ATTEMPT",
      correct: true,
    });
    expect(solveState.phase).toBe("solve");
    const next = advance(solveState, { type: "SOLVE_ATTEMPT", correct: false });
    expect(next).toBe(solveState);
  });

  it("ignores events that don't match the current phase", () => {
    const state = gapCheckState();
    // SOLVE_ATTEMPT in gap_check, ADVANCE in gap_check — both no-ops.
    expect(advance(state, { type: "SOLVE_ATTEMPT", correct: true })).toBe(state);
    expect(advance(state, { type: "ADVANCE" })).toBe(state);
    expect(canApply(state, { type: "SOLVE_ATTEMPT", correct: true })).toBe(false);
    expect(canApply(state, { type: "GAP_ATTEMPT", correct: true })).toBe(true);
  });

  it("ignores all events once completed", () => {
    const completed: TutoringState = {
      phase: "review",
      status: "completed",
      gaps: [],
    };
    expect(advance(completed, { type: "ADVANCE" })).toBe(completed);
    expect(advance(completed, { type: "SOLVE_ATTEMPT", correct: true })).toBe(
      completed,
    );
    expect(canApply(completed, { type: "ADVANCE" })).toBe(false);
  });
});

describe("advance — purity", () => {
  it("does not mutate its input state", () => {
    const profile: StudentProfile = {
      ...fullProfile(),
      topicMasteryScores: { [FRACTIONS]: { name: "Adding Fractions", mastery: 0.3 } },
    };
    const gapCheck = advance(initTutoringState(profile, makeProblem([FRACTIONS])), {
      type: "ADVANCE",
    });
    const snapshot = JSON.parse(JSON.stringify(gapCheck));
    advance(gapCheck, { type: "GAP_ATTEMPT", correct: true });
    expect(gapCheck).toEqual(snapshot); // original untouched
  });
});

describe("persistence mapping", () => {
  it("round-trips through toPersisted / fromPersisted", () => {
    const state: TutoringState = {
      phase: "gap_check",
      status: "active",
      gaps: [{ topicId: FRACTIONS, name: "Adding Fractions", resolved: false }],
    };
    expect(fromPersisted(toPersisted(state))).toEqual(state);
  });

  it("normalizes a persisted row with missing gap_state", () => {
    const rehydrated = fromPersisted({
      phase: "intro",
      status: "active",
      // simulate an empty/legacy jsonb where gaps is absent
      gapState: {} as { gaps: [] },
    });
    expect(rehydrated.gaps).toEqual([]);
  });
});
