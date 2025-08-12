import { MultipleChoiceProblem } from "@/app/types";
import { Radio } from "@mui/material";
import { UUID } from "crypto";
import React from "react";

interface MultipleChoiceProblemEditProps {
  key: number;
  problem: MultipleChoiceProblem;

  setQuestionContent: (
    event: React.ChangeEvent<HTMLTextAreaElement>,
    id: UUID
  ) => void;
  setOption: (
    event: React.ChangeEvent<HTMLInputElement>,
    id: UUID,
    index: number
  ) => void;
  setCorrectChoice: (
    event: React.ChangeEvent<HTMLInputElement>,
    id: UUID
  ) => void;
}

const MultipleChoiceProblemEdit = ({
  problem,
  setQuestionContent,
  setOption,
  setCorrectChoice,
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
        <h3>Options</h3>
        {problem.options.map((option, index) => (
          <div className="flex" key={index}>
            <input
              type="text"
              defaultValue={option}
              onChange={(event) => setOption(event, problem.id, index)}
            />
            <Radio
              checked={index === problem.correctChoiceIndex}
              onChange={(event) => setCorrectChoice(event, problem.id)}
              value={index}
              name="choices"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MultipleChoiceProblemEdit;
