import { describe, expect, it } from "vitest";
import type { UUID } from "crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { Problem, StudentProfile } from "@/app/types";
import { TutoringState } from "./stateMachine";
import { SESSION_SEED_MESSAGE } from "./conversation";
import {
  toApiProblem,
  toDisplayMessages,
  toSessionResponse,
  toSidebar,
} from "./responseShape";

const FRACTIONS = "11111111-1111-1111-1111-111111111111" as UUID;
const DIVISION = "22222222-2222-2222-2222-222222222222" as UUID;
const DECIMALS = "33333333-3333-3333-3333-333333333333" as UUID;
const PROBLEM_ID = "99999999-9999-9999-9999-999999999999" as UUID;

// FRACTIONS=0.3 (gap), DIVISION=0.5 (gap), DECIMALS=null (unassessed).
const profile: StudentProfile = {
  courseName: "Intro to Fractions",
  student: { id: "s1", firstName: "Ada" },
  topicMasteryScores: {
    [FRACTIONS]: { name: "Adding Fractions", mastery: 0.3 },
    [DIVISION]: { name: "Long Division", mastery: 0.5 },
    [DECIMALS]: { name: "Decimals", mastery: null },
  },
  weaknesses: {},
};

const problem: Problem = {
  id: PROBLEM_ID,
  questionContent: "What is 3/4 + 1/8?",
  correctAnswer: "7/8",
  orderIndex: 2,
  tops: [FRACTIONS, DIVISION, DECIMALS],
};

const gaps = [
  { topicId: FRACTIONS, name: "Adding Fractions", resolved: false },
  { topicId: DIVISION, name: "Long Division", resolved: false },
];
const intro: TutoringState = {
  phase: "intro",
  status: "active",
  gaps,
  solveAttemptRecorded: false,
};
const gapCheck: TutoringState = {
  phase: "gap_check",
  status: "active",
  gaps,
  solveAttemptRecorded: false,
};
const solve: TutoringState = {
  phase: "solve",
  status: "active",
  gaps: gaps.map((g) => ({ ...g, resolved: true })),
  solveAttemptRecorded: false,
};
const review: TutoringState = { ...solve, phase: "review" };

const tagFor = (topics: { topicId: string; status: string }[], id: string) =>
  topics.find((t) => t.topicId === id)?.status;

describe("toApiProblem — correctAnswer firewall", () => {
  it("never serializes the answer or its key, in any phase", () => {
    for (const state of [intro, gapCheck, solve]) {
      const json = JSON.stringify(toApiProblem(profile, problem, state));
      expect(json).not.toContain("7/8");
      expect(json).not.toContain("correctAnswer");
      expect(json).not.toContain("correct_answer");
    }
  });
});

describe("toApiProblem — locked gating", () => {
  it("hides questionContent until the problem is unlocked", () => {
    expect(toApiProblem(profile, problem, intro).questionContent).toBeNull();
    expect(toApiProblem(profile, problem, gapCheck).questionContent).toBeNull();
    expect(toApiProblem(profile, problem, intro).unlocked).toBe(false);

    const solved = toApiProblem(profile, problem, solve);
    expect(solved.unlocked).toBe(true);
    expect(solved.questionContent).toBe(problem.questionContent);
  });

  it("reveals questionContent in review too, regardless of what's stored on the Problem row", () => {
    const reviewed = toApiProblem(profile, problem, review);
    expect(reviewed.unlocked).toBe(true);
    expect(reviewed.questionContent).toBe(problem.questionContent);
  });

  it("locks every phase except solve/review", () => {
    const lockedPhases = [intro, gapCheck];
    const unlockedPhases = [solve, review];
    for (const state of lockedPhases) {
      expect(toApiProblem(profile, problem, state).unlocked).toBe(false);
      expect(toApiProblem(profile, problem, state).questionContent).toBeNull();
    }
    for (const state of unlockedPhases) {
      expect(toApiProblem(profile, problem, state).unlocked).toBe(true);
      expect(toApiProblem(profile, problem, state).questionContent).toBe(
        problem.questionContent,
      );
    }
  });
});

describe("buildTopicTags (via toApiProblem) — precedence", () => {
  it("marks the current gap 'checking', other unresolved gaps 'gap'", () => {
    const { topics } = toApiProblem(profile, problem, gapCheck);
    expect(tagFor(topics, FRACTIONS)).toBe("checking"); // first unresolved
    expect(tagFor(topics, DIVISION)).toBe("gap"); // unresolved, not current
    expect(tagFor(topics, DECIMALS)).toBe("unassessed"); // null mastery, not a gap
  });

  it("marks resolved gaps 'resolved'", () => {
    const { topics } = toApiProblem(profile, problem, solve);
    expect(tagFor(topics, FRACTIONS)).toBe("resolved");
    expect(tagFor(topics, DIVISION)).toBe("resolved");
  });

  it("does not mark a gap 'checking' outside gap_check", () => {
    const { topics } = toApiProblem(profile, problem, intro);
    expect(tagFor(topics, FRACTIONS)).toBe("gap"); // intro: no current gap
  });
});

describe("toSidebar", () => {
  it("emits a mastery bar per course topic with base status + prerequisite flag", () => {
    const { masteryBars, stats } = toSidebar(profile, problem, gapCheck);
    expect(masteryBars).toHaveLength(3);
    const frac = masteryBars.find((b) => b.topicId === FRACTIONS)!;
    expect(frac).toMatchObject({ mastery: 0.3, status: "gap", isPrerequisite: true });
    const dec = masteryBars.find((b) => b.topicId === DECIMALS)!;
    expect(dec.status).toBe("unassessed");
    expect(stats).toEqual({
      gapsTotal: 2,
      gapsResolved: 0,
      phase: "gap_check",
      unlocked: false,
    });
  });
});

describe("toDisplayMessages", () => {
  it("strips the leading synthetic seed turn and flattens content", () => {
    const history: Anthropic.MessageParam[] = [
      { role: "user", content: SESSION_SEED_MESSAGE },
      { role: "assistant", content: "Hi Ada!" },
      { role: "user", content: "3/8" },
    ];
    expect(toDisplayMessages(history)).toEqual([
      { role: "assistant", content: "Hi Ada!" },
      { role: "user", content: "3/8" },
    ]);
  });

  it("coerces content-block arrays to text", () => {
    const history: Anthropic.MessageParam[] = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "Part 1. " },
          { type: "text", text: "Part 2." },
        ],
      },
    ];
    expect(toDisplayMessages(history)).toEqual([
      { role: "assistant", content: "Part 1. Part 2." },
    ]);
  });

  it("is empty-safe", () => {
    expect(toDisplayMessages([])).toEqual([]);
  });
});

describe("toSessionResponse", () => {
  it("composes the full response and leaks no answer", () => {
    const res = toSessionResponse({
      sessionId: "sess-1",
      state: gapCheck,
      profile,
      problem,
      history: [
        { role: "user", content: SESSION_SEED_MESSAGE },
        { role: "assistant", content: "Hi Ada!" },
      ],
    });
    expect(res.sessionId).toBe("sess-1");
    expect(res.phase).toBe("gap_check");
    expect(res.messages).toEqual([{ role: "assistant", content: "Hi Ada!" }]);
    expect(JSON.stringify(res)).not.toContain("7/8");
  });
});
