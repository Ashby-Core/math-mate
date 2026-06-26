import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testSupabase";
import { getMasteries, updateMasteryCounts } from "./masteries";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getMasteries", () => {
  it("derives mastery as correct / attempted for attempted topics", async () => {
    const { client } = fakeSupabase({
      data: [
        {
          id: "t1",
          name: "Adding Fractions",
          student_topic_masteries: [
            { problems_attempted: 4, problems_correct: 3, student_id: "u1" },
          ],
        },
      ],
      error: null,
    });
    expect(await getMasteries(client, "u1", "c1")).toEqual([
      {
        topicId: "t1",
        name: "Adding Fractions",
        mastery: 0.75,
        problemsAttempted: 4,
        problemsCorrect: 3,
      },
    ]);
  });

  it("reports mastery null for an unattempted topic (LEFT join, no mastery row)", async () => {
    const { client } = fakeSupabase({
      data: [{ id: "t2", name: "Subtracting", student_topic_masteries: [] }],
      error: null,
    });
    expect(await getMasteries(client, "u1", "c1")).toEqual([
      {
        topicId: "t2",
        name: "Subtracting",
        mastery: null,
        problemsAttempted: 0,
        problemsCorrect: 0,
      },
    ]);
  });

  it("returns [] on error", async () => {
    const { client } = fakeSupabase({
      data: null,
      error: { message: "boom" },
    });
    expect(await getMasteries(client, "u1", "c1")).toEqual([]);
  });
});

describe("updateMasteryCounts", () => {
  // First .from() reads the existing counts; second performs the upsert.
  function fake(existing: unknown, upserted: unknown, upsertError?: unknown) {
    return fakeSupabase(
      { data: existing, error: null },
      { data: upserted, error: upsertError ?? null },
    );
  }

  it("increments attempted and correct for a correct attempt on an existing row", async () => {
    const { client, chains } = fake(
      { problems_attempted: 2, problems_correct: 1 },
      {
        topic_id: "t1",
        problems_attempted: 3,
        problems_correct: 2,
        topics: { name: "Adding Fractions" },
      },
    );

    const result = await updateMasteryCounts(client, "u1", "t1", true);

    expect(chains[1].upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        student_id: "u1",
        topic_id: "t1",
        problems_attempted: 3,
        problems_correct: 2,
      }),
      { onConflict: "student_id,topic_id" },
    );
    expect(result).toEqual({
      topicId: "t1",
      name: "Adding Fractions",
      mastery: 2 / 3,
      problemsAttempted: 3,
      problemsCorrect: 2,
    });
  });

  it("only increments attempted (not correct) for a wrong attempt", async () => {
    const { client, chains } = fake(
      { problems_attempted: 2, problems_correct: 1 },
      {
        topic_id: "t1",
        problems_attempted: 3,
        problems_correct: 1,
        topics: { name: "Adding Fractions" },
      },
    );

    await updateMasteryCounts(client, "u1", "t1", false);

    expect(chains[1].upsert).toHaveBeenCalledWith(
      expect.objectContaining({ problems_attempted: 3, problems_correct: 1 }),
      expect.anything(),
    );
  });

  it("starts counts from zero when no row exists yet", async () => {
    const { client, chains } = fake(null, {
      topic_id: "t1",
      problems_attempted: 1,
      problems_correct: 1,
      topics: { name: "Adding Fractions" },
    });

    await updateMasteryCounts(client, "u1", "t1", true);

    expect(chains[1].upsert).toHaveBeenCalledWith(
      expect.objectContaining({ problems_attempted: 1, problems_correct: 1 }),
      expect.anything(),
    );
  });

  it("normalizes the topics embed when it arrives as an array", async () => {
    const { client } = fake(null, {
      topic_id: "t1",
      problems_attempted: 1,
      problems_correct: 0,
      topics: [{ name: "Adding Fractions" }],
    });
    const result = await updateMasteryCounts(client, "u1", "t1", false);
    expect(result?.name).toBe("Adding Fractions");
  });

  it("returns null on upsert error", async () => {
    const { client } = fake({ problems_attempted: 0, problems_correct: 0 }, null, {
      message: "boom",
    });
    expect(await updateMasteryCounts(client, "u1", "t1", true)).toBeNull();
  });
});
