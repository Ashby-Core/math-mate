"use client";

import UserNavbar from "@/app/UserNavbar";
import { Topic, Problem } from "@/app/types";
import { createClient } from "@/utils/supabase/client";
import { redirect } from "next/navigation";
import React, { use, useEffect, useState } from "react";
import ProblemsManager from "@/app/courses/[courseId]/assignments/create/ProblemsManager";
import { createAssignment } from "@/app/queries/actions";
import { UUID } from "crypto";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Button } from "@/app/components/ui/button";

export default function CreateAssignment({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        redirect("/login");
      }

      const { data } = await supabase
        .from("topics")
        .select("*")
        .eq("course_id", courseId);

      const topics = [];

      if (data) {
        for (const topic of data) {
          topics.push({
            id: topic.id,
            courseId: topic.course_id,
            name: topic.name,
          });
        }
      }

      setAvailableTopics(topics);
    };

    fetchData();
  }, [courseId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
      console.log(result.error)
    }
  };

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

      {/* Main Content */}
      <form onSubmit={handleSubmit}>
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
                  onClick={() => redirect(`/courses/${courseId}`)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
