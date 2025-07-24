import React from "react";
import AddAssignment from "../ui/AddAssignment";
import { Course } from "@/app/types";
import { createClient } from "@/utils/supabase/server";
import { createAssignment } from "@/app/actions/actions";

interface AssignmentsProps {
  course: Course;
  userIsTeacher: boolean;
}

const Assignments = async ({ course, userIsTeacher }: AssignmentsProps) => {
  const supabase = await createClient();
  const { data: assignments } = await supabase
    .from("assignments")
    .select("*")
    .eq("course", course.id);
  return (
    <div className="lg:col-span-2">
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Assignments</h2>
            {userIsTeacher ? (
              <AddAssignment
                courseId={course.id}
                createAssignmentAction={createAssignment}
              />
            ) : (
              <></>
            )}
          </div>
        </div>

        <div className="p-6">
          {assignments && assignments.length > 0 ? (
            <div className="space-y-4">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-1">
                        {assignment.title}
                      </h3>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>
                          Created:{" "}
                          {new Date(assignment.created_at).toLocaleDateString()}
                        </span>
                        {assignment.due_date && (
                          <span>
                            Due:{" "}
                            {new Date(assignment.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
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
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">No assignments yet</p>
              <p className="text-gray-400 text-xs mt-1">
                Create your first assignment to get started
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Assignments;
