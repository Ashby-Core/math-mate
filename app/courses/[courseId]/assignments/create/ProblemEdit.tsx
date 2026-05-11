import { Problem } from "@/app/types";
import { UUID } from "crypto";
import React from "react";
import { CircleHelp, CircleCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface ProblemEditProps {
  problem: Problem;
  setQuestionContent: (
    event: React.ChangeEvent<HTMLTextAreaElement>,
    id: UUID
  ) => void;
  setCorrectAnswer: (
    event: React.ChangeEvent<HTMLTextAreaElement>,
    id: UUID
  ) => void;
}

const ProblemEdit = ({
  problem,
  setQuestionContent,
  setCorrectAnswer,
}: ProblemEditProps) => {
  return (
    <Card className="ring-blue-200">
      <CardContent className="space-y-6">
        {/* Question Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CircleHelp className="size-5" />
            <h3 className="font-semibold text-gray-900">Question</h3>
          </div>

          <div className="relative">
            <Textarea
              value={problem.questionContent}
              onChange={(event) => setQuestionContent(event, problem.id)}
              placeholder="Enter your question here... (e.g., What number does pi represent (give at least 2 decimal places)?)"
              rows={5}
            />
            <div className="absolute bottom-3 right-3 text-xs text-gray-400">
              {problem.questionContent.length}/1000
            </div>
          </div>
        </div>

        {/* Answer Section */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <CircleCheck className="size-5" />
            Expected Answer
          </label>
          <div className="relative">
            <Textarea
              value={problem.correctAnswer}
              onChange={(event) => setCorrectAnswer(event, problem.id)}
              placeholder="Enter the expected answer or key points..."
              rows={3}
            />
            <div className="absolute bottom-3 right-3 text-xs text-gray-400">
              {problem.correctAnswer.length}/500
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProblemEdit;
