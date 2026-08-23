import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testSupabase";
import type { TutoringState } from "@/app/tutor/stateMachine";
import {
  createSession,
  getActiveSession,
  getCompletedSession,
  getSessionById,
  setCompletionSummary,
  updateSessionState,
} from "./sessions";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const gaps = [{ topicId: "t1", name: "Adding Fractions", resolved: false }];

describe("getActiveSession", () => {
  it("returns the row reduced to its persisted state", async () => {
    const { client } = fakeSupabase({
      data: [
        {
          id: "s1",
          phase: "gap_check",
          status: "active",
          gap_state: { gaps },
          solve_attempt_recorded: true,
        },
      ],
      error: null,
    });
    expect(await getActiveSession(client, "u1", "p1")).toEqual({
      id: "s1",
      phase: "gap_check",
      status: "active",
      gapState: { gaps },
      solveAttemptRecorded: true,
      completionSummary: null,
    });
  });

  it("defaults gapState to an empty gaps list when the column is null", async () => {
    const { client } = fakeSupabase({
      data: [{ id: "s1", phase: "intro", status: "active", gap_state: null }],
      error: null,
    });
    const row = await getActiveSession(client, "u1", "p1");
    expect(row?.gapState).toEqual({ gaps: [] });
  });

  it("defaults solveAttemptRecorded to false when the column is missing (legacy row)", async () => {
    const { client } = fakeSupabase({
      data: [{ id: "s1", phase: "intro", status: "active", gap_state: null }],
      error: null,
    });
    const row = await getActiveSession(client, "u1", "p1");
    expect(row?.solveAttemptRecorded).toBe(false);
  });

  it("returns null when there is no active row", async () => {
    const { client } = fakeSupabase({ data: [], error: null });
    expect(await getActiveSession(client, "u1", "p1")).toBeNull();
  });

  it("returns null on error", async () => {
    const { client } = fakeSupabase({
      data: null,
      error: { message: "boom" },
    });
    expect(await getActiveSession(client, "u1", "p1")).toBeNull();
  });
});

describe("getCompletedSession", () => {
  it("returns the row reduced to its persisted state, including the summary", async () => {
    const { client } = fakeSupabase({
      data: [
        {
          id: "s1",
          phase: "review",
          status: "completed",
          gap_state: { gaps },
          solve_attempt_recorded: true,
          completion_summary: "Nicely done — recap.",
        },
      ],
      error: null,
    });
    expect(await getCompletedSession(client, "u1", "p1")).toEqual({
      id: "s1",
      phase: "review",
      status: "completed",
      gapState: { gaps },
      solveAttemptRecorded: true,
      completionSummary: "Nicely done — recap.",
    });
  });

  it("defaults completionSummary to null when the column is null", async () => {
    const { client } = fakeSupabase({
      data: [
        {
          id: "s1",
          phase: "review",
          status: "completed",
          gap_state: { gaps },
          solve_attempt_recorded: true,
          completion_summary: null,
        },
      ],
      error: null,
    });
    const row = await getCompletedSession(client, "u1", "p1");
    expect(row?.completionSummary).toBeNull();
  });

  it("returns null when there is no completed row", async () => {
    const { client } = fakeSupabase({ data: [], error: null });
    expect(await getCompletedSession(client, "u1", "p1")).toBeNull();
  });

  it("returns null on error", async () => {
    const { client } = fakeSupabase({
      data: null,
      error: { message: "boom" },
    });
    expect(await getCompletedSession(client, "u1", "p1")).toBeNull();
  });
});

describe("getSessionById", () => {
  it("includes the owning student and problem ids", async () => {
    const { client } = fakeSupabase({
      data: {
        id: "s1",
        student_id: "u1",
        problem_id: "p1",
        phase: "solve",
        status: "active",
        gap_state: { gaps },
        solve_attempt_recorded: true,
      },
      error: null,
    });
    expect(await getSessionById(client, "s1")).toEqual({
      id: "s1",
      studentId: "u1",
      problemId: "p1",
      phase: "solve",
      status: "active",
      gapState: { gaps },
      solveAttemptRecorded: true,
      completionSummary: null,
    });
  });

  it("returns null when not found", async () => {
    const { client } = fakeSupabase({ data: null, error: null });
    expect(await getSessionById(client, "s1")).toBeNull();
  });

  it("returns null on error", async () => {
    const { client } = fakeSupabase({
      data: null,
      error: { message: "boom" },
    });
    expect(await getSessionById(client, "s1")).toBeNull();
  });
});

describe("createSession", () => {
  const state: TutoringState = {
    phase: "intro",
    status: "active",
    gaps,
    solveAttemptRecorded: false,
  };

  it("inserts the persisted state and returns the new id", async () => {
    const { client, chains } = fakeSupabase({ data: { id: "s-new" }, error: null });
    const result = await createSession(client, {
      studentId: "u1",
      problemId: "p1",
      state,
    });
    expect(result).toEqual({ id: "s-new" });
    expect(chains[0].insert).toHaveBeenCalledWith(
      expect.objectContaining({
        student_id: "u1",
        problem_id: "p1",
        phase: "intro",
        status: "active",
        gap_state: { gaps },
        solve_attempt_recorded: false,
      }),
    );
  });

  it("signals a conflict on a unique-violation (23505)", async () => {
    const { client } = fakeSupabase({
      data: null,
      error: { code: "23505", message: "duplicate" },
    });
    expect(
      await createSession(client, { studentId: "u1", problemId: "p1", state }),
    ).toEqual({ conflict: true });
  });

  it("returns null on any other error", async () => {
    const { client } = fakeSupabase({
      data: null,
      error: { code: "500", message: "boom" },
    });
    expect(
      await createSession(client, { studentId: "u1", problemId: "p1", state }),
    ).toBeNull();
  });
});

describe("updateSessionState", () => {
  const state: TutoringState = {
    phase: "review",
    status: "completed",
    gaps,
    solveAttemptRecorded: true,
  };

  it("persists the latest state and returns true", async () => {
    const { client, chains } = fakeSupabase({ error: null });
    expect(await updateSessionState(client, "s1", state)).toBe(true);
    expect(chains[0].update).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "review",
        status: "completed",
        gap_state: { gaps },
        solve_attempt_recorded: true,
      }),
    );
    expect(chains[0].eq).toHaveBeenCalledWith("id", "s1");
  });

  it("returns false on error", async () => {
    const { client } = fakeSupabase({ error: { message: "boom" } });
    expect(await updateSessionState(client, "s1", state)).toBe(false);
  });
});

describe("setCompletionSummary", () => {
  it("persists the summary and returns true", async () => {
    const { client, chains } = fakeSupabase({ error: null });
    expect(
      await setCompletionSummary(client, "s1", "Nicely done — recap."),
    ).toBe(true);
    expect(chains[0].update).toHaveBeenCalledWith({
      completion_summary: "Nicely done — recap.",
    });
    expect(chains[0].eq).toHaveBeenCalledWith("id", "s1");
  });

  it("returns false on error", async () => {
    const { client } = fakeSupabase({ error: { message: "boom" } });
    expect(await setCompletionSummary(client, "s1", "recap")).toBe(false);
  });
});
