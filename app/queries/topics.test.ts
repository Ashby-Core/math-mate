import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testSupabase";
import { getTopicsByCourse } from "./topics";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const row = {
  id: "t1",
  course_id: "c1",
  name: "Adding Fractions",
  created_at: "2026-06-01T00:00:00Z",
};

describe("getTopicsByCourse", () => {
  it("maps rows to the Topic shape", async () => {
    const { client } = fakeSupabase({ data: [row], error: null });
    expect(await getTopicsByCourse(client, "c1")).toEqual([
      {
        id: "t1",
        courseId: "c1",
        name: "Adding Fractions",
        createdAt: "2026-06-01T00:00:00Z",
      },
    ]);
  });

  it("scopes the query to the course id", async () => {
    const { client, chains } = fakeSupabase({ data: [], error: null });
    await getTopicsByCourse(client, "c1");
    expect(chains[0].eq).toHaveBeenCalledWith("course_id", "c1");
  });

  it("returns [] on error", async () => {
    const { client } = fakeSupabase({
      data: null,
      error: { message: "boom" },
    });
    expect(await getTopicsByCourse(client, "c1")).toEqual([]);
  });
});
