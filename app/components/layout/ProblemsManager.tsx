"use client";

import { MultipleChoiceProblem, OpenEndedProblem, Problem } from "@/app/types";
import { Button } from "@mui/material";
import React, { useState } from "react";
import MultipleChoiceProblemEdit from "./MultipleChoiceProblemEdit";
import { UUID } from "crypto";
import OpenEndedProblemEdit from "./OpenEndedProblemEdit";

const createMultipleChoiceProblem = (): MultipleChoiceProblem => {
  return {
    id: crypto.randomUUID() as UUID,
    type: "multiple choice",
    difficulty: "medium",
    questionContent: "",
    options: ["Option A", "Option B", "Option C", "Option D"],
    correctChoiceIndex: 0,
  };
};

const createOpenEndedProblem = (): OpenEndedProblem => {
  return {
    id: crypto.randomUUID() as UUID,
    type: "open-ended",
    difficulty: "medium",
    questionContent: "",
    correctAnswer: "",
  };
};

const ProblemsManager = () => {
  const [problems, setProblems] = useState<Problem[]>([]);

  const handleAddMultipleChoiceProblem = () => {
    setProblems([...problems, createMultipleChoiceProblem()]);
  };

  const handleAddOpenEndedProblem = () => {
    setProblems([...problems, createOpenEndedProblem()]);
  };

  const setNewQuestionContent = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
    id: UUID
  ) => {
    event.preventDefault();

    const updatedProblems = problems.map((problem) => {
      if (problem.id === id) {
        return {
          ...problem,
          questionContent: event.target.value,
        };
      }
      return problem;
    });

    setProblems(updatedProblems);
    console.log(updatedProblems);
  };

  const setNewOption = (
    event: React.ChangeEvent<HTMLInputElement>,
    id: UUID,
    index: number
  ) => {
    event.preventDefault();

    const updatedProblems = problems.map((problem) => {
      if (problem.id === id && problem.type === "multiple choice") {
        const newOptions = [...problem.options];
        newOptions[index] = event.target.value;

        return {
          ...problem,
          options: newOptions,
        };
      }
      return problem;
    });

    setProblems(updatedProblems);
    console.log(updatedProblems);
  };

  const setNewCorrectChoice = (
    event: React.ChangeEvent<HTMLInputElement>,
    id: UUID
  ) => {
    event.preventDefault();

    const updatedProblems = problems.map((problem) => {
      if (problem.id === id && problem.type === "multiple choice") {
        return {
          ...problem,
          correctChoiceIndex: parseInt(event.target.value),
        };
      }
      return problem;
    });

    setProblems(updatedProblems);
    console.log(updatedProblems);
  };

  const setNewCorrectAnswer = (
    event: React.ChangeEvent<HTMLInputElement>,
    id: UUID
  ) => {
    event.preventDefault();

    const updatedProblems = problems.map((problem) => {
      if (problem.id === id && problem.type === "open-ended") {
        return {
          ...problem,
          correctAnswer: event.target.value,
        };
      }
      return problem;
    });

    setProblems(updatedProblems);
    console.log(updatedProblems);
  };

  return (
    <div>
      <Button variant="contained">Generate with AI</Button>
      <div className="flex">
        <Button onClick={handleAddMultipleChoiceProblem}>
          Add Multiple Choice Problem
        </Button>
        <Button onClick={handleAddOpenEndedProblem}>
          Add Open-Ended Problem
        </Button>
      </div>
      <div>
        {problems.map((problem, index) =>
          problem.type === "multiple choice" ? (
            // TODO: Create ProblemEdit components
            <MultipleChoiceProblemEdit
              key={index}
              problem={problem}
              setQuestionContent={setNewQuestionContent}
              setOption={setNewOption}
              setCorrectChoice={setNewCorrectChoice}
            />
          ) : (
            <OpenEndedProblemEdit
              key={index}
              problem={problem}
              setQuestionContent={setNewQuestionContent}
              setCorrectAnswer={setNewCorrectAnswer}
            />
          )
        )}
      </div>
    </div>
  );
};

export default ProblemsManager;
