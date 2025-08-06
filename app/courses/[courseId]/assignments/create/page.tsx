"use client";

import UserNavbar from "@/app/components/layout/UserNavbar";
import { Topic } from "@/app/types";
import { createClient } from "@/utils/supabase/client";
import { Autocomplete, TextField } from "@mui/material";
import { redirect } from "next/navigation";
import React, { use, useEffect, useState } from "react";

export default function CreateAssignment({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([]);

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

  return (
    <div>
      <UserNavbar />
      <h1>Create Assignment</h1>
      <div>
        <h2>Assignment Details</h2>
        <label htmlFor="title">Title</label>
        <input
          type="text"
          name="title"
          placeholder="Enter the title you would like to give your assignment"
        />

        <label htmlFor="dueDate">Due Date</label>
        <input type="date" name="dueDate" />

        <label htmlFor="topics">Topic(s)</label>
        <Autocomplete
          id="topics"
          multiple
          options={availableTopics}
          getOptionLabel={(option) => option.name}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Enter the topics this assignment will cover"
            />
          )}
        />

        <label htmlFor="difficulty">Difficulty</label>
        <Autocomplete
          disablePortal
          options={["Easy", "Medium", "Hard"]}
          renderInput={(params) => <TextField {...params} label="Difficulty" />}
        />

        <label htmlFor="description">Description/Instructions</label>
        <textarea name="description" />
      </div>
    </div>
  );
}
