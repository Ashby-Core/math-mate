import { describe, expect, it } from "vitest";
import type { UUID } from "crypto";
import { Problem, StudentProfile } from "@/app/types";
import { buildSystemPrompt } from "./systemPrompt";

// Topic ids reused across fixtures. Cast through UUID for the typed maps; the
// builder treats them as opaque keys.
const FRACTIONS = "11111111-1111-1111-1111-111111111111" as UUID;
const DIVISION = "22222222-2222-2222-2222-222222222222" as UUID;
const DECIMALS = "33333333-3333-3333-3333-333333333333" as UUID;
const PROBLEM_ID = "99999999-9999-9999-9999-999999999999" as UUID;

function makeProblem(tops: UUID[]): Problem {
  return {
    id: PROBLEM_ID,
    questionContent: "What is 3/4 + 1/8?",
    correctAnswer: "7/8",
    orderIndex: 0,
    tops,
  };
}

/** The dynamic (per-session) context block — index 1 of the returned blocks. */
function contextText(blocks: ReturnType<typeof buildSystemPrompt>): string {
  return blocks[1].text;
}

describe("buildSystemPrompt", () => {
  it("returns a cacheable static block followed by the dynamic context", () => {
    const profile: StudentProfile = {
      courseName: "Intro to Fractions",
      student: { id: "student-1", name: "Ada Lovelace" },
      topicMasteryScores: { [FRACTIONS]: { name: "Adding Fractions", mastery: 0.3 } },
      weaknesses: {},
    };

    const blocks = buildSystemPrompt(profile, makeProblem([FRACTIONS]));

    // Two blocks: only the first (static rules) carries a cache breakpoint.
    expect(blocks).toHaveLength(2);
    expect(blocks[0].cache_control).toEqual({ type: "ephemeral" });
    expect(blocks[1].cache_control).toBeUndefined();
    // The static prefix must not contain per-student data, or caching breaks.
    expect(blocks[0].text).not.toContain("Ada Lovelace");
    expect(blocks[0].text).not.toContain("3/4");
  });

  it("labels a below-threshold prerequisite as a gap with its misconception", () => {
    const profile: StudentProfile = {
      courseName: "Intro to Fractions",
      student: { id: "student-1", name: "Ada Lovelace" },
      topicMasteryScores: {
        [FRACTIONS]: { name: "Adding Fractions", mastery: 0.3 },
      },
      weaknesses: {
        [FRACTIONS]: {
          name: "Adding Fractions",
          items: ["adds numerators and denominators directly"],
        },
      },
    };

    const blocks = buildSystemPrompt(profile, makeProblem([FRACTIONS]));
    const text = contextText(blocks);

    expect(text).toContain("Adding Fractions [GAP]");
    expect(text).toContain("adds numerators and denominators directly");
    // The correct answer is available to the tutor (system-only, never to UI).
    expect(text).toContain("7/8");
    expect(blocks).toMatchSnapshot();
  });

  it("classifies mixed gap / ok / unassessed prerequisites", () => {
    const profile: StudentProfile = {
      courseName: "Intro to Fractions",
      student: { id: "student-1", name: "Ada Lovelace" },
      topicMasteryScores: {
        [FRACTIONS]: { name: "Adding Fractions", mastery: 0.3 },
        [DIVISION]: { name: "Long Division", mastery: 0.9 },
        [DECIMALS]: { name: "Decimals", mastery: null },
      },
      weaknesses: {},
    };

    const blocks = buildSystemPrompt(
      profile,
      makeProblem([FRACTIONS, DIVISION, DECIMALS]),
    );
    const text = contextText(blocks);

    expect(text).toContain("Adding Fractions [GAP]");
    expect(text).toContain("Long Division [OK]");
    // Unassessed mastery is null -> NOT a gap.
    expect(text).toContain("Decimals [UNASSESSED]");
    expect(blocks).toMatchSnapshot();
  });

  it("produces a stable shape for an empty profile", () => {
    const profile: StudentProfile = {
      courseName: "",
      student: { id: "student-1", name: "" },
      topicMasteryScores: {},
      weaknesses: {},
    };

    const blocks = buildSystemPrompt(profile, makeProblem([]));
    const text = contextText(blocks);

    expect(text).toContain("(unnamed course)");
    expect(text).toContain("no prerequisite topics");
    expect(blocks).toMatchSnapshot();
  });
});

describe("buildSystemPrompt — turn context (TS-3)", () => {
  const profile: StudentProfile = {
    courseName: "Intro to Fractions",
    student: { id: "student-1", name: "Ada Lovelace" },
    topicMasteryScores: { [FRACTIONS]: { name: "Adding Fractions", mastery: 0.3 } },
    weaknesses: {},
  };

  it("omits the turn block when no turn context is given", () => {
    expect(buildSystemPrompt(profile, makeProblem([FRACTIONS]))).toHaveLength(2);
  });

  it("appends an uncached gap_check turn block naming the current gap", () => {
    const blocks = buildSystemPrompt(profile, makeProblem([FRACTIONS]), {
      phase: "gap_check",
      currentGap: { topicId: FRACTIONS, name: "Adding Fractions", resolved: false },
      resolvedCount: 0,
      totalGaps: 2,
    });

    expect(blocks).toHaveLength(3);
    expect(blocks[2].cache_control).toBeUndefined();
    expect(blocks[2].text).toContain("gap_check");
    expect(blocks[2].text).toContain('Probe this gap now: "Adding Fractions"');
    expect(blocks[2].text).toContain("0 of 2 gaps resolved");
  });

  it("frames the review turn as a session-ending recap", () => {
    const blocks = buildSystemPrompt(profile, makeProblem([FRACTIONS]), {
      phase: "review",
      currentGap: null,
      resolvedCount: 1,
      totalGaps: 1,
    });

    expect(blocks[2].text).toContain("recap");
    expect(blocks[2].text).toContain("ends the session");
  });

  it("tells the tutor to acknowledge skipping the gap check when a problem has no gaps", () => {
    const blocks = buildSystemPrompt(profile, makeProblem([FRACTIONS]), {
      phase: "solve",
      currentGap: null,
      resolvedCount: 0,
      totalGaps: 0,
    });

    expect(blocks[2].text).toContain("no prerequisite gaps to check");
    expect(blocks[2].text).toContain("briefly acknowledge that");
  });

  it("frames the solve turn as normal once gaps were actually resolved", () => {
    const blocks = buildSystemPrompt(profile, makeProblem([FRACTIONS]), {
      phase: "solve",
      currentGap: null,
      resolvedCount: 1,
      totalGaps: 1,
    });

    expect(blocks[2].text).toContain("All gaps are resolved");
    expect(blocks[2].text).not.toContain("no prerequisite gaps to check");
  });
});
