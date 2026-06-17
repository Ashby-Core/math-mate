"use client";

import { TopicMastery } from "@/app/types";
import { getMasteries } from "@/app/queries/masteries";
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
  mastery: {
    label: "Mastery",
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
      setTopicMasteries(await getMasteries(supabase, studentId, courseId));
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
            <YAxis domain={[0, 1]} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="mastery" fill="var(--color-mastery)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default TopicMasteriesChart;
