"use client";

import { MultipleChoiceProblem, OpenEndedProblem, Problem } from "@/app/types";
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
  };

  const deleteProblem = (id: UUID) => {
    setProblems(problems.filter((problem) => problem.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-6 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 font-medium shadow-md flex items-center justify-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          Generate with AI
        </button>

        <div className="flex gap-3">
          <button
            onClick={handleAddMultipleChoiceProblem}
            className="bg-red-600 text-white py-3 px-6 rounded-lg hover:bg-red-700 transition-colors font-medium shadow-sm flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Multiple Choice
          </button>

          <button
            onClick={handleAddOpenEndedProblem}
            className="bg-white border-2 border-red-600 text-red-600 py-3 px-6 rounded-lg hover:bg-red-50 transition-colors font-medium shadow-sm flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Open-Ended
          </button>
        </div>
      </div>

      {/* Problems List */}
      <div className="space-y-4">
        {problems.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-gray-400 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No problems yet
            </h3>
            <p className="text-gray-500 mb-6">
              Start by adding your first problem or generate some with AI
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleAddMultipleChoiceProblem}
                className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors font-medium text-sm"
              >
                Add Multiple Choice
              </button>
              <button
                onClick={handleAddOpenEndedProblem}
                className="border border-red-600 text-red-600 py-2 px-4 rounded-md hover:bg-red-50 transition-colors font-medium text-sm"
              >
                Add Open-Ended
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Problems Header */}
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Problems ({problems.length})
                </h3>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-500 rounded"></div>
                    Multiple Choice:{" "}
                    {
                      problems.filter((p) => p.type === "multiple choice")
                        .length
                    }
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    Open-Ended:{" "}
                    {problems.filter((p) => p.type === "open-ended").length}
                  </span>
                </div>
              </div>

              {problems.length > 0 && (
                <button
                  onClick={() => setProblems([])}
                  className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Clear All
                </button>
              )}
            </div>

            {/* Problems */}
            {problems.map((problem, index) => (
              <div key={problem.id} className="relative group">
                {/* Problem Number Badge */}
                <div className="absolute -left-3 top-6 z-10">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      problem.type === "multiple choice"
                        ? "bg-red-500"
                        : "bg-blue-500"
                    }`}
                  >
                    {index + 1}
                  </div>
                </div>

                {/* Delete Button */}
                <button
                  onClick={() => deleteProblem(problem.id)}
                  className="absolute -right-3 top-6 z-10 w-8 h-8 bg-red-100 hover:bg-red-200 text-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-sm"
                  title="Delete problem"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>

                {/* Problem Content */}
                <div className="ml-8 mr-8">
                  {problem.type === "multiple choice" ? (
                    <MultipleChoiceProblemEdit
                      problem={problem}
                      setQuestionContent={setNewQuestionContent}
                      setOption={setNewOption}
                      setCorrectChoice={setNewCorrectChoice}
                      key={0}
                    />
                  ) : (
                    <OpenEndedProblemEdit
                      problem={problem}
                      setQuestionContent={setNewQuestionContent}
                      setCorrectAnswer={setNewCorrectAnswer}
                      key={0}
                    />
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default ProblemsManager;
