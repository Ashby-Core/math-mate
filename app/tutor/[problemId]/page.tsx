import { notFound, redirect } from "next/navigation";
import UserNavbar from "@/app/UserNavbar";
import { requireUser } from "@/app/queries/auth";
import { getProblemById } from "@/app/queries/problems";
import { isStudentEnrolled } from "@/app/queries/enrollments";
import { getResumableSession } from "@/app/queries/sessions";
import { isProblemUnlocked } from "@/app/tutor/problemLock";
import TutorShell from "@/app/tutor/[problemId]/TutorShell";

// Student-facing tutoring route. Just the auth guard + chrome; the session itself
// is bootstrapped client-side against POST /api/sessions, which owns the
// concurrent-create/resume lifecycle.
//
// Enrollment and the sequential-unlock gate are both re-checked here (not just
// in the API route) so a direct URL visit to a problem the student can't open
// yet — unenrolled, or locked — redirects/404s before doing any more
// privileged-shaped work (fetching the problem's answer, the assignment's
// siblings) or mounting TutorShell to surface the API's 403 as a client-side
// error. A student who already has an active/completed session for this
// problem always passes the lock check — it's about problems never eligible
// to open, not reviewing progress.
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

  if (!(await isStudentEnrolled(supabase, user.id, found.courseId))) {
    notFound();
  }

  const resumable = await getResumableSession(supabase, user.id, problemId);
  if (!resumable) {
    // `null` means a sibling/status lookup failed; thrown rather than treated
    // as locked or unlocked so a transient DB error surfaces as an error page
    // instead of silently granting or denying access.
    const unlocked = await isProblemUnlocked(
      supabase,
      user.id,
      found.assignmentId,
      problemId,
    );
    if (unlocked === null) {
      throw new Error("Could not resolve assignment progress for the lock check");
    }
    if (!unlocked) {
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
