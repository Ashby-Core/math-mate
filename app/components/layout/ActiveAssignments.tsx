import { Assignment } from "@/app/types";
import { Divider } from "@mui/material";
import React from "react";
import AssignmentListItem from "../ui/AssignmentListItem";
import { UUID } from "crypto";
import { createClient } from "@/utils/supabase/server";

interface ActiveAssignmentsProps {
  assignments: Assignment[];
}

const ActiveAssignments = async ({ assignments }: ActiveAssignmentsProps) => {
  const supabase = await createClient();

  const fetchCourseName = async (courseId: UUID) => {
    const { data: courseName } = await supabase
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .single();
    return courseName;
  };
  return (
    <div className="flex-grow">
      <h3 className="mb-1 text-md font-medium">Active Assignments</h3>
      <Divider className="w-full" />
      {assignments.map(async (assignment, index) => {
        const courseName = await fetchCourseName(assignment.courseId);

        // TODO: Refactor submission entity in Supabase and implement fetchSubmissionCount
        // const submissionCount = fetchSubmissionCount(assignment.id);
        return (
          <AssignmentListItem
            key={index}
            title={assignment.title}
            courseName={courseName}
            dueDate={assignment.dueDate}
            submissionCount={21}
          />
        );
      })}
    </div>
  );
};

export default ActiveAssignments;
