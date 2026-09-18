import { describe, expect, it } from "vitest";
import type { UUID } from "crypto";
import { ProblemListItem } from "@/app/types";
import { ProblemSessionState } from "@/app/queries/sessions";
import {
  getActiveProblemId,
  getProblemCtaLabel,
  getProblemPhaseLabel,
} from "./assignmentProgress";

function problem(id: string, orderIndex: number): ProblemListItem {
  return { id: id as UUID, orderIndex, topics: [] };
}

const problems = [problem("p1", 1), problem("p2", 2), problem("p3", 3)];

describe("getActiveProblemId", () => {
  it("returns the first problem when nothing has been started", () => {
    expect(getActiveProblemId(problems, {})).toBe("p1");
  });

  it("returns null when every problem is completed", () => {
    const statuses: Record<string, ProblemSessionState> = {
      p1: { status: "completed", phase: "review" },
      p2: { status: "completed", phase: "review" },
      p3: { status: "completed", phase: "review" },
    };
    expect(getActiveProblemId(problems, statuses)).toBeNull();
  });

  it("returns the first incomplete problem when there's a gap in the middle", () => {
    const statuses: Record<string, ProblemSessionState> = {
      p1: { status: "completed", phase: "review" },
      p3: { status: "completed", phase: "review" },
    };
    expect(getActiveProblemId(problems, statuses)).toBe("p2");
  });

  it("treats an active (in-progress) session as not yet completed", () => {
    const statuses: Record<string, ProblemSessionState> = {
      p1: { status: "active", phase: "solve" },
    };
    expect(getActiveProblemId(problems, statuses)).toBe("p1");
  });
});

describe("getProblemPhaseLabel", () => {
  it("labels a missing session as Not started", () => {
    expect(getProblemPhaseLabel(undefined)).toBe("Not started");
  });

  it("labels an intro-phase session as Not started", () => {
    expect(getProblemPhaseLabel({ status: "active", phase: "intro" })).toBe(
      "Not started",
    );
  });

  it("labels a gap_check-phase session as Gap check", () => {
    expect(
      getProblemPhaseLabel({ status: "active", phase: "gap_check" }),
    ).toBe("Gap check");
  });

  it("labels a solve-phase session as Solve", () => {
    expect(getProblemPhaseLabel({ status: "active", phase: "solve" })).toBe(
      "Solve",
    );
  });

  it("labels an active review-phase session as Solve", () => {
    expect(getProblemPhaseLabel({ status: "active", phase: "review" })).toBe(
      "Solve",
    );
  });

  it("labels a completed session as Completed regardless of phase", () => {
    expect(
      getProblemPhaseLabel({ status: "completed", phase: "review" }),
    ).toBe("Completed");
  });

  it("labels an abandoned session as Not started regardless of phase", () => {
    expect(
      getProblemPhaseLabel({ status: "abandoned", phase: "solve" }),
    ).toBe("Not started");
  });
});

describe("getProblemCtaLabel", () => {
  it("returns null for a non-active, non-completed row", () => {
    expect(
      getProblemCtaLabel({ status: "abandoned", phase: "solve" }, false),
    ).toBeNull();
    expect(getProblemCtaLabel(undefined, false)).toBeNull();
  });

  it("returns Review for a completed row regardless of active-ness", () => {
    expect(
      getProblemCtaLabel({ status: "completed", phase: "review" }, false),
    ).toBe("Review");
  });

  it("returns Start for the active row with no session yet", () => {
    expect(getProblemCtaLabel(undefined, true)).toBe("Start");
  });

  it("returns Continue for the active row with a resumable active session", () => {
    expect(
      getProblemCtaLabel({ status: "active", phase: "solve" }, true),
    ).toBe("Continue");
  });

  it("returns Start, not Continue, for the active row when the prior session was abandoned", () => {
    expect(
      getProblemCtaLabel({ status: "abandoned", phase: "solve" }, true),
    ).toBe("Start");
  });
});
