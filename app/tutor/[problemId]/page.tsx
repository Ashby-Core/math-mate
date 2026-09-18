import { notFound, redirect } from "next/navigation";
import UserNavbar from "@/app/UserNavbar";
import { requireUser } from "@/app/queries/auth";
import { getProblemById, getProblemsByAssignment } from "@/app/queries/problems";
import {
  getResumableSession,
  getSessionStatusesByAssignment,
} from "@/app/queries/sessions";
import { getActiveProblemId } from "@/app/tutor/assignmentProgress";
import TutorShell from "@/app/tutor/[problemId]/TutorShell";

// Student-facing tutoring route. Just the auth guard + chrome; the session itself
// is bootstrapped client-side against POST /api/sessions, which owns the
// concurrent-create/resume lifecycle. Enrollment/ownership is re-checked there.
//
// The sequential-unlock gate is re-checked here too, so a direct URL visit to a
// locked problem redirects back to the assignment page instead of mounting
// TutorShell and surfacing the API's 403 as a client-side error. A student who
// already has an active/completed session for this problem always passes —
// the gate is about problems never eligible to open, not reviewing progress.
export default async function TutorPage({
  params,
}: {
  params: Promise<{ problemId: string }>;
}) {
  const { problemId } = await params;

  const { supabase, user } = await requireUser();

  const found = await getProblemById(supabase, problemId);
  if (!found) {
    notFound();
  }

  const resumable = await getResumableSession(supabase, user.id, problemId);
  if (!resumable) {
    const [problems, statuses] = await Promise.all([
      getProblemsByAssignment(supabase, found.assignmentId),
      getSessionStatusesByAssignment(supabase, user.id, found.assignmentId),
    ]);
    const activeProblemId = getActiveProblemId(problems, statuses);
    if (activeProblemId !== null && activeProblemId !== problemId) {
      redirect(`/courses/${found.courseId}/assignments/${found.assignmentId}`);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 lg:h-dvh lg:overflow-hidden">
      <UserNavbar />
      <TutorShell problemId={problemId} />
    </div>
  );
}
