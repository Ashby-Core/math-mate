import { UUID } from "crypto";
import { Timestamp } from "next/dist/server/lib/cache-handlers/types";

export type Profile = {
    firstName: string,
    lastName: string,
    username: string,
}

export type Course = {
    id: UUID,
    createdAt: Timestamp,
    teacher: UUID,
    name: string,
    code: string,
}

export type Assignment = {
    id: UUID,
    courseId: UUID,
    title: string,
    description: string,
    dueDate: Date,
    difficulty: 'easy' | 'medium' | 'hard'
    createdAt: Timestamp
    // TODO: For gamification, add 'points', which will be of type number
}

export type Enrollment = {
    id: number,
    student: UUID,
    course: UUID,
}

export type TopicMastery = {
    name: string,
    masteryScore: number,
    problemsAttempted: number,
    problemsCorrect: number,
}

export type Topic = {
    id: UUID,
    courseId: UUID,
    name: string,
    orderIndex: number,
    createdAt: Timestamp,
}

export type AssignmentTopic = {
    id: UUID,
    assignmentId: UUID,
    topicId: UUID,
    createdAt: Timestamp
}