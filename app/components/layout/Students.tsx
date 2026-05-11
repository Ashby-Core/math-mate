import { Course, Profile } from "@/app/types";
import { createClient } from "@/utils/supabase/server";
import { PersonStanding } from "lucide-react";
import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

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
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-xl">Students</CardTitle>
      </CardHeader>

      <CardContent>
        {students && students.length > 0 ? (
          <div className="space-y-3">
            {students.map((student) => (
              <Card
                key={student.firstName}
                size="sm"
                className="hover:bg-muted/50 transition-colors"
              >
                <CardContent className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {student.firstName} {student.lastName}
                    </p>
                    <p className="text-gray-500 text-xs truncate">
                      @{student.username}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-3">
              <PersonStanding className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-gray-500 text-sm">No students enrolled</p>
            <p className="text-gray-400 text-xs mt-1">
              Students will appear here when they join
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Students;
