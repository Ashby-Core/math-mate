import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testSupabase";
import { getCourseById, getCoursesByTeacher } from "./courses";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const row = {
  id: "c1",
  created_at: "2026-06-01T00:00:00Z",
  teacher: "u1",
  name: "Intro to Fractions",
  code: "ABC123",
};

const mapped = {
  id: "c1",
  createdAt: "2026-06-01T00:00:00Z",
  teacher: "u1",
  name: "Intro to Fractions",
  code: "ABC123",
};

describe("getCourseById", () => {
  it("maps the row to the Course shape", async () => {
    const { client } = fakeSupabase({ data: row, error: null });
    expect(await getCourseById(client, "c1")).toEqual(mapped);
  });

  it("returns null on error", async () => {
    const { client } = fakeSupabase({
      data: null,
      error: { message: "boom" },
    });
    expect(await getCourseById(client, "c1")).toBeNull();
  });

  it("returns null when no row is found", async () => {
    const { client } = fakeSupabase({ data: null, error: null });
    expect(await getCourseById(client, "c1")).toBeNull();
  });
});

describe("getCoursesByTeacher", () => {
  it("maps each row to the Course shape", async () => {
    const { client } = fakeSupabase({ data: [row], error: null });
    expect(await getCoursesByTeacher(client, "u1")).toEqual([mapped]);
  });

  it("filters by the teacher id", async () => {
    const { client, chains } = fakeSupabase({ data: [], error: null });
    await getCoursesByTeacher(client, "u1");
    expect(chains[0].eq).toHaveBeenCalledWith("teacher", "u1");
  });

  it("returns [] on error", async () => {
    const { client } = fakeSupabase({
      data: null,
      error: { message: "boom" },
    });
    expect(await getCoursesByTeacher(client, "u1")).toEqual([]);
  });
});
