import { Problem, StudentProfile } from "@/app/types";
import { resolvePrerequisites } from "./gaps";

// TS-2 — the deterministic, serializable phase state machine for a tutoring
// session. Pure functions only: no Claude calls, no DB access. TS-3 judges each
// turn with Claude, then dispatches an event here to advance the state; the
// persistence layer (Milestone 3) maps the state to/from a `tutoring_sessions`
// row via `toPersisted`/`fromPersisted`.
//
// A problem's prerequisites are exactly its tagged topics (`problem.tops`) — the
// schema has no separate topic→topic prerequisite graph. Gaps are those tagged
// topics with mastery below threshold.

export type Phase = "intro" | "gap_check" | "solve" | "review";

/**
 * The machine only ever produces `active` or `completed`. The DB column also
 * allows `abandoned`, which is set externally (e.g. on session timeout), never
 * by a transition here.
 */
export type SessionStatus = "active" | "completed";

/** One prerequisite gap the student must clear before the problem unlocks. */
export type GapEntry = { topicId: string; name: string; resolved: boolean };

/** The complete state of a tutoring session at a point in time. */
export type TutoringState = {
  phase: Phase;
  status: SessionStatus;
  gaps: GapEntry[]; // in probe order (problem.tops order, deduped)
};

/**
 * The transitions TS-3 can dispatch after judging a turn:
 * - `ADVANCE`: leave Intro (→ gap_check or solve), or finish Review (→ completed).
 * - `GAP_ATTEMPT`: a gap-check follow-up answer was judged.
 * - `SOLVE_ATTEMPT`: a problem answer was judged.
 */
export type TutoringEvent =
  | { type: "ADVANCE" }
  | { type: "GAP_ATTEMPT"; correct: boolean }
  | { type: "SOLVE_ATTEMPT"; correct: boolean };

/**
 * The prerequisite gaps for a problem, in probe order: every prerequisite topic
 * classified GAP (mastery below threshold). `null`/unassessed and
 * missing-from-profile topics are excluded, and duplicate ids are collapsed —
 * all handled by `resolvePrerequisites`.
 */
export function computeGaps(
  profile: StudentProfile,
  problem: Problem,
): GapEntry[] {
  return resolvePrerequisites(profile, problem)
    .filter((topic) => topic.status === "GAP")
    .map((topic) => ({
      topicId: topic.topicId,
      // GAP topics are always present in the profile, so name is non-null.
      name: topic.name ?? topic.topicId,
      resolved: false,
    }));
}

/** The starting state for a fresh session: Intro, active, with its gaps computed. */
export function initTutoringState(
  profile: StudentProfile,
  problem: Problem,
): TutoringState {
  return {
    phase: "intro",
    status: "active",
    gaps: computeGaps(profile, problem),
  };
}

/** The gap currently being probed: the first unresolved gap, only in gap_check. */
export function currentGap(state: TutoringState): GapEntry | null {
  if (state.phase !== "gap_check") return null;
  return state.gaps.find((g) => !g.resolved) ?? null;
}

/** Whether the problem is revealed/unlocked (true once gaps are cleared). */
export function isProblemUnlocked(state: TutoringState): boolean {
  return state.phase === "solve" || state.phase === "review";
}

/** Whether the session has finished. */
export function isComplete(state: TutoringState): boolean {
  return state.status === "completed";
}

/**
 * The pure transition reducer. Returns a NEW state per the transition table;
 * never mutates its input. Any event that doesn't apply to the current phase is
 * a no-op (returns the same state reference) — TS-3 can pre-check with
 * `canApply`.
 */
export function advance(
  state: TutoringState,
  event: TutoringEvent,
): TutoringState {
  if (state.status === "completed") return state;

  switch (state.phase) {
    case "intro":
      if (event.type !== "ADVANCE") return state;
      return {
        ...state,
        phase: state.gaps.length > 0 ? "gap_check" : "solve",
      };

    case "gap_check": {
      if (event.type !== "GAP_ATTEMPT") return state;
      if (!event.correct) return state; // tutor nudges; gap stays open
      const current = currentGap(state);
      if (!current) return state;

      let resolvedOne = false;
      const gaps = state.gaps.map((g) => {
        if (!resolvedOne && g.topicId === current.topicId && !g.resolved) {
          resolvedOne = true;
          return { ...g, resolved: true };
        }
        return g;
      });
      const moreRemain = gaps.some((g) => !g.resolved);
      return { ...state, gaps, phase: moreRemain ? "gap_check" : "solve" };
    }

    case "solve":
      if (event.type !== "SOLVE_ATTEMPT") return state;
      if (!event.correct) return state; // tutor scaffolds; stay in solve
      return { ...state, phase: "review" };

    case "review":
      if (event.type !== "ADVANCE") return state;
      return { ...state, status: "completed" };

    default:
      return state;
  }
}

/** Whether `event` would actually change `state` (i.e. `advance` is not a no-op). */
export function canApply(state: TutoringState, event: TutoringEvent): boolean {
  return advance(state, event) !== state;
}

// --- Persistence mapping (pure object shaping; no DB code) -----------------
// Splits the state across the row's dedicated columns so each fact is stored
// once: `phase` and `status` are their own columns, the rest goes in the
// `gap_state` jsonb (as an object, so it stays forward-extensible).

export type PersistedTutoringState = {
  phase: Phase;
  status: SessionStatus;
  gapState: { gaps: GapEntry[] };
};

export function toPersisted(state: TutoringState): PersistedTutoringState {
  return {
    phase: state.phase,
    status: state.status,
    gapState: { gaps: state.gaps },
  };
}

/** Rehydrates state from a persisted row, normalizing a missing/empty jsonb. */
export function fromPersisted(p: PersistedTutoringState): TutoringState {
  return {
    phase: p.phase,
    status: p.status,
    gaps: p.gapState?.gaps ?? [],
  };
}
