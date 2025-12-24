"use client";

import UserNavbar from "@/app/components/layout/UserNavbar";
import { Topic, Problem } from "@/app/types";
import { createClient } from "@/utils/supabase/client";
import { Autocomplete, TextField } from "@mui/material";
import { redirect } from "next/navigation";
import React, { use, useEffect, useState } from "react";
import ProblemsManager from "@/app/courses/[courseId]/assignments/create/ProblemsManager";
import { createAssignment } from "@/app/actions/actions";
import { UUID } from "crypto";

export default function CreateAssignment({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);
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
        .from("course_topics")
        .select("*")
        .eq("course_id", courseId)
        .order("order_index", { ascending: true });

      const topics = [];

      if (data) {
        for (const topic of data) {
          topics.push({
            id: topic.id,
            courseId: topic.course_id,
            name: topic.name,
            orderIndex: topic.order_index,
            createdAt: topic.created_at,
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

    // Add topics as comma-separated string
    const topicsString = selectedTopics.map((t) => t.id).join(",");
    formData.append("topics", topicsString);

    // Add problems as JSON string
    formData.append("problems", JSON.stringify(problems));

    // Call the server action
    // const result = await createAssignment(formData, courseId as UUID);
    console.log(Object.fromEntries(formData.entries()))

    /*
    if (result.success) {
      // Redirect or show success message
      redirect(`/courses/${courseId}`);
    } else {
      // Handle error
      console.error(result.error);
    }
    */
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
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Assignment Details
                  </h2>
                  <p className="text-gray-600 text-sm mt-1">
                    Basic information about your assignment
                  </p>
                </div>

                <div className="p-6 space-y-6">
                  {/* Title */}
                  <div>
                    <label
                      htmlFor="title"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="title"
                      id="title"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="Enter the title you would like to give your assignment"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="dueDate"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Due Date
                    </label>
                    <input
                      type="date"
                      name="dueDate"
                      id="dueDate"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                  {/* Topics */}
                  <div>
                    <label
                      htmlFor="topics"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Topic(s)
                    </label>
                    <div className="w-full">
                      <Autocomplete
                        id="topics"
                        multiple
                        options={availableTopics}
                        getOptionLabel={(option) => option.name}
                        value={selectedTopics}
                        onChange={(_, newValue) => setSelectedTopics(newValue)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder="Select topics this assignment will cover"
                            size="small"
                            sx={{
                              "& .MuiOutlinedInput-root": {
                                "& fieldset": {
                                  borderColor: "#d1d5db",
                                },
                                "&:hover fieldset": {
                                  borderColor: "#9ca3af",
                                },
                                "&.Mui-focused fieldset": {
                                  borderColor: "#3b82f6",
                                  borderWidth: "2px",
                                },
                              },
                            }}
                          />
                        )}
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label
                      htmlFor="description"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Description/Instructions
                    </label>
                    <textarea
                      name="description"
                      id="description"
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                      placeholder="Provide detailed instructions for students..."
                    />
                  </div>
                </div>
              </div>

              {/* Problems Section */}
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Problems
                  </h2>
                  <p className="text-gray-600 text-sm mt-1">
                    Create or generate problems for this assignment
                  </p>
                </div>

                <div className="p-6">
                  <ProblemsManager
                    topics={availableTopics}
                    problems={problems}
                    setProblems={setProblems}
                  />
                </div>
              </div>
            </div>

            {/* Sidebar - Right Column */}
            <div className="space-y-6">
              {/* Quick Tips */}
              <div className="bg-red-50 rounded-lg border border-red-200 p-6">
                <h4 className="text-sm font-semibold text-red-900 mb-3">
                  💡 Quick Tips
                </h4>
                <ul className="text-sm text-red-800 space-y-2">
                  <li>• Clear titles help students understand the focus</li>
                  <li>• Add detailed instructions to reduce confusion</li>
                  <li>• Mix problem types for better engagement</li>
                  <li>• Consider difficulty progression</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  type="submit"
                  className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Create Assignment
                </button>

                <button
                  type="button"
                  className="w-full text-gray-500 py-2 px-4 hover:text-gray-700 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
