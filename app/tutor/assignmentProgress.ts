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
 * An `abandoned` session also reads as "Not started": `POST /api/sessions`
 * starts a fresh session for it rather than resuming, so it has no more
 * progress to show than an unstarted problem. Status is checked before phase
 * since a completed session's terminal phase is `review`, which would
 * otherwise read as still-in-progress.
 */
export function getProblemPhaseLabel(
  sessionState: ProblemSessionState | undefined,
): ProblemPhaseLabel {
  if (
    !sessionState ||
    sessionState.status === "abandoned" ||
    sessionState.phase === "intro"
  ) {
    return "Not started";
  }
  if (sessionState.status === "completed") return "Completed";
  return sessionState.phase === "gap_check" ? "Gap check" : "Solve";
}

/**
 * The label for a row's call-to-action link, or `null` when the row has none
 * (a locked, non-current problem). "Continue" only applies to a truly
 * resumable session (`status: "active"`) — an abandoned session's row still
 * links out for the current problem, but starts over, so it reads "Start".
 */
export function getProblemCtaLabel(
  sessionState: ProblemSessionState | undefined,
  isActive: boolean,
): "Start" | "Continue" | "Review" | null {
  if (sessionState?.status === "completed") return "Review";
  if (!isActive) return null;
  return sessionState?.status === "active" ? "Continue" : "Start";
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
