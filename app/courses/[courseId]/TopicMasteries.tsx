"use client";

import { TopicMastery } from "@/app/types";
import { createClient } from "@/utils/supabase/client";
import { UUID } from "crypto";
import React, { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/app/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/app/components/ui/chart";

interface TopicMasteriesChartProps {
  studentId: UUID;
  courseId: UUID;
}

const chartConfig = {
  masteryScore: {
    label: "Mastery Score",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

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
            (entry) => entry.topic_id === topic.id,
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
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Topic Masteries</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-80 w-full"
        >
          <BarChart data={topicMasteries}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="masteryScore"
              fill="var(--color-masteryScore)"
              radius={4}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default TopicMasteriesChart;
