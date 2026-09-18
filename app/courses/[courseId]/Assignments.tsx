import React from "react";
import Link from "next/link";
import AddAssignment from "./AddAssignment";
import { Assignment } from "@/app/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Newspaper } from "lucide-react";

interface AssignmentsProps {
  assignments: Assignment[];
  userIsTeacher: boolean;
}

const Assignments = ({ assignments, userIsTeacher }: AssignmentsProps) => {
  return (
    <div className="lg:col-span-2">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-xl">Assignments</CardTitle>
          {userIsTeacher && (
            <CardAction>
              <AddAssignment />
            </CardAction>
          )}
        </CardHeader>

        <CardContent>
          {assignments.length > 0 ? (
            <div className="space-y-4">
              {assignments.map((assignment) => (
                <Card
                  key={assignment.id}
                  size="sm"
                  className="hover:bg-muted/50 transition-colors"
                >
                  <CardHeader>
                    <CardTitle className="text-gray-900">
                      {assignment.title}
                    </CardTitle>
                    {!userIsTeacher && (
                      <CardAction>
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={`/courses/${assignment.courseId}/assignments/${assignment.id}`}
                          >
                            View Problems
                          </Link>
                        </Button>
                      </CardAction>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>
                        Created:{" "}
                        {new Date(assignment.createdAt).toLocaleDateString()}
                      </span>
                      {assignment.dueDate && (
                        <span>
                          Due:{" "}
                          {new Date(assignment.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-3">
                <Newspaper className="w-12 h-12 mx-auto" />
              </div>
              <p className="text-gray-500 text-sm">No assignments yet</p>
              {userIsTeacher && (
                <p className="text-gray-400 text-xs mt-1">
                  Create your first assignment to get started
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Assignments;
