"use client";

import { Problem, Topic } from "@/app/types";
import React from "react";
import { UUID } from "crypto";
import { Pencil, FileText, Trash2, X } from "lucide-react";
import ProblemEdit from "./ProblemEdit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ProblemsManagerProps {
  topics: Topic[];
  problems: Problem[];
  setProblems: React.Dispatch<React.SetStateAction<Problem[]>>;
}

const ProblemsManager = ({
  topics,
  problems,
  setProblems,
}: ProblemsManagerProps) => {
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
    id: UUID,
  ) => {
    event.preventDefault();
    const updatedProblems = problems.map((problem) =>
      problem.id === id
        ? { ...problem, questionContent: event.target.value }
        : problem,
    );
    setProblems(updatedProblems);
  };

  const setNewCorrectAnswer = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
    id: UUID,
  ) => {
    event.preventDefault();
    const updatedProblems = problems.map((problem) =>
      problem.id === id
        ? { ...problem, correctAnswer: event.target.value }
        : problem,
    );
    setProblems(updatedProblems);
  };

  const deleteProblem = (id: UUID) => {
    setProblems(problems.filter((problem) => problem.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <Button
        type="button"
        variant="outline"
        onClick={handleAddProblem}
        className="w-full border-2 border-red-600 text-red-600 hover:bg-red-50 hover:text-red-600 py-3"
      >
        <Pencil />
        Create
      </Button>

      {/* Problems List */}
      <div className="space-y-4">
        {problems.length === 0 ? (
          <Card className="bg-gray-50 ring-0 border-2 border-dashed border-gray-300">
            <CardContent className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <FileText className="size-10 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No problems yet
              </h3>
              <div className="flex justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddProblem}
                  className="border-red-600 text-red-600 hover:bg-red-50 hover:text-red-600"
                >
                  Add Question
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Problems Header */}
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Problems ({problems.length})
              </h3>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setProblems([])}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 />
                Clear All
              </Button>
            </div>

            {/* Problems */}
            {problems.map((problem, index) => (
              <div key={problem.id} className="relative group">
                {/* Problem Number Badge */}
                <div className="absolute -left-3 top-6 z-10">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold bg-red-500">
                    {index + 1}
                  </div>
                </div>

                {/* Delete Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => deleteProblem(problem.id)}
                  className="absolute -right-3 top-6 z-10 bg-red-100 hover:bg-red-200 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete problem"
                >
                  <X />
                </Button>

                {/* Problem Content */}
                <div className="ml-8 mr-8">
                  <ProblemEdit
                    problem={problem}
                    setQuestionContent={setNewQuestionContent}
                    setCorrectAnswer={setNewCorrectAnswer}
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
