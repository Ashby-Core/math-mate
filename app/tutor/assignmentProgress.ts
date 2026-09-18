import { ProblemListItem } from "@/app/types";
import { ProblemSessionState } from "@/app/queries/sessions";

// Pure display logic for the assignment problems page: which problem is
// "current" (unlocked) and what phase label each row shows. Server-side
// enforcement of the sequential rule is a separate concern — this only
// decides what the list renders.

export type ProblemPhaseLabel = "Not started" | "Gap check" | "Solve" | "Completed";

/**
 * Labels a problem's row from its session state (absent when the student has
 * no session for it yet, which reads the same as an `intro`-phase session).
 * Status is checked before phase since a completed session's terminal phase
 * is `review`, which would otherwise read as still-in-progress.
 */
export function getProblemPhaseLabel(
  sessionState: ProblemSessionState | undefined,
): ProblemPhaseLabel {
  if (!sessionState || sessionState.phase === "intro") return "Not started";
  if (sessionState.status === "completed") return "Completed";
  return sessionState.phase === "gap_check" ? "Gap check" : "Solve";
}

/**
 * The id of the one problem the student should work next: the first problem
 * (in `orderIndex` order) without a completed session. Returns `null` when
 * every problem is completed. Earlier problems read as done, later ones as
 * locked, relative to this id.
 */
export function getActiveProblemId(
  problems: ProblemListItem[],
  statuses: Record<string, ProblemSessionState>,
): string | null {
  const active = problems.find(
    (problem) => statuses[problem.id]?.status !== "completed",
  );
  return active?.id ?? null;
}
