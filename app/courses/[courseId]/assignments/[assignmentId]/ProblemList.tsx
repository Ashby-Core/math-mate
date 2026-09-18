import Link from "next/link";
import { CheckCircle2, FileQuestion, Lock } from "lucide-react";

import { ProblemListItem } from "@/app/types";
import { ProblemSessionState } from "@/app/queries/sessions";
import { getProblemPhaseLabel } from "@/app/tutor/assignmentProgress";
import { Card, CardContent } from "@/app/components/ui/card";

interface ProblemListProps {
  problems: ProblemListItem[];
  /** Per-problem session state, keyed by problem id. Empty for a teacher view. */
  statuses: Record<string, ProblemSessionState>;
  /** The one problem a student should work next, or null once everything's done. */
  activeProblemId: string | null;
  /** Whether to show phase labels and lock earlier/later rows (student view only). */
  showProgress: boolean;
}

const ProblemList = ({
  problems,
  statuses,
  activeProblemId,
  showProgress,
}: ProblemListProps) => {
  if (problems.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 mb-3">
          <FileQuestion className="w-12 h-12 mx-auto" />
        </div>
        <p className="text-gray-500 text-sm">
          No problems in this assignment yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {problems.map((problem) => {
        const sessionState = statuses[problem.id];
        const isCompleted = sessionState?.status === "completed";
        const isActive = problem.id === activeProblemId;
        const isLocked = showProgress && !isCompleted && !isActive;

        return (
          <Card
            key={problem.id}
            size="sm"
            className={isLocked ? "opacity-50" : "transition-colors"}
          >
            <CardContent className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {isLocked && (
                  <Lock className="w-4 h-4 text-gray-400 shrink-0" />
                )}
                {isCompleted && (
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">
                    Problem {problem.orderIndex + 1}
                  </p>
                  {problem.topics.length > 0 && (
                    <p className="text-xs text-gray-500 truncate">
                      {problem.topics.map((topic) => topic.name).join(", ")}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {showProgress && (
                  <span className="text-xs text-gray-500">
                    {getProblemPhaseLabel(sessionState)}
                  </span>
                )}
                {isCompleted ? (
                  <Link
                    href={`/tutor/${problem.id}`}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    Review
                  </Link>
                ) : (
                  (isActive || !showProgress) && (
                    <Link
                      href={`/tutor/${problem.id}`}
                      className="text-sm text-primary underline-offset-4 hover:underline"
                    >
                      Start
                    </Link>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default ProblemList;
