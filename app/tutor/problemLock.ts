import { SupabaseClient } from "@supabase/supabase-js";
import { getProblemsByAssignment } from "@/app/queries/problems";
import { getSessionStatusesByAssignment } from "@/app/queries/sessions";
import { getActiveProblemId } from "@/app/tutor/assignmentProgress";

// The sequential-unlock enforcement gate, shared by `POST /api/sessions` and
// `/tutor/[problemId]` so both call sites derive "is this problem allowed"
// the same way instead of duplicating the fetch-then-compare sequence.

/**
 * Whether `problemId` is the one problem in `assignmentId` the student is
 * currently allowed to bootstrap a session for, per `getActiveProblemId`.
 * Returns `null` if either underlying query failed — callers MUST fail
 * closed (error out) in that case rather than treat it as locked or
 * unlocked: `getProblemsByAssignment`/`getSessionStatusesByAssignment`
 * return `null` on error precisely so this can't silently fall back to their
 * display-only empty defaults, which would either unlock everything (missing
 * siblings) or wrongly relock a student who has actually completed earlier
 * problems (missing statuses).
 */
export async function isProblemUnlocked(
  supabase: SupabaseClient,
  studentId: string,
  assignmentId: string,
  problemId: string,
): Promise<boolean | null> {
  const [problems, statuses] = await Promise.all([
    getProblemsByAssignment(supabase, assignmentId),
    getSessionStatusesByAssignment(supabase, studentId, assignmentId),
  ]);
  if (problems === null || statuses === null) return null;

  const activeProblemId = getActiveProblemId(problems, statuses);
  return activeProblemId === null || activeProblemId === problemId;
}
