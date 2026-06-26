import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./testSupabase";
import { getProfileById } from "./profiles";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const row = {
  id: "u1",
  first_name: "Ada",
  last_name: "Lovelace",
  username: "ada",
  user_role: "student",
};

describe("getProfileById", () => {
  it("maps the row to the Profile shape", async () => {
    const { client } = fakeSupabase({ data: row, error: null });
    expect(await getProfileById(client, "u1")).toEqual({
      id: "u1",
      firstName: "Ada",
      lastName: "Lovelace",
      username: "ada",
      userRole: "student",
    });
  });

  it("returns null on error", async () => {
    const { client } = fakeSupabase({
      data: null,
      error: { message: "boom" },
    });
    expect(await getProfileById(client, "u1")).toBeNull();
  });

  it("returns null when no row is found", async () => {
    const { client } = fakeSupabase({ data: null, error: null });
    expect(await getProfileById(client, "u1")).toBeNull();
  });
});
