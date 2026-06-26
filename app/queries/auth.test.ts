import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  createClient: vi.fn(),
  redirect: vi.fn(() => {
    // Mirror Next's redirect, which throws to halt execution.
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/utils/supabase/server", () => ({ createClient: m.createClient }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));

import { requireUser, requireUserApi } from "./auth";

function clientWithUser(user: unknown) {
  return { auth: { getUser: vi.fn(async () => ({ data: { user } })) } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireUser", () => {
  it("returns the client and user when authenticated", async () => {
    const supabase = clientWithUser({ id: "u1" });
    m.createClient.mockResolvedValue(supabase);
    const result = await requireUser();
    expect(result).toEqual({ supabase, user: { id: "u1" } });
    expect(m.redirect).not.toHaveBeenCalled();
  });

  it("redirects to /login when there is no session", async () => {
    m.createClient.mockResolvedValue(clientWithUser(null));
    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT");
    expect(m.redirect).toHaveBeenCalledWith("/login");
  });
});

describe("requireUserApi", () => {
  it("returns the client and user when authenticated", async () => {
    const supabase = clientWithUser({ id: "u1" });
    m.createClient.mockResolvedValue(supabase);
    expect(await requireUserApi()).toEqual({ supabase, user: { id: "u1" } });
  });

  it("returns null (no redirect) when unauthenticated", async () => {
    m.createClient.mockResolvedValue(clientWithUser(null));
    expect(await requireUserApi()).toBeNull();
    expect(m.redirect).not.toHaveBeenCalled();
  });
});
