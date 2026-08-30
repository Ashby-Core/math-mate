import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { Problem, StudentProfile } from "@/app/types";
import { classifyMisconception, matchWeakness } from "@/app/queries/claude";
import { updateMasteryCounts } from "@/app/queries/masteries";
import { buildProfile } from "@/app/queries/profile";
import { fakeSupabase } from "@/app/queries/testSupabase";
import { handleTurn } from "./conversation";
import { advance, initTutoringState } from "./stateMachine";

// Only the two Claude-backed classification calls are mocked (no live model
// calls in tests) plus updateMasteryCounts (out of scope here). Everything
// else in the misconception write path — getWeaknessesForTopic, insertWeakness,
// and buildProfile's own query composition — is real, wired to fakeSupabase,
// so this test verifies the write actually lands and is visible to the next
// profile rebuild rather than assuming it from the unit-level mocks alone.
vi.mock("@/app/queries/claude", () => ({
  classifyMisconception: vi.fn(),
  matchWeakness: vi.fn(),
}));
// Keep the rest of the module real (buildProfile needs the real getMasteries); stub only updateMasteryCounts.
vi.mock("@/app/queries/masteries", async (orig) => ({
  ...(await orig<typeof import("@/app/queries/masteries")>()),
  updateMasteryCounts: vi.fn(),
}));

const mockClassify = vi.mocked(classifyMisconception);
const mockMatch = vi.mocked(matchWeakness);
const mockUpdate = vi.mocked(updateMasteryCounts);

const FRACTIONS = "11111111-1111-1111-1111-111111111111" as UUID;
const STUDENT_ID = "22222222-2222-2222-2222-222222222222" as UUID;
const COURSE_ID = "33333333-3333-3333-3333-333333333333" as UUID;
const PROBLEM_ID = "44444444-4444-4444-4444-444444444444" as UUID;

const MISCONCEPTION = "adds numerators and denominators separately";

function makeProfile(): StudentProfile {
  return {
    courseName: "Intro to Fractions",
    student: { id: STUDENT_ID, firstName: "Ada" },
    topicMasteryScores: { [FRACTIONS]: { name: "Adding Fractions", mastery: 0.3 } }, // below GAP_THRESHOLD
    weaknesses: {},
  };
}

const PROBLEM: Problem = {
  id: PROBLEM_ID,
  questionContent: "What is 3/4 + 1/8?",
  correctAnswer: "7/8",
  orderIndex: 0,
  tops: [FRACTIONS],
};

/** Fake Anthropic client: judgeTurn's real create() call reads a wrong-attempt verdict. */
function makeAnthropic(): Anthropic {
  const create = vi.fn(async () => ({
    content: [{ type: "text", text: JSON.stringify({ isAttempt: true, correct: false }) }],
  }));
  const stream = vi.fn(() => ({ sentinel: "stream" }));
  return { messages: { create, stream } } as unknown as Anthropic;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockClassify.mockResolvedValue(MISCONCEPTION);
  mockMatch.mockResolvedValue("novel");
  mockUpdate.mockResolvedValue(null);
});

describe("misconception write visible on next profile rebuild", () => {
  it("a novel misconception inserted by the detached pipeline is picked up by buildProfile's next rebuild", async () => {
    const insertedRow = {
      id: "w-new",
      topic_id: FRACTIONS,
      description: MISCONCEPTION,
      observed_count: 1,
      last_observed: "2026-08-30T00:00:00Z",
      topics: { name: "Adding Fractions" },
    };

    // Queued in the real call order this turn produces: the pipeline's
    // getWeaknessesForTopic + insertWeakness first, then buildProfile's four
    // parallel queries (getCourseById, getProfileById, getMasteries, getWeaknesses).
    const { client } = fakeSupabase(
      { data: [], error: null }, // getWeaknessesForTopic — nothing recorded yet
      { data: insertedRow, error: null }, // insertWeakness — the pipeline's write
      {
        data: {
          id: COURSE_ID,
          created_at: "2026-01-01T00:00:00Z",
          teacher: "t-1",
          name: "Intro to Fractions",
          code: "ABC123",
        },
        error: null,
      }, // buildProfile -> getCourseById
      {
        data: {
          id: STUDENT_ID,
          first_name: "Ada",
          last_name: "L",
          username: "ada",
          user_role: "student",
        },
        error: null,
      }, // buildProfile -> getProfileById
      {
        data: [
          {
            id: FRACTIONS,
            name: "Adding Fractions",
            student_topic_masteries: [
              { problems_attempted: 3, problems_correct: 1, student_id: STUDENT_ID },
            ],
          },
        ],
        error: null,
      }, // buildProfile -> getMasteries
      { data: [insertedRow], error: null }, // buildProfile -> getWeaknesses (reflects the write above)
    );

    const profile = makeProfile();
    const state = advance(initTutoringState(profile, PROBLEM), { type: "ADVANCE" });
    const deps = { anthropic: makeAnthropic(), supabase: client };

    const result = await handleTurn(deps, {
      profile,
      problem: PROBLEM,
      state,
      history: [{ role: "assistant", content: "What is 1/2 + 1/4?" }],
      studentMessage: "1/4",
    });

    expect(result.misconceptionFired).toBe(true);
    // Simulates the guarantee after() gives in production: the deferred write
    // resolves before the request lifecycle (and here, the test) moves on.
    await result.misconceptionPromise;

    const rebuilt = await buildProfile(client, STUDENT_ID, COURSE_ID);

    expect(rebuilt.weaknesses[FRACTIONS]?.items).toContain(MISCONCEPTION);
  });
});
