import { OpenEndedProblem } from "@/app/types";
import { UUID } from "crypto";
import React, { useState } from "react";

interface OpenEndedProblemEditProps {
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

const OpenEndedProblemEdit = ({
  problem,
  setQuestionContent,
  setCorrectAnswer,
}: OpenEndedProblemEditProps) => {
  const [acceptMultipleAnswers, setAcceptMultipleAnswers] = useState(false);
  const [answerType, setAnswerType] = useState<'text' | 'number' | 'equation'>('text');

  return (
    <div className="bg-white rounded-lg border-2 border-blue-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-sm font-medium text-gray-700">Open-Ended</span>
          </div>
          <div className="h-4 w-px bg-gray-300"></div>
          <select className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Enter your question here... (e.g., Explain how photosynthesis works)"
              rows={5}
            />
            <div className="absolute bottom-3 right-3 text-xs text-gray-400">
              {problem.questionContent.length}/1000
            </div>
          </div>

          {/* Question Preview */}
          {problem.questionContent.trim() && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="text-xs font-medium text-gray-500 mb-2">PREVIEW:</div>
              <div className="text-gray-800 whitespace-pre-wrap">{problem.questionContent}</div>
            </div>
          )}
        </div>

        {/* Answer Configuration Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="font-semibold text-gray-900">Answer Configuration</h3>
          </div>

          {/* Answer Type Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Answer Type</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'text', label: 'Text', icon: '📝' },
                { value: 'number', label: 'Number', icon: '🔢' },
                { value: 'equation', label: 'Equation', icon: '📐' }
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => setAnswerType(type.value as any)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    answerType === type.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span>{type.icon}</span>
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Correct Answer Input */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Expected Answer {answerType === 'number' && '(exact match)'}
            </label>
            
            {answerType === 'text' ? (
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
            ) : (
              <input
                type={answerType === 'number' ? 'number' : 'text'}
                value={problem.correctAnswer}
                onChange={(event) => setCorrectAnswer(event, problem.id)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={
                  answerType === 'number' 
                    ? "e.g., 42 or 3.14159" 
                    : "e.g., x = 2y + 5"
                }
              />
            )}
          </div>

          {/* Answer Options */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <label className="text-sm font-medium text-gray-700">Answer Options</label>
            
            {/* Case Sensitivity */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm text-gray-700">Case sensitive</span>
                <p className="text-xs text-gray-500">Answer must match exact capitalization</p>
              </div>
            </label>

            {/* Multiple Acceptable Answers */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptMultipleAnswers}
                onChange={(e) => setAcceptMultipleAnswers(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm text-gray-700">Multiple acceptable answers</span>
                <p className="text-xs text-gray-500">Allow variations of the correct answer</p>
              </div>
            </label>

            {/* Partial Credit */}
            {answerType === 'text' && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm text-gray-700">Allow partial credit</span>
                  <p className="text-xs text-gray-500">Credit for answers containing key elements</p>
                </div>
              </label>
            )}
          </div>

          {/* Alternative Answers */}
          {acceptMultipleAnswers && (
            <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-blue-900">Alternative Answers</label>
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Alternative
                </button>
              </div>
              <input
                type="text"
                className="w-full px-3 py-2 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter alternative acceptable answer..."
              />
            </div>
          )}
        </div>
      </div>

      {/* Footer Stats */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 text-sm text-gray-500">
        <div className="flex items-center gap-4">
          <span>Type: {answerType}</span>
          <span>Answer Length: {problem.correctAnswer.length}</span>
          <span>Difficulty: {problem.difficulty}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            problem.questionContent.trim() && problem.correctAnswer.trim()
              ? 'bg-green-500' 
              : 'bg-yellow-500'
          }`}></div>
          <span className="text-xs">
            {problem.questionContent.trim() && problem.correctAnswer.trim()
              ? 'Ready' 
              : 'Incomplete'
            }
          </span>
        </div>
      </div>
    </div>
  );
};

export default OpenEndedProblemEdit;