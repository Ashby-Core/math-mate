import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testSupabase";
import {
  getCourseStudents,
  getEnrolledCoursesForStudent,
  isStudentEnrolled,
} from "./enrollments";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getEnrolledCoursesForStudent", () => {
  const enrollmentRow = {
    courses: {
      id: "c1",
      created_at: "2026-06-01T00:00:00Z",
      teacher: "u2",
      name: "Intro to Fractions",
      code: "ABC123",
    },
  };

  it("flattens the joined course onto the Course shape", async () => {
    const { client } = fakeSupabase({ data: [enrollmentRow], error: null });
    expect(await getEnrolledCoursesForStudent(client, "u1")).toEqual([
      {
        id: "c1",
        createdAt: "2026-06-01T00:00:00Z",
        teacher: "u2",
        name: "Intro to Fractions",
        code: "ABC123",
      },
    ]);
  });

  it("returns [] on error", async () => {
    const { client } = fakeSupabase({
      data: null,
      error: { message: "boom" },
    });
    expect(await getEnrolledCoursesForStudent(client, "u1")).toEqual([]);
  });
});

describe("isStudentEnrolled", () => {
  it("returns true when an enrollment row exists", async () => {
    const { client } = fakeSupabase({ data: [{ id: 1 }], error: null });
    expect(await isStudentEnrolled(client, "u1", "c1")).toBe(true);
  });

  it("returns false when no enrollment row exists", async () => {
    const { client } = fakeSupabase({ data: [], error: null });
    expect(await isStudentEnrolled(client, "u1", "c1")).toBe(false);
  });

  it("returns false (not throwing) when data is null", async () => {
    const { client } = fakeSupabase({ data: null, error: null });
    expect(await isStudentEnrolled(client, "u1", "c1")).toBe(false);
  });

  it("returns false on error", async () => {
    const { client } = fakeSupabase({
      data: null,
      error: { message: "boom" },
    });
    expect(await isStudentEnrolled(client, "u1", "c1")).toBe(false);
  });

  it("filters by both student and course", async () => {
    const { client, chains } = fakeSupabase({ data: [], error: null });
    await isStudentEnrolled(client, "u1", "c1");
    expect(chains[0].eq).toHaveBeenCalledWith("profile_id", "u1");
    expect(chains[0].eq).toHaveBeenCalledWith("course_id", "c1");
  });
});

describe("getCourseStudents", () => {
  const profileRow = {
    profiles: {
      id: "u1",
      first_name: "Ada",
      last_name: "Lovelace",
      username: "ada",
      user_role: "student",
    },
  };

  it("maps joined profiles to the Profile shape", async () => {
    const { client } = fakeSupabase({ data: [profileRow], error: null });
    expect(await getCourseStudents(client, "c1")).toEqual([
      {
        id: "u1",
        firstName: "Ada",
        lastName: "Lovelace",
        username: "ada",
        userRole: "student",
      },
    ]);
  });

  it("drops enrollment rows whose profile join is missing", async () => {
    const { client } = fakeSupabase({
      data: [profileRow, { profiles: null }],
      error: null,
    });
    expect(await getCourseStudents(client, "c1")).toHaveLength(1);
  });

  it("returns [] on error", async () => {
    const { client } = fakeSupabase({
      data: null,
      error: { message: "boom" },
    });
    expect(await getCourseStudents(client, "c1")).toEqual([]);
  });
});
