import Link from "next/link";
import { CheckCircle2, Lock } from "lucide-react";

import { ProblemListItem } from "@/app/types";
import { ProblemSessionState } from "@/app/queries/sessions";
import { getProblemCtaLabel, getProblemPhaseLabel } from "@/app/tutor/assignmentProgress";
import { Card, CardContent } from "@/app/components/ui/card";
import EmptyProblemList from "@/app/courses/[courseId]/assignments/[assignmentId]/EmptyProblemList";

interface StudentProblemListProps {
  problems: ProblemListItem[];
  /** Per-problem session state, keyed by problem id. */
  statuses: Record<string, ProblemSessionState>;
  /** The one problem the student should work next, or null once everything's done. */
  activeProblemId: string | null;
}

const StudentProblemList = ({
  problems,
  statuses,
  activeProblemId,
}: StudentProblemListProps) => {
  if (problems.length === 0) {
    return <EmptyProblemList />;
  }

  return (
    <div className="space-y-3">
      {problems.map((problem) => {
        const sessionState = statuses[problem.id];
        const isCompleted = sessionState?.status === "completed";
        const isActive = problem.id === activeProblemId;
        const isLocked = !isCompleted && !isActive;
        // A locked row never shows live progress, even if its underlying
        // session state says otherwise (e.g. a session somehow exists for a
        // problem past the current one) — the lock icon is the whole story.
        const phaseLabel = isLocked
          ? "Not started"
          : getProblemPhaseLabel(sessionState);
        const ctaLabel = getProblemCtaLabel(sessionState, isActive);

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
                <span className="text-xs text-gray-500">{phaseLabel}</span>
                {ctaLabel && (
                  <Link
                    href={`/tutor/${problem.id}`}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {ctaLabel}
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default StudentProblemList;
