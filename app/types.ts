import { UUID } from "crypto";
import { Timestamp } from "next/dist/server/lib/cache-handlers/types";

export type Profile = {
  id: UUID;
  firstName: string;
  lastName: string;
  username: string;
  userRole: "teacher" | "student";
};

export type Course = {
  id: UUID;
  createdAt: Timestamp;
  teacher: UUID;
  name: string;
  code: string;
};

export type Assignment = {
  id: UUID;
  courseId: UUID;
  title: string;
  description: string;
  dueDate: Date;
  difficulty: "easy" | "medium" | "hard";
  createdAt: Timestamp;
  // TODO: For gamification, add 'points', which will be of type number
};

export type Enrollment = {
  id: number;
  student: UUID;
  course: UUID;
};

export type TopicMastery = {
  topicId: UUID;
  name: string;
  mastery: number | null; // derived: attempted > 0 ? correct / attempted : null
  problemsAttempted: number;
  problemsCorrect: number;
};

export type TopicWeakness = {
  id: UUID;
  topicId: UUID;
  name: string;
  description: string;
  observedCount: number;
  lastObserved: Timestamp;
};

export type TutoringSession = {
  id: UUID;
  studentId: UUID;
  problemId: UUID;
  phase: "intro" | "gap_check" | "solve" | "review";
  gapState: Record<string, unknown>;
  status: "active" | "completed" | "abandoned";
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// Knowledge profile injected into the tutoring system prompt. Keyed by topic
// id; each value carries the human-readable name so the model can name topics.
export type TopicMasteryEntry = { name: string; mastery: number | null };
export type TopicWeaknessEntry = { name: string; items: string[] };

export type StudentProfile = {
  courseName: string;
  student: { id: string; name: string };
  topicMasteryScores: Record<string, TopicMasteryEntry>;
  weaknesses: Record<string, TopicWeaknessEntry>;
};

export type Topic = {
  id: UUID;
  courseId: UUID;
  name: string;
  createdAt: Timestamp;
};

export interface Problem {
  id: UUID;
  questionContent: string;
  correctAnswer: string;
  orderIndex: number;
  tops: UUID[];
}

// A problem as shown in an assignment's problem list. Deliberately omits
// `questionContent` and `correctAnswer`
// (must never reach the client). Topics are named so the list can preview
// what a problem practices without revealing the problem itself.
export type ProblemListItem = {
  id: UUID;
  orderIndex: number;
  topics: { id: UUID; name: string }[];
};

// Per-problem tutoring status for a student, keyed by problem id. Absence of a
// key means "not started" (no session row yet).
export type ProblemStatus = "active" | "completed" | "abandoned";

export type CreateAssignmentInput = {
  courseId: UUID;
  title: string;
  dueDate: Date;
  description: string;
  problems: Problem[];
};
