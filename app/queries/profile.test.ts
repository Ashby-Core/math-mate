import { beforeEach, describe, expect, it, vi } from "vitest";

// buildProfile only composes the other query functions, so stub them and assert
// on the shaping.
const m = vi.hoisted(() => ({
  getCourseById: vi.fn(),
  getProfileById: vi.fn(),
  getMasteries: vi.fn(),
  getWeaknesses: vi.fn(),
}));

vi.mock("./courses", () => ({ getCourseById: m.getCourseById }));
vi.mock("./profiles", () => ({ getProfileById: m.getProfileById }));
vi.mock("./masteries", () => ({ getMasteries: m.getMasteries }));
vi.mock("./weaknesses", () => ({ getWeaknesses: m.getWeaknesses }));

import { buildProfile } from "./profile";

const supabase = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
  m.getCourseById.mockResolvedValue({ name: "Intro to Fractions" });
  m.getProfileById.mockResolvedValue({ firstName: "Ada", lastName: "Lovelace" });
  m.getMasteries.mockResolvedValue([]);
  m.getWeaknesses.mockResolvedValue([]);
});

describe("buildProfile", () => {
  it("keys masteries by topic id and groups weaknesses into description lists", async () => {
    m.getMasteries.mockResolvedValue([
      { topicId: "t1", name: "Adding Fractions", mastery: 0.5 },
      { topicId: "t2", name: "Subtracting", mastery: null },
    ]);
    m.getWeaknesses.mockResolvedValue([
      { topicId: "t1", name: "Adding Fractions", description: "flips fraction" },
      { topicId: "t1", name: "Adding Fractions", description: "no common denom" },
    ]);

    const profile = await buildProfile(supabase, "u1", "c1");

    expect(profile).toEqual({
      courseName: "Intro to Fractions",
      student: { id: "u1", name: "Ada Lovelace" },
      topicMasteryScores: {
        t1: { name: "Adding Fractions", mastery: 0.5 },
        t2: { name: "Subtracting", mastery: null },
      },
      weaknesses: {
        t1: {
          name: "Adding Fractions",
          items: ["flips fraction", "no common denom"],
        },
      },
    });
  });

  it("produces a stable empty shape when the student has no data", async () => {
    m.getCourseById.mockResolvedValue(null);
    m.getProfileById.mockResolvedValue(null);

    const profile = await buildProfile(supabase, "u1", "c1");

    expect(profile).toEqual({
      courseName: "",
      student: { id: "u1", name: "" },
      topicMasteryScores: {},
      weaknesses: {},
    });
  });

  it("scopes every composed query to the same student and course", async () => {
    await buildProfile(supabase, "u1", "c1");
    expect(m.getCourseById).toHaveBeenCalledWith(supabase, "c1");
    expect(m.getProfileById).toHaveBeenCalledWith(supabase, "u1");
    expect(m.getMasteries).toHaveBeenCalledWith(supabase, "u1", "c1");
    expect(m.getWeaknesses).toHaveBeenCalledWith(supabase, "u1", "c1");
  });
});
