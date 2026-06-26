import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testSupabase";
import { getAssignmentsByCourse } from "./assignments";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const row = {
  id: "a1",
  course: "c1",
  title: "Fractions",
  description: "Add fractions",
  due_date: "2026-07-01",
  difficulty: "easy",
  created_at: "2026-06-01T00:00:00Z",
};

describe("getAssignmentsByCourse", () => {
  it("maps snake_case rows to the Assignment shape", async () => {
    const { client } = fakeSupabase({ data: [row], error: null });
    const result = await getAssignmentsByCourse(client, "c1");
    expect(result).toEqual([
      {
        id: "a1",
        courseId: "c1",
        title: "Fractions",
        description: "Add fractions",
        dueDate: "2026-07-01",
        difficulty: "easy",
        createdAt: "2026-06-01T00:00:00Z",
      },
    ]);
  });

  it("filters by the given course id", async () => {
    const { client, chains } = fakeSupabase({ data: [], error: null });
    await getAssignmentsByCourse(client, "c1");
    expect(chains[0].eq).toHaveBeenCalledWith("course", "c1");
  });

  it("returns [] on error", async () => {
    const { client } = fakeSupabase({ data: null, error: { message: "boom" } });
    expect(await getAssignmentsByCourse(client, "c1")).toEqual([]);
  });

  it("returns [] when there are no assignments", async () => {
    const { client } = fakeSupabase({ data: [], error: null });
    expect(await getAssignmentsByCourse(client, "c1")).toEqual([]);
  });
});
