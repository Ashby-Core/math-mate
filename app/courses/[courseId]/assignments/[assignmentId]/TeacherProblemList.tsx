import { CircleCheck, CircleHelp } from "lucide-react";

import { TeacherProblemListItem } from "@/app/types";
import { Card, CardContent } from "@/app/components/ui/card";
import EmptyProblemList from "@/app/courses/[courseId]/assignments/[assignmentId]/EmptyProblemList";

interface TeacherProblemListProps {
  problems: TeacherProblemListItem[];
}

const TeacherProblemList = ({ problems }: TeacherProblemListProps) => {
  if (problems.length === 0) {
    return <EmptyProblemList />;
  }

  return (
    <div className="space-y-4">
      {problems.map((problem) => (
        <Card key={problem.id}>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-gray-900">
                Problem {problem.orderIndex + 1}
              </p>
              {problem.topics.length > 0 && (
                <p className="text-xs text-gray-500">
                  {problem.topics.map((topic) => topic.name).join(", ")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <CircleHelp className="size-4" />
                Question
              </div>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">
                {problem.questionContent}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <CircleCheck className="size-4" />
                Expected Answer
              </div>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">
                {problem.correctAnswer}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default TeacherProblemList;
