"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/app/components/ui/card";
import { Textarea } from "@/app/components/ui/textarea";
import { Topic, Problem } from "@/app/types";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { useState } from "react";
import ProblemsManager from "./ProblemsManager";
import { createAssignment } from "@/app/queries/actions";
import { UUID } from "crypto";
import { redirect } from "next/navigation";

interface CreateAssignmentFormProps {
  courseId: string;
  availableTopics: Topic[];
}

export default function CreateAssignmentForm({
  courseId,
  availableTopics,
}: CreateAssignmentFormProps) {
  const [problems, setProblems] = useState<Problem[]>([]);

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
    problems: Problem[],
  ) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    const result = await createAssignment({
      courseId: courseId as UUID,
      title: formData.get("title") as string,
      dueDate: new Date(formData.get("dueDate") as string),
      description: formData.get("description") as string,
      problems: problems.map((problem, index) => ({
        ...problem,
        orderIndex: index,
      })),
    });

    if (result.success) {
      console.log("Assignment created successfully!");
      redirect(`/courses/${courseId}`);
    } else {
      alert("Error creating assignment");
      console.log(result.error);
    }
  };

  const handleCancel = async () => {
    redirect(`/courses/${courseId}`);
  };
  return (
    <form onSubmit={(e) => handleSubmit(e, problems)}>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Assignment Details - Left Column */}
          <div className="xl:col-span-2 space-y-8">
            {/* Basic Details Card */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-xl">Assignment Details</CardTitle>
                <CardDescription>
                  Basic information about your assignment
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Title */}
                <div>
                  <label
                    htmlFor="title"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Title <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    name="title"
                    id="title"
                    required
                    placeholder="Enter the title you would like to give your assignment"
                  />
                </div>

                {/* Due Date */}
                <div>
                  <label
                    htmlFor="dueDate"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Due Date
                  </label>
                  <Input type="date" name="dueDate" id="dueDate" />
                </div>

                {/* Description */}
                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Description/Instructions
                  </label>
                  <Textarea
                    name="description"
                    id="description"
                    rows={4}
                    placeholder="Provide detailed instructions for students..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Problems Section */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-xl">Problems</CardTitle>
                <CardDescription>
                  Create or generate problems for this assignment
                </CardDescription>
              </CardHeader>

              <CardContent>
                <ProblemsManager
                  topics={availableTopics}
                  problems={problems}
                  setProblems={setProblems}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Right Column */}
          <div className="space-y-6">
            {/* Quick Tips */}
            <Card className="bg-red-50 ring-red-200">
              <CardHeader>
                <CardTitle className="text-sm text-red-900">
                  💡 Quick Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-red-800 space-y-2">
                  <li>• Clear titles help students understand the focus</li>
                  <li>• Add detailed instructions to reduce confusion</li>
                  <li>• Mix problem types for better engagement</li>
                  <li>• Consider difficulty progression</li>
                </ul>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 font-medium"
              >
                Create Assignment
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-gray-500 hover:text-gray-700 text-sm"
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
