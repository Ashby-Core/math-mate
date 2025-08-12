import { OpenEndedProblem } from "@/app/types";
import { UUID } from "crypto";
import React from "react";

interface MultipleChoiceProblemEditProps {
  key: number;
  problem: OpenEndedProblem;

  setQuestionContent: (
    event: React.ChangeEvent<HTMLTextAreaElement>,
    id: UUID
  ) => void;
  setCorrectAnswer: (
    event: React.ChangeEvent<HTMLInputElement>,
    id: UUID
  ) => void;
}

const MultipleChoiceProblemEdit = ({
  problem,
  setQuestionContent,
  setCorrectAnswer,
}: MultipleChoiceProblemEditProps) => {
  return (
    <div className="flex">
      <div>
        <h3>Question</h3>
        <textarea
          name="question-name"
          placeholder={problem.questionContent}
          onChange={(event) => setQuestionContent(event, problem.id)}
        />
      </div>
      <div>
        <h3>Correct Answer</h3>
        <input
          type="text"
          onChange={(event) => setCorrectAnswer(event, problem.id)}
        />
      </div>
    </div>
  );
};

export default MultipleChoiceProblemEdit;
