import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UUID } from "crypto";
import type { NextRequest } from "next/server";
import { SESSION_SEED_MESSAGE } from "@/app/tutor/conversation";

// Shared mock fns (hoisted so the vi.mock factories can reference them).
const m = vi.hoisted(() => ({
  requireUserApi: vi.fn(),
  getProblemById: vi.fn(),
  isStudentEnrolled: vi.fn(),
  buildProfile: vi.fn(),
  getActiveSession: vi.fn(),
  createSession: vi.fn(),
  openSession: vi.fn(),
  getAnthropic: vi.fn(() => ({})),
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

vi.mock("@/app/queries/auth", () => ({ requireUserApi: m.requireUserApi }));
vi.mock("@/app/queries/problems", () => ({ getProblemById: m.getProblemById }));
vi.mock("@/app/queries/enrollments", () => ({
  isStudentEnrolled: m.isStudentEnrolled,
}));
vi.mock("@/app/queries/profile", () => ({ buildProfile: m.buildProfile }));
vi.mock("@/app/queries/sessions", () => ({
  getActiveSession: m.getActiveSession,
  createSession: m.createSession,
}));
vi.mock("@/app/tutor/anthropic", () => ({ getAnthropic: m.getAnthropic }));
// Keep SESSION_SEED_MESSAGE (and the rest) real; stub only openSession.
vi.mock("@/app/tutor/conversation", async (orig) => ({
  ...(await orig<typeof import("@/app/tutor/conversation")>()),
  openSession: m.openSession,
}));
vi.mock("@/lib/historyCache", () => ({
  historyCache: {
    get: m.cacheGet,
    set: m.cacheSet,
    append: vi.fn(),
    delete: vi.fn(),
  },
}));

import { POST } from "./route";

const FRACTIONS = "11111111-1111-1111-1111-111111111111" as UUID;

const profile = {
  courseName: "Intro to Fractions",
  student: { id: "u1", firstName: "Ada" },
  topicMasteryScores: { [FRACTIONS]: { name: "Adding Fractions", mastery: 0.3 } },
  weaknesses: {},
};
const problem = {
  id: "p1" as UUID,
  questionContent: "What is 3/4 + 1/8?",
  correctAnswer: "7/8",
  orderIndex: 0,
  tops: [FRACTIONS],
};

function makeReq(body: unknown): NextRequest {
  return new Request("http://localhost/api/sessions", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as NextRequest;
}

const greetingStream = {
  finalMessage: async () => ({ content: [{ type: "text", text: "Hi Ada!" }] }),
};

beforeEach(() => {
  vi.clearAllMocks();
  m.requireUserApi.mockResolvedValue({ supabase: {}, user: { id: "u1" } });
  m.getProblemById.mockResolvedValue({ problem, courseId: "c1" });
  m.isStudentEnrolled.mockResolvedValue(true);
  m.buildProfile.mockResolvedValue(profile);
  m.getActiveSession.mockResolvedValue(null);
  m.createSession.mockResolvedValue({ id: "sess-new" });
  m.openSession.mockResolvedValue({ stream: greetingStream });
  m.cacheGet.mockResolvedValue(null);
  m.cacheSet.mockResolvedValue(undefined);
});

describe("POST /api/sessions — guards", () => {
  it("401 when unauthenticated", async () => {
    m.requireUserApi.mockResolvedValue(null);
    const res = await POST(makeReq({ problemId: "p1" }));
    expect(res.status).toBe(401);
  });

  it("400 on unparseable body", async () => {
    const res = await POST(makeReq("{not json"));
    expect(res.status).toBe(400);
  });

  it("400 when problemId is missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("404 when the problem is not found", async () => {
    m.getProblemById.mockResolvedValue(null);
    const res = await POST(makeReq({ problemId: "p1" }));
    expect(res.status).toBe(404);
  });

  it("403 when the student is not enrolled", async () => {
    m.isStudentEnrolled.mockResolvedValue(false);
    const res = await POST(makeReq({ problemId: "p1" }));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/sessions — create", () => {
  it("generates the greeting, persists [seed, greeting], returns a locked problem", async () => {
    const res = await POST(makeReq({ problemId: "p1" }));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.sessionId).toBe("sess-new");
    expect(json.phase).toBe("intro");
    expect(json.problem.unlocked).toBe(false);
    expect(json.problem.questionContent).toBeNull();
    expect(json.messages).toEqual([{ role: "assistant", content: "Hi Ada!" }]);
    expect(JSON.stringify(json)).not.toContain("7/8"); // answer never leaks

    // greeting BEFORE the row insert (orphan prevention)
    expect(m.openSession).toHaveBeenCalledTimes(1);
    expect(m.createSession).toHaveBeenCalledTimes(1);
    expect(m.openSession.mock.invocationCallOrder[0]).toBeLessThan(
      m.createSession.mock.invocationCallOrder[0],
    );
    expect(m.cacheSet).toHaveBeenCalledWith("sess-new", [
      { role: "user", content: SESSION_SEED_MESSAGE },
      { role: "assistant", content: "Hi Ada!" },
    ]);
  });

  it("does not insert a row or write the cache if the greeting fails", async () => {
    m.openSession.mockRejectedValue(new Error("claude down"));
    const res = await POST(makeReq({ problemId: "p1" }));
    expect(res.status).toBe(500);
    expect(m.createSession).not.toHaveBeenCalled();
    expect(m.cacheSet).not.toHaveBeenCalled();
  });

  it("falls back to resume when the create races (unique conflict)", async () => {
    m.createSession.mockResolvedValue({ conflict: true });
    m.getActiveSession
      .mockResolvedValueOnce(null) // initial lookup: no active row
      .mockResolvedValueOnce({
        id: "sess-winner",
        phase: "gap_check",
        status: "active",
        gapState: { gaps: [] },
      });
    m.cacheGet.mockResolvedValue(null);

    const res = await POST(makeReq({ problemId: "p1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sessionId).toBe("sess-winner");
  });
});

describe("POST /api/sessions — resume", () => {
  const activeRow = {
    id: "sess-x",
    phase: "gap_check",
    status: "active",
    gapState: {
      gaps: [{ topicId: FRACTIONS, name: "Adding Fractions", resolved: false }],
    },
  };

  it("resumes from cache without calling Claude (seed stripped)", async () => {
    m.getActiveSession.mockResolvedValue(activeRow);
    m.cacheGet.mockResolvedValue([
      { role: "user", content: SESSION_SEED_MESSAGE },
      { role: "assistant", content: "Earlier greeting" },
      { role: "user", content: "3/8" },
    ]);

    const res = await POST(makeReq({ problemId: "p1" }));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.sessionId).toBe("sess-x");
    expect(json.phase).toBe("gap_check");
    expect(m.openSession).not.toHaveBeenCalled();
    expect(m.createSession).not.toHaveBeenCalled();
    expect(json.messages).toEqual([
      { role: "assistant", content: "Earlier greeting" },
      { role: "user", content: "3/8" },
    ]);
  });

  it("returns an empty transcript with the durable phase on a cache miss", async () => {
    m.getActiveSession.mockResolvedValue(activeRow);
    m.cacheGet.mockResolvedValue(null);

    const res = await POST(makeReq({ problemId: "p1" }));
    const json = await res.json();
    expect(json.phase).toBe("gap_check");
    expect(json.messages).toEqual([]);
    expect(m.openSession).not.toHaveBeenCalled();
  });

  it.each(["solve", "review"] as const)(
    "resuming mid-%s returns the problem already unlocked, with no extra turn",
    async (phase) => {
      m.getActiveSession.mockResolvedValue({
        id: "sess-unlocked",
        phase,
        status: "active",
        gapState: {
          gaps: [{ topicId: FRACTIONS, name: "Adding Fractions", resolved: true }],
        },
      });
      m.cacheGet.mockResolvedValue(null);

      const res = await POST(makeReq({ problemId: "p1" }));
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.phase).toBe(phase);
      expect(json.problem.unlocked).toBe(true);
      expect(json.problem.questionContent).toBe(problem.questionContent);
      expect(m.openSession).not.toHaveBeenCalled();
      expect(m.createSession).not.toHaveBeenCalled();
    },
  );
});
