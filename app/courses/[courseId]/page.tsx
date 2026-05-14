import { notFound } from "next/navigation";

import Assignments from "@/app/courses/[courseId]/Assignments";
import UserNavbar from "@/app/UserNavbar";
import Students from "@/app/courses/[courseId]/Students";
import { Profile } from "@/app/types";
import { requireUser } from "@/app/queries/auth";
import { getAssignmentsByCourse } from "@/app/queries/assignments";
import { getCourseById } from "@/app/queries/courses";
import { getCourseStudents } from "@/app/queries/enrollments";
import { getProfileById } from "@/app/queries/profiles";
import TopicMasteriesChart from "@/app/courses/[courseId]/TopicMasteries";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/app/components/ui/card";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  const { supabase, user } = await requireUser();

  const profile = await getProfileById(supabase, user.id);
  const userIsTeacher = profile?.userRole === "teacher";

  const course = await getCourseById(supabase, courseId);
  if (!course) {
    notFound();
  }

  const students: Profile[] = userIsTeacher
    ? await getCourseStudents(supabase, course.id)
    : [];

  const assignments = await getAssignmentsByCourse(supabase, course.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <UserNavbar />
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {course.name}
              </h1>
              <p className="text-gray-600 mt-1">Course Code: {course.code}</p>
            </div>
            {userIsTeacher ? (
              <div className="text-right">
                <p className="text-sm text-gray-500">
                  {students.length}{" "}
                  {students.length === 1 ? "student" : "students"} enrolled
                </p>
              </div>
            ) : (
              <></>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div
          className={
            userIsTeacher ? "grid grid-cols-1 lg:grid-cols-3 gap-8" : ""
          }
        >
          <Assignments
            assignments={assignments}
            userIsTeacher={userIsTeacher}
          />
          <div>
            {userIsTeacher && <Students students={students} />}

            {/* Quick Stats */}
            {userIsTeacher && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-lg">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">
                        Total Assignments
                      </span>
                      <span className="font-medium text-gray-900">
                        {assignments.length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">
                        Enrolled Students
                      </span>
                      <span className="font-medium text-gray-900">
                        {students.length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Created</span>
                      <span className="font-medium text-gray-900 text-sm">
                        {new Date(course.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        {!userIsTeacher && profile && (
          <TopicMasteriesChart studentId={profile.id} courseId={course.id} />
        )}
      </div>
    </div>
  );
}
