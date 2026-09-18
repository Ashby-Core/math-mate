import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import UserNavbar from "@/app/UserNavbar";
import StudentProblemList from "@/app/courses/[courseId]/assignments/[assignmentId]/StudentProblemList";
import TeacherProblemList from "@/app/courses/[courseId]/assignments/[assignmentId]/TeacherProblemList";
import { requireUser } from "@/app/queries/auth";
import { getAssignmentById } from "@/app/queries/assignments";
import {
  getProblemsByAssignment,
  getProblemsByAssignmentForTeacher,
} from "@/app/queries/problems";
import { getSessionStatusesByAssignment } from "@/app/queries/sessions";
import { getProfileById } from "@/app/queries/profiles";
import { getActiveProblemId } from "@/app/tutor/assignmentProgress";
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card";

export default async function AssignmentPage({
  params,
}: {
  params: Promise<{ courseId: string; assignmentId: string }>;
}) {
  const { assignmentId } = await params;

  const { supabase, user } = await requireUser();

  const [profile, assignment] = await Promise.all([
    getProfileById(supabase, user.id),
    getAssignmentById(supabase, assignmentId),
  ]);

  if (!assignment) {
    notFound();
  }

  // Session state is scoped to a single student, so a teacher gets a read-only
  // view of the problems themselves (question + answer) instead.
  const isTeacher = profile?.userRole === "teacher";

  let problemsSection: ReactNode;
  if (isTeacher) {
    const problems = await getProblemsByAssignmentForTeacher(
      supabase,
      assignmentId,
    );
    problemsSection = <TeacherProblemList problems={problems} />;
  } else {
    const [problems, statuses] = await Promise.all([
      getProblemsByAssignment(supabase, assignmentId),
      getSessionStatusesByAssignment(supabase, user.id, assignmentId),
    ]);
    problemsSection = (
      <StudentProblemList
        problems={problems}
        statuses={statuses}
        activeProblemId={getActiveProblemId(problems, statuses)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <UserNavbar />

      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {assignment.title}
          </h1>
          {assignment.description && (
            <p className="text-gray-600 mt-1">{assignment.description}</p>
          )}
          {assignment.dueDate && (
            <p className="text-gray-500 text-sm mt-2">
              Due {new Date(assignment.dueDate).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-xl">Problems</CardTitle>
          </CardHeader>
          <CardContent>{problemsSection}</CardContent>
        </Card>
      </div>
    </div>
  );
}
