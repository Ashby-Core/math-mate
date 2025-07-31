"use client";

import { TopicMastery } from "@/app/types";
import { createClient } from "@/utils/supabase/client";
import { UUID } from "crypto";
import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TopicMasteriesChartProps {
  studentId: UUID;
  courseId: UUID;
}

const TopicMasteriesChart = ({
  studentId,
  courseId,
}: TopicMasteriesChartProps) => {
  const [topicMasteries, setTopicMasteries] = useState<TopicMastery[]>([]);

  useEffect(() => {
    const fetchMasteries = async () => {
      const supabase = createClient();
      const { data: relevantTopicsData, error: topicsError } = await supabase
        .from("course_topics")
        .select("*")
        .eq("course_id", courseId)
        .order("order_index", { ascending: true });
      const { data: topicMasteriesData, error: masteriesError } = await supabase
        .from("student_topic_masteries")
        .select("*")
        .eq("student_id", studentId);

      if (topicsError) {
        console.error("Error fetching relevant topics");
      }

      if (masteriesError) {
        console.error("Error fetching masteries data");
      }

      const masteries = [];

      if (relevantTopicsData && topicMasteriesData) {
        for (const topic of relevantTopicsData) {
          const mastery = topicMasteriesData.find(
            (entry) => entry.topic_id === topic.id
          );
          
          masteries.push({
            name: topic.name,
            masteryScore: mastery.mastery_score,
            problemsAttempted: mastery.problems_attempted,
            problemsCorrect: mastery.problems_correct,
          });
        }
      }

      setTopicMasteries(masteries);
    };

    fetchMasteries();
  }, [courseId, studentId]);

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart width={600} height={300} data={topicMasteries}>
          <CartesianGrid strokeDasharray="3 3" />
          <Bar dataKey="masteryScore" fill="#2196f3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TopicMasteriesChart;
