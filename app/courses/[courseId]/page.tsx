import Assignments from "@/app/components/layout/Assignments";
import UserNavbar from "@/app/components/layout/UserNavbar";
import Students from "@/app/components/layout/Students";
import { Course } from "@/app/types";
import { createClient } from "@/utils/supabase/server";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  const supabase = await createClient();

  const { data: courseData } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();
  const course: Course = {
    id: courseData.id,
    createdAt: courseData.created_at,
    teacher: courseData.teacher,
    name: courseData.name,
    code: courseData.code,
  };

  const { data: studentsInCourse } = await supabase
    .from("enrollments")
    .select("*")
    .eq("course_id", course.id);
  const students = [];

  if (studentsInCourse) {
    for (let i = 0; i < studentsInCourse.length; i += 1) {
      const { data: student } = await supabase
        .from("student_profiles")
        .select("*")
        .eq("id", studentsInCourse[i]);
      students.push(student);
    }
  }

  const { data: assignments } = await supabase
    .from("assignments")
    .select("*")
    .eq("course", course.id);

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
            <div className="text-right">
              <p className="text-sm text-gray-500">
                {students.length}{" "}
                {students.length === 1 ? "student" : "students"} enrolled
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Assignments course={course} />
          <div>
            <Students course={course} />

            {/* Quick Stats */}
            <div className="mt-6 bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Quick Stats
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">
                    Total Assignments
                  </span>
                  <span className="font-medium text-gray-900">
                    {assignments?.length || 0}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
