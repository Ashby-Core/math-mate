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
  name: string;
  masteryScore: number;
  problemsAttempted: number;
  problemsCorrect: number;
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

export type CreateAssignmentInput = {
  courseId: UUID;
  title: string;
  dueDate: Date;
  description: string;
  problems: Problem[];
};
