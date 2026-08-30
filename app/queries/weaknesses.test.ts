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
  // The increment itself is one atomic SQL statement via the
  // increment_weakness RPC (migration 0006) rather than a JS read-modify-write
  // — that's what makes it safe under concurrent calls for the same row. The
  // follow-up .from() select is only there to fetch the topic name for the
  // return shape.
  it("calls the increment_weakness RPC and maps the updated row", async () => {
    const { client, rpc, chains } = fakeSupabase(
      { data: [{ ...weaknessRow, observed_count: 3, topics: undefined }], error: null },
      { data: { ...weaknessRow, observed_count: 3 }, error: null },
    );

    const result = await incrementWeakness(client, "w1");

    expect(rpc).toHaveBeenCalledWith("increment_weakness", { p_weakness_id: "w1" });
    expect(chains[1].eq).toHaveBeenCalledWith("id", "w1");
    expect(result?.observedCount).toBe(3);
  });

  it("returns null when the RPC errors", async () => {
    const { client } = fakeSupabase({ data: null, error: { message: "boom" } });
    expect(await incrementWeakness(client, "w1")).toBeNull();
  });

  it("returns null when the RPC's setof result is empty (no row matched)", async () => {
    const { client } = fakeSupabase({ data: [], error: null });
    expect(await incrementWeakness(client, "w1")).toBeNull();
  });

  it("returns null when the follow-up fetch fails", async () => {
    const { client } = fakeSupabase(
      { data: [{ ...weaknessRow, observed_count: 3 }], error: null },
      { data: null, error: { message: "boom" } },
    );
    expect(await incrementWeakness(client, "w1")).toBeNull();
  });
});
