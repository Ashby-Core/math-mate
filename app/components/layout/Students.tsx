import { Course, Profile } from "@/app/types";
import { createClient } from "@/utils/supabase/server";
import React from "react";

interface StudentsProps {
  course: Course;
}

const Students = async ({ course }: StudentsProps) => {
  const supabase = await createClient();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("*")
    .eq("course_id", course.id);

  const students: Profile[] = [];
  if (enrollments) {
    for (let i = 0; i < enrollments.length; i++) {
      const { data: student } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", enrollments[i].student_id)
        .single();
      if (student) {
        students.push({
          firstName: student.first_name,
          lastName: student.last_name,
          username: student.username,
        });
      }
    }
  }
  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold text-gray-900">Students</h2>
      </div>

      <div className="p-6">
        {students && students.length > 0 ? (
          <div className="space-y-3">
            {students.map((student) => (
              <div
                key={student.firstName}
                className="flex items-center space-x-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center"></div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">
                    {student.firstName} {student.lastName}
                  </p>
                  <p className="text-gray-500 text-xs truncate">
                    @{student.username}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-3">
              <svg
                className="w-12 h-12 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">No students enrolled</p>
            <p className="text-gray-400 text-xs mt-1">
              Students will appear here when they join
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Students;
