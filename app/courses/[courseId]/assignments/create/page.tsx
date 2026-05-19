import UserNavbar from "@/app/UserNavbar";
import React from "react";
import { requireUser } from "@/app/queries/auth";
import { getTopicsByCourse } from "@/app/queries/topics";
import CreateAssignmentForm from "./CreateAssignmentForm";

export default async function CreateAssignment({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const { supabase } = await requireUser();

  const availableTopics = await getTopicsByCourse(supabase, courseId);

  return (
    <div className="min-h-screen bg-gray-50">
      <UserNavbar />

      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Create Assignment
              </h1>
              <p className="text-gray-600 mt-1">
                Design a new assignment for your students
              </p>
            </div>
          </div>
        </div>
      </div>

      <CreateAssignmentForm
        courseId={courseId}
        availableTopics={availableTopics}
      />
    </div>
  );
}
