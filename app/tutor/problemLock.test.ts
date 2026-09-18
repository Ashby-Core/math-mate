import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const m = vi.hoisted(() => ({
  getProblemsByAssignment: vi.fn(),
  getSessionStatusesByAssignment: vi.fn(),
}));

vi.mock("@/app/queries/problems", () => ({
  getProblemsByAssignment: m.getProblemsByAssignment,
}));
vi.mock("@/app/queries/sessions", () => ({
  getSessionStatusesByAssignment: m.getSessionStatusesByAssignment,
}));

import { isProblemUnlocked } from "./problemLock";

const supabase = {} as SupabaseClient;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isProblemUnlocked", () => {
  it("unlocks the earliest problem without a completed session", async () => {
    m.getProblemsByAssignment.mockResolvedValue([
      { id: "p1", orderIndex: 0, topics: [] },
      { id: "p2", orderIndex: 1, topics: [] },
    ]);
    m.getSessionStatusesByAssignment.mockResolvedValue({});

    expect(await isProblemUnlocked(supabase, "u1", "a1", "p1")).toBe(true);
    expect(await isProblemUnlocked(supabase, "u1", "a1", "p2")).toBe(false);
  });

  it("unlocks the next problem once the earlier one is completed", async () => {
    m.getProblemsByAssignment.mockResolvedValue([
      { id: "p1", orderIndex: 0, topics: [] },
      { id: "p2", orderIndex: 1, topics: [] },
    ]);
    m.getSessionStatusesByAssignment.mockResolvedValue({
      p1: { status: "completed", phase: "review" },
    });

    expect(await isProblemUnlocked(supabase, "u1", "a1", "p2")).toBe(true);
  });

  it("unlocks every problem once all are completed", async () => {
    m.getProblemsByAssignment.mockResolvedValue([
      { id: "p1", orderIndex: 0, topics: [] },
      { id: "p2", orderIndex: 1, topics: [] },
    ]);
    m.getSessionStatusesByAssignment.mockResolvedValue({
      p1: { status: "completed", phase: "review" },
      p2: { status: "completed", phase: "review" },
    });

    expect(await isProblemUnlocked(supabase, "u1", "a1", "p1")).toBe(true);
    expect(await isProblemUnlocked(supabase, "u1", "a1", "p2")).toBe(true);
  });

  it("fails closed (null) when the problems query errors, instead of unlocking everything", async () => {
    m.getProblemsByAssignment.mockResolvedValue(null);
    m.getSessionStatusesByAssignment.mockResolvedValue({});

    expect(await isProblemUnlocked(supabase, "u1", "a1", "p2")).toBeNull();
  });

  it("fails closed (null) when the statuses query errors, instead of wrongly relocking", async () => {
    m.getProblemsByAssignment.mockResolvedValue([
      { id: "p1", orderIndex: 0, topics: [] },
      { id: "p2", orderIndex: 1, topics: [] },
    ]);
    m.getSessionStatusesByAssignment.mockResolvedValue(null);

    expect(await isProblemUnlocked(supabase, "u1", "a1", "p2")).toBeNull();
  });
});
