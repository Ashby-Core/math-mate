import { describe, expect, it } from "vitest";
import type { UUID } from "crypto";
import { inferMisconception } from "./claude";

// Placeholder pipeline (MI-1): always resolves null until the real Haiku call
// lands. These tests pin the contract callers depend on today.
describe("inferMisconception", () => {
  const input = {
    problem: {
      id: "p1" as UUID,
      questionContent: "What is 3/4 + 1/8?",
      correctAnswer: "7/8",
      orderIndex: 0,
      tops: ["t1" as UUID],
    },
    correctAnswer: "7/8",
    studentAnswer: "4/12",
    topicId: "t1",
  };

  it("resolves to null for any input", async () => {
    await expect(inferMisconception(input)).resolves.toBeNull();
  });
});
