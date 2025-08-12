import { MultipleChoiceProblem } from "@/app/types";
import { UUID } from "crypto";
import React from "react";

interface MultipleChoiceProblemEditProps {
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
    <div className="bg-white rounded-lg border-2 border-red-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-sm font-medium text-gray-700">Multiple Choice</span>
          </div>
          <div className="h-4 w-px bg-gray-300"></div>
          <select className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500">
            <option value="easy">Easy</option>
            <option value="medium" selected>Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Question Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="font-semibold text-gray-900">Question</h3>
          </div>
          
          <div className="relative">
            <textarea
              value={problem.questionContent}
              onChange={(event) => setQuestionContent(event, problem.id)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
              placeholder="Enter your question here... (e.g., What is 2 + 2?)"
              rows={4}
            />
            <div className="absolute bottom-3 right-3 text-xs text-gray-400">
              {problem.questionContent.length}/500
            </div>
          </div>

          {/* Question Preview */}
          {problem.questionContent.trim() && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="text-xs font-medium text-gray-500 mb-2">PREVIEW:</div>
              <div className="text-gray-800">{problem.questionContent}</div>
            </div>
          )}
        </div>

        {/* Options Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <h3 className="font-semibold text-gray-900">Answer Choices</h3>
            </div>
            
            <div className="text-xs text-gray-500 bg-yellow-100 px-2 py-1 rounded flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Select the correct answer
            </div>
          </div>
          
          <div className="space-y-3">
            {problem.options.map((option, index) => (
              <div 
                key={index} 
                className={`flex items-center gap-3 p-3 border-2 rounded-lg transition-all duration-200 ${
                  index === problem.correctChoiceIndex 
                    ? 'border-green-300 bg-green-50' 
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                {/* Option Letter */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  index === problem.correctChoiceIndex
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {String.fromCharCode(65 + index)}
                </div>

                {/* Option Input */}
                <input
                  type="text"
                  value={option}
                  onChange={(event) => setOption(event, problem.id, index)}
                  className={`flex-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                    index === problem.correctChoiceIndex
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-300 bg-white'
                  }`}
                  placeholder={`Option ${String.fromCharCode(65 + index)}`}
                />

                {/* Correct Answer Radio */}
                <div className="flex items-center">
                  <input
                    type="radio"
                    checked={index === problem.correctChoiceIndex}
                    onChange={(event) => setCorrectChoice(event, problem.id)}
                    value={index}
                    name={`correct-choice-${problem.id}`}
                    className="w-5 h-5 text-green-600 border-2 border-gray-300 focus:ring-green-500 focus:ring-2"
                  />
                  <label className="ml-2 text-sm text-gray-600">
                    {index === problem.correctChoiceIndex ? 'Correct' : 'Mark as correct'}
                  </label>
                </div>
              </div>
            ))}
          </div>

          {/* Add/Remove Options */}
          <div className="flex gap-2 pt-2">
            <button 
              className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1 px-3 py-1 rounded hover:bg-red-50 transition-colors"
              onClick={() => {
                // TODO: Add option functionality
                console.log('Add option clicked')
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Option
            </button>
            
            {problem.options.length > 2 && (
              <button 
                className="text-gray-600 hover:text-gray-700 text-sm font-medium flex items-center gap-1 px-3 py-1 rounded hover:bg-gray-50 transition-colors"
                onClick={() => {
                  // TODO: Remove option functionality
                  console.log('Remove option clicked')
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
                Remove Option
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 text-sm text-gray-500">
        <div className="flex items-center gap-4">
          <span>Options: {problem.options.length}</span>
          <span>Correct: {String.fromCharCode(65 + problem.correctChoiceIndex)}</span>
          <span>Difficulty: {problem.difficulty}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            problem.questionContent.trim() && problem.options.every(opt => opt.trim()) 
              ? 'bg-green-500' 
              : 'bg-yellow-500'
          }`}></div>
          <span className="text-xs">
            {problem.questionContent.trim() && problem.options.every(opt => opt.trim()) 
              ? 'Ready' 
              : 'Incomplete'
            }
          </span>
        </div>
      </div>
    </div>
  );
};

export default MultipleChoiceProblemEdit;