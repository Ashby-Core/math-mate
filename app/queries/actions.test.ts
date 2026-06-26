import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, type QueryResult } from "./testSupabase";

// Server actions lean on Next's createClient/redirect/revalidatePath and on
// requireUser; stub them all. redirect is modeled as throwing (like Next) so it
// halts the action.
const m = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireUser: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  revalidatePath: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({ createClient: m.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("./auth", () => ({ requireUser: m.requireUser }));

import {
  createAssignment,
  createCourse,
  enrollInCourse,
  login,
  logout,
  signup,
} from "./actions";

// A supabase double: real `.from()` chains (via fakeSupabase) plus the auth/rpc
// surface the actions reach for.
function makeClient(opts: {
  results?: QueryResult[];
  signUp?: unknown;
  signIn?: QueryResult;
  signOut?: QueryResult;
  rpc?: QueryResult;
}) {
  const { client, chains } = fakeSupabase(...(opts.results ?? [{ error: null }]));
  const c = client as unknown as Record<string, unknown>;
  c.auth = {
    signUp: vi.fn(async () => opts.signUp ?? { data: { user: { id: "u1" } }, error: null }),
    signInWithPassword: vi.fn(async () => opts.signIn ?? { error: null }),
    signOut: vi.fn(async () => opts.signOut ?? { error: null }),
    admin: { deleteUser: vi.fn(async () => ({})) },
  };
  c.rpc = vi.fn(async () => opts.rpc ?? { error: null });
  return { client: c, chains };
}

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("login", () => {
  it("revalidates and redirects to /dashboard on success", async () => {
    const { client } = makeClient({ signIn: { error: null } });
    m.createClient.mockResolvedValue(client);
    await expect(login(form({ email: "a@b.co", password: "pw" }))).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
    expect(m.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("returns the error code and does not redirect on bad credentials", async () => {
    const { client } = makeClient({
      signIn: { error: { code: "invalid_credentials" } },
    });
    m.createClient.mockResolvedValue(client);
    const code = await login(form({ email: "a@b.co", password: "nope" }));
    expect(code).toBe("invalid_credentials");
    expect(m.redirect).not.toHaveBeenCalled();
  });
});

describe("logout", () => {
  it("redirects home", async () => {
    const { client } = makeClient({});
    m.createClient.mockResolvedValue(client);
    await expect(logout()).rejects.toThrow("NEXT_REDIRECT:/");
  });
});

describe("signup", () => {
  const fields = {
    email: "a@b.co",
    password: "pw",
    "first-name": "Ada",
    "last-name": "Lovelace",
    username: "ada",
    role: "student",
    demographic: "x",
  };

  it("creates the profile and a student_profiles row, then redirects to /dashboard", async () => {
    const { client, chains } = makeClient({
      results: [{ error: null }, { error: null }],
    });
    m.createClient.mockResolvedValue(client);

    await expect(signup(form(fields))).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(chains[0].insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u1", username: "ada", user_role: "student" }),
    );
    // second .from() is the student_profiles insert
    expect(chains[1].insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u1", grade_level: null }),
    );
  });

  it("creates a teacher_profiles row for the teacher role", async () => {
    const { client, chains } = makeClient({
      results: [{ error: null }, { error: null }],
    });
    m.createClient.mockResolvedValue(client);

    await expect(
      signup(form({ ...fields, role: "teacher" })),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(chains[1].insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u1", school: null }),
    );
  });

  it("redirects to /error when the auth user is not created", async () => {
    const { client } = makeClient({ signUp: { data: { user: null }, error: null } });
    m.createClient.mockResolvedValue(client);
    await expect(signup(form(fields))).rejects.toThrow("NEXT_REDIRECT:/error");
  });

  it("rolls back the auth user and redirects to /error on a profile insert failure", async () => {
    const { client } = makeClient({ results: [{ error: { message: "dup" } }] });
    m.createClient.mockResolvedValue(client);
    await expect(signup(form(fields))).rejects.toThrow("NEXT_REDIRECT:/error");
    expect(
      (client.auth as { admin: { deleteUser: ReturnType<typeof vi.fn> } }).admin
        .deleteUser,
    ).toHaveBeenCalledWith("u1");
  });
});

describe("createCourse", () => {
  it("inserts a course with the teacher id, name, and a 6-char code", async () => {
    const { client, chains } = makeClient({ results: [{ error: null }] });
    m.requireUser.mockResolvedValue({ supabase: client, user: { id: "u1" } });

    await createCourse(form({ courseName: "Algebra" }));

    const payload = chains[0].insert.mock.calls[0][0];
    expect(payload).toMatchObject({ teacher: "u1", name: "Algebra" });
    expect(payload.code).toHaveLength(6);
  });
});

describe("createAssignment", () => {
  const input = {
    courseId: "c1" as never,
    title: "HW1",
    dueDate: new Date("2026-07-01") as never,
    description: "desc",
    problems: [],
  };

  it("calls the create_assignment RPC and reports success", async () => {
    const { client } = makeClient({ rpc: { error: null } });
    m.requireUser.mockResolvedValue({ supabase: client, user: { id: "u1" } });

    const result = await createAssignment(input);

    expect(result).toEqual({ success: true });
    expect(client.rpc).toHaveBeenCalledWith(
      "create_assignment",
      expect.objectContaining({ course_id_param: "c1", title_param: "HW1" }),
    );
  });

  it("surfaces the RPC error message", async () => {
    const { client } = makeClient({ rpc: { error: { message: "boom" } } });
    m.requireUser.mockResolvedValue({ supabase: client, user: { id: "u1" } });
    expect(await createAssignment(input)).toEqual({ error: "boom" });
  });
});

describe("enrollInCourse", () => {
  it("looks up the course by code, inserts an enrollment, and reports success", async () => {
    const { client, chains } = makeClient({
      results: [
        { data: { id: "c1" }, error: null }, // course lookup
        { error: null }, // enrollment insert
      ],
    });
    m.requireUser.mockResolvedValue({ supabase: client, user: { id: "u1" } });

    const result = await enrollInCourse(form({ code: "ABC123" }));

    expect(result).toEqual({ success: true });
    expect(chains[0].eq).toHaveBeenCalledWith("code", "ABC123");
    expect(chains[1].insert).toHaveBeenCalledWith({
      profile_id: "u1",
      course_id: "c1",
    });
  });

  it("returns the error when the course code is invalid", async () => {
    const { client } = makeClient({
      results: [{ data: null, error: { message: "no course" } }],
    });
    m.requireUser.mockResolvedValue({ supabase: client, user: { id: "u1" } });
    expect(await enrollInCourse(form({ code: "BAD" }))).toEqual({
      error: "no course",
    });
  });

  it("returns the error when the enrollment insert fails", async () => {
    const { client } = makeClient({
      results: [
        { data: { id: "c1" }, error: null },
        { error: { message: "already enrolled" } },
      ],
    });
    m.requireUser.mockResolvedValue({ supabase: client, user: { id: "u1" } });
    expect(await enrollInCourse(form({ code: "ABC123" }))).toEqual({
      error: "already enrolled",
    });
  });
});
