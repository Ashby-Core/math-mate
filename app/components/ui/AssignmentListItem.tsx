import { Assignment } from "@/app/types";
import { Badge } from "@mui/material";
import Link from "next/link";
import React from "react";

interface AssignmentListItemProps {
  badgeContent: number;
  assignment: Assignment;
  courseName: string;
}

const AssignmentListItem = ({
  badgeContent,
  assignment,
  courseName,
}: AssignmentListItemProps) => {
  return (
    <div className="flex">
      <Badge badgeContent={badgeContent} color="error" />
      <div>
        <Link className="hover:underline" href="">
          {assignment.title} ({courseName})
        </Link>
        <p>
          Due:{" "}
          {assignment.dueDate.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            timeStyle: "medium",
          })}
        </p>
      </div>
    </div>
  );
};

export default AssignmentListItem;
