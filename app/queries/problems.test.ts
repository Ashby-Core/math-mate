import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProblemById } from "./problems";

// Minimal fake of the supabase query chain `.from().select().eq().single()`.
function fakeSupabase(result: { data: unknown; error: unknown }) {
  const single = vi.fn(async () => result);
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { from } as unknown as SupabaseClient;
}

const row = {
  id: "p1",
  question_content: "What is 3/4 + 1/8?",
  correct_answer: "7/8",
  order_index: 2,
  assignments: { course: "c1" },
  problems_topics: [{ topic_id: "t1" }, { topic_id: "t2" }],
};

describe("getProblemById", () => {
  it("maps the row to { problem, courseId } with tops from the join", async () => {
    const supabase = fakeSupabase({ data: row, error: null });
    const result = await getProblemById(supabase, "p1");
    expect(result).toEqual({
      problem: {
        id: "p1",
        questionContent: "What is 3/4 + 1/8?",
        correctAnswer: "7/8",
        orderIndex: 2,
        tops: ["t1", "t2"],
      },
      courseId: "c1",
    });
  });

  it("handles the assignments embed arriving as an array", async () => {
    const supabase = fakeSupabase({
      data: { ...row, assignments: [{ course: "c1" }] },
      error: null,
    });
    const result = await getProblemById(supabase, "p1");
    expect(result?.courseId).toBe("c1");
  });

  it("returns null on a query error", async () => {
    const supabase = fakeSupabase({ data: null, error: { message: "boom" } });
    expect(await getProblemById(supabase, "p1")).toBeNull();
  });

  it("returns null when the course can't be resolved", async () => {
    const supabase = fakeSupabase({
      data: { ...row, assignments: null },
      error: null,
    });
    expect(await getProblemById(supabase, "p1")).toBeNull();
  });
});
