"use client";

import { Problem } from "@/app/types";
import React, { useState } from "react";
import { UUID } from "crypto";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import EditIcon from "@mui/icons-material/Edit";
import DescriptionIcon from '@mui/icons-material/Description';
import DeleteIcon from '@mui/icons-material/Delete';
import ClearIcon from '@mui/icons-material/Clear';
import ProblemEdit from "./ProblemEdit";

const ProblemsManager = () => {
  const [problems, setProblems] = useState<Problem[]>([]);

  const createProblem = (): Problem => {
    return {
      id: crypto.randomUUID() as UUID,
      questionContent: "",
      correctAnswer: "",
    };
  };

  const handleAddProblem = () => {
    setProblems([...problems, createProblem()]);
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

  const setNewCorrectAnswer = (
    event: React.ChangeEvent<HTMLInputElement>,
    id: UUID
  ) => {
    event.preventDefault();

    const updatedProblems = problems.map((problem) => {
      if (problem.id === id) {
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
      <div className="flex gap-3 justify-center">
        <button className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-6 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 font-medium shadow-md flex items-center justify-center gap-2 w-1/2">
          <LightbulbIcon />
          Generate with AI
        </button>
        <button
          onClick={handleAddProblem}
          className="bg-white border-2 border-red-600 text-red-600 py-3 px-6 rounded-lg hover:bg-red-50 transition-colors font-medium shadow-sm flex items-center justify-center gap-2 w-1/2"
        >
          <EditIcon />
          Manually Create
        </button>
      </div>

      {/* Problems List */}
      <div className="space-y-4">
        {problems.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-gray-400 mb-4">
              <DescriptionIcon fontSize="large" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No problems yet
            </h3>
            <p className="text-gray-500 mb-6">
              Start by adding your first problem or generate some with AI
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleAddProblem}
                className="border border-red-600 text-red-600 py-2 px-4 rounded-md hover:bg-red-50 transition-colors font-medium text-sm"
              >
                Add Question
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
              </div>

              {problems.length > 0 && (
                <button
                  onClick={() => setProblems([])}
                  className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                >
                  <DeleteIcon />
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
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold bg-red-500`}
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
                  <ClearIcon />
                </button>

                {/* Problem Content */}
                <div className="ml-8 mr-8">
                  <ProblemEdit
                    problem={problem}
                    setQuestionContent={setNewQuestionContent}
                    setCorrectAnswer={setNewCorrectAnswer}
                    key={0}
                  />
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
