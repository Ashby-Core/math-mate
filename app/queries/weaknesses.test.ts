import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testSupabase";
import {
  getWeaknesses,
  getWeaknessesForTopic,
  incrementWeakness,
  insertWeakness,
} from "./weaknesses";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const weaknessRow = {
  id: "w1",
  topic_id: "t1",
  description: "confuses numerator and denominator",
  observed_count: 2,
  last_observed: "2026-06-01T00:00:00Z",
  topics: { name: "Adding Fractions" },
};

const mappedWeakness = {
  id: "w1",
  topicId: "t1",
  name: "Adding Fractions",
  description: "confuses numerator and denominator",
  observedCount: 2,
  lastObserved: "2026-06-01T00:00:00Z",
};

describe("getWeaknesses", () => {
  it("maps rows to TopicWeakness, pulling the topic name from the join", async () => {
    const { client } = fakeSupabase({ data: [weaknessRow], error: null });
    expect(await getWeaknesses(client, "u1", "c1")).toEqual([mappedWeakness]);
  });

  it("normalizes the topics embed when it arrives as an array", async () => {
    const { client } = fakeSupabase({
      data: [{ ...weaknessRow, topics: [{ name: "Adding Fractions" }] }],
      error: null,
    });
    const result = await getWeaknesses(client, "u1", "c1");
    expect(result[0].name).toBe("Adding Fractions");
  });

  it("returns [] on error", async () => {
    const { client } = fakeSupabase({
      data: null,
      error: { message: "boom" },
    });
    expect(await getWeaknesses(client, "u1", "c1")).toEqual([]);
  });
});

describe("getWeaknessesForTopic", () => {
  it("maps rows to TopicWeakness, scoped by student and topic", async () => {
    const { client, chains } = fakeSupabase({ data: [weaknessRow], error: null });
    expect(await getWeaknessesForTopic(client, "u1", "t1")).toEqual([mappedWeakness]);
    expect(chains[0].eq).toHaveBeenCalledWith("student_id", "u1");
    expect(chains[0].eq).toHaveBeenCalledWith("topic_id", "t1");
  });

  it("returns [] on error", async () => {
    const { client } = fakeSupabase({
      data: null,
      error: { message: "boom" },
    });
    expect(await getWeaknessesForTopic(client, "u1", "t1")).toEqual([]);
  });
});

describe("insertWeakness", () => {
  it("inserts and maps the returned row", async () => {
    const { client } = fakeSupabase({ data: weaknessRow, error: null });
    expect(
      await insertWeakness(client, "u1", "t1", "confuses numerator and denominator"),
    ).toEqual(mappedWeakness);
  });

  it("truncates the description to 100 chars before insert", async () => {
    const { client, chains } = fakeSupabase({ data: weaknessRow, error: null });
    const long = "x".repeat(150);
    await insertWeakness(client, "u1", "t1", long);
    expect(chains[0].insert).toHaveBeenCalledWith(
      expect.objectContaining({ description: "x".repeat(100) }),
    );
  });

  it("returns null on error", async () => {
    const { client } = fakeSupabase({
      data: null,
      error: { message: "boom" },
    });
    expect(await insertWeakness(client, "u1", "t1", "x")).toBeNull();
  });
});

describe("incrementWeakness", () => {
  // First .from() reads observed_count; second updates it.
  it("bumps observed_count by one and maps the updated row", async () => {
    const { client, chains } = fakeSupabase(
      { data: { observed_count: 2 }, error: null },
      { data: { ...weaknessRow, observed_count: 3 }, error: null },
    );

    const result = await incrementWeakness(client, "w1");

    expect(chains[1].update).toHaveBeenCalledWith(
      expect.objectContaining({ observed_count: 3 }),
    );
    expect(result?.observedCount).toBe(3);
  });

  it("returns null when the weakness can't be fetched", async () => {
    const { client } = fakeSupabase({
      data: null,
      error: { message: "missing" },
    });
    expect(await incrementWeakness(client, "w1")).toBeNull();
  });

  it("returns null on update error", async () => {
    const { client } = fakeSupabase(
      { data: { observed_count: 2 }, error: null },
      { data: null, error: { message: "boom" } },
    );
    expect(await incrementWeakness(client, "w1")).toBeNull();
  });
});
