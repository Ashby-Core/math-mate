import { Problem } from "@/app/types";

// Claude-backed inference that feeds the student knowledge profile. For
// Milestone 2 the misconception pipeline is a no-op placeholder: the tutoring
// conversation handler (TS-3) calls it on every wrong answer, but it records
// nothing yet. MI-1 (Milestone 5) replaces the placeholder body with the real
// Haiku call and MI-3 wires the async write path.

export type MisconceptionInput = {
  problem: Problem;
  correctAnswer: string;
  studentAnswer: string;
  topicId: string;
};

export type InferMisconception = (
  input: MisconceptionInput,
) => Promise<string | null>;

/**
 * Infers a short misconception description from a wrong answer, or `null` when
 * the mistake is careless. Placeholder — always returns `null` until MI-1.
 */
export const inferMisconception: InferMisconception = async (_input) => null;
