import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient: m.createServerClient }));

import { updateSession } from "./middleware";

function clientWithUser(user: unknown) {
  return { auth: { getUser: vi.fn(async () => ({ data: { user } })) } };
}

function reqFor(pathname: string) {
  return new NextRequest(new URL(pathname, "http://localhost"));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateSession", () => {
  it("passes through authenticated requests to any path", async () => {
    m.createServerClient.mockReturnValue(clientWithUser({ id: "u1" }));
    const res = await updateSession(reqFor("/dashboard"));
    expect(res.headers.get("location")).toBeNull();
  });

  it.each(["/login", "/signup", "/auth/confirm", "/error", "/"])(
    "lets unauthenticated requests through to public path %s",
    async (path) => {
      m.createServerClient.mockReturnValue(clientWithUser(null));
      const res = await updateSession(reqFor(path));
      expect(res.headers.get("location")).toBeNull();
    }
  );

  it("lets unauthenticated requests through to /api routes so they can 401 as JSON", async () => {
    m.createServerClient.mockReturnValue(clientWithUser(null));
    const res = await updateSession(reqFor("/api/sessions"));
    expect(res.headers.get("location")).toBeNull();
  });

  it.each(["/dashboard", "/courses/c1", "/tutor/p1"])(
    "redirects unauthenticated requests to /login for protected path %s",
    async (path) => {
      m.createServerClient.mockReturnValue(clientWithUser(null));
      const res = await updateSession(reqFor(path));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    }
  );
});
