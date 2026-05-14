import React from "react";
import AddAssignment from "./AddAssignment";
import { Assignment } from "@/app/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
} from "@/app/components/ui/card";
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
                  <CardContent>
                    <h3 className="font-medium text-gray-900 mb-1">
                      {assignment.title}
                    </h3>
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
