import { Badge } from "@mui/material";
import Link from "next/link";
import React from "react";

interface AssignmentListItemProps {
  title: string;
  courseName: string;
  dueDate: Date;
  submissionCount: number;
}

const AssignmentListItem = ({
  title,
  courseName,
  dueDate,
  submissionCount,
}: AssignmentListItemProps) => {
  return (
    <div className="flex">
      <Badge badgeContent={submissionCount} color="error" />
      <div>
        <Link className="hover:underline" href="">
          {title} ({courseName})
        </Link>
        <p>
          Due:{" "}
          {dueDate.toLocaleDateString(undefined, {
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
