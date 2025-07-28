"use client";

import React from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const TopicMasteries = () => {
  const topics = [
    { name: "Foundations", score: 100 },
    { name: "Solving equations and inequalities", score: 80 },
    { name: "Working with units", score: 96 },
    { name: "Linear equations and graphs", score: 45 },
    { name: "Systems of equations", score: 24 },
  ];

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          width={600}
          height={300}
          data={topics}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <Bar dataKey="score" fill="#2196f3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TopicMasteries;
