import { Problem } from "@/app/types";
import { UUID } from "crypto";
import React, { useState } from "react";
import HelpIcon from "@mui/icons-material/Help";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

interface ProblemEditProps {
  problem: Problem;
  setQuestionContent: (
    event: React.ChangeEvent<HTMLTextAreaElement>,
    id: UUID
  ) => void;
  setCorrectAnswer: (
    event: React.ChangeEvent<HTMLInputElement>,
    id: UUID
  ) => void;
}

const ProblemEdit = ({
  problem,
  setQuestionContent,
  setCorrectAnswer,
}: ProblemEditProps) => {
  return (
    <div className="bg-white rounded-lg border-2 border-blue-100 p-6">
      {/* Question Section */}
      <div className="space-y-3 mb-3">
        <div className="flex items-center gap-2">
          <HelpIcon />
          <h3 className="font-semibold text-gray-900">Question</h3>
        </div>

        <div className="relative">
          <textarea
            value={problem.questionContent}
            onChange={(event) => setQuestionContent(event, problem.id)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            placeholder="Enter your question here... (e.g., What number does pi represent (give at least 2 decimal places)?)"
            rows={5}
          />
          <div className="absolute bottom-3 right-3 text-xs text-gray-400">
            {problem.questionContent.length}/1000
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <CheckCircleIcon />
          Expected Answer
        </label>
        <div className="relative">
          <textarea
            value={problem.correctAnswer}
            onChange={(event) => setCorrectAnswer(event as any, problem.id)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            placeholder="Enter the expected answer or key points..."
            rows={3}
          />
          <div className="absolute bottom-3 right-3 text-xs text-gray-400">
            {problem.correctAnswer.length}/500
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProblemEdit;
