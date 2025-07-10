import { UUID } from "crypto";
import { Timestamp } from "next/dist/server/lib/cache-handlers/types";

export type Profile = {
    firstName: string,
    lastName: string,
    username: string,
    school?: string,
    gradeLevel?: number,
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
    createdAt: Timestamp,
    course: UUID,
    title: string,
    dueDate: Date,
}

export type Enrollment = {
    id: number,
    student: UUID,
    course: UUID,
}