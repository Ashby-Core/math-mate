import UserNavbar from "@/app/UserNavbar";
import { requireUser } from "@/app/queries/auth";
import TutorShell from "@/app/tutor/[problemId]/TutorShell";

// Student-facing tutoring route. Just the auth guard + chrome; the session itself
// is bootstrapped client-side against POST /api/sessions, which owns the
// concurrent-create/resume lifecycle. Enrollment/ownership is re-checked there.
export default async function TutorPage({
  params,
}: {
  params: Promise<{ problemId: string }>;
}) {
  const { problemId } = await params;

  await requireUser();

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <UserNavbar />
      <TutorShell problemId={problemId} />
    </div>
  );
}
