import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UUID } from "crypto";
import type { NextRequest } from "next/server";

// Shared mock fns (hoisted so the vi.mock factories can reference them).
const m = vi.hoisted(() => ({
  requireUserApi: vi.fn(),
  getProblemById: vi.fn(),
  buildProfile: vi.fn(),
  getSessionById: vi.fn(),
  updateSessionState: vi.fn(),
  setCompletionSummary: vi.fn(),
  getAnthropic: vi.fn(() => ({})),
  handleTurn: vi.fn(),
  cacheGet: vi.fn(),
  cacheAppend: vi.fn(),
  cacheDelete: vi.fn(),
  after: vi.fn(),
}));

// Keep the rest of the module real (NextRequest/NextResponse); stub only after().
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: m.after,
}));

vi.mock("@/app/queries/auth", () => ({ requireUserApi: m.requireUserApi }));
vi.mock("@/app/queries/problems", () => ({ getProblemById: m.getProblemById }));
vi.mock("@/app/queries/profile", () => ({ buildProfile: m.buildProfile }));
vi.mock("@/app/queries/sessions", () => ({
  getSessionById: m.getSessionById,
  updateSessionState: m.updateSessionState,
  setCompletionSummary: m.setCompletionSummary,
}));
vi.mock("@/app/tutor/anthropic", () => ({ getAnthropic: m.getAnthropic }));
// Keep the rest of the module real (responseShape imports from it); stub only handleTurn.
vi.mock("@/app/tutor/conversation", async (orig) => ({
  ...(await orig<typeof import("@/app/tutor/conversation")>()),
  handleTurn: m.handleTurn,
}));
vi.mock("@/lib/historyCache", () => ({
  historyCache: {
    get: m.cacheGet,
    set: vi.fn(),
    append: m.cacheAppend,
    delete: m.cacheDelete,
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

// An active session row owned by u1, mid gap-check.
const sessionRow = {
  id: "sess-x",
  studentId: "u1",
  problemId: "p1",
  phase: "gap_check",
  status: "active",
  gapState: {
    gaps: [{ topicId: FRACTIONS, name: "Adding Fractions", resolved: false }],
  },
  solveAttemptRecorded: false,
};

// State handleTurn hands back (post-transition); active + still locked by default.
const activeState = {
  phase: "gap_check",
  status: "active",
  gaps: [{ topicId: FRACTIONS, name: "Adding Fractions", resolved: false }],
  solveAttemptRecorded: false,
};

/** A fake Anthropic reply stream that yields the given text chunks as deltas. */
async function* textStream(chunks: string[]) {
  for (const text of chunks) {
    yield { type: "content_block_delta", delta: { type: "text_delta", text } };
  }
}

function makeReq(body: unknown): NextRequest {
  return new Request("http://localhost/api/sessions/sess-x/message", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as NextRequest;
}

/** Calls the handler with the dynamic `[id]` route param. */
function call(body: unknown, id = "sess-x") {
  return POST(makeReq(body), { params: Promise.resolve({ id }) });
}

/** Drains the NDJSON body into parsed frame objects. */
async function readFrames(res: Response) {
  const text = await res.text();
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

beforeEach(() => {
  vi.clearAllMocks();
  m.requireUserApi.mockResolvedValue({ supabase: {}, user: { id: "u1" } });
  m.getProblemById.mockResolvedValue({ problem, courseId: "c1" });
  m.buildProfile.mockResolvedValue(profile);
  m.getSessionById.mockResolvedValue(sessionRow);
  m.updateSessionState.mockResolvedValue(true);
  m.setCompletionSummary.mockResolvedValue(true);
  m.handleTurn.mockResolvedValue({
    state: activeState,
    event: { type: "GAP_ATTEMPT", correct: false },
    judged: null,
    misconceptionFired: false,
    misconceptionPromise: null,
    masteryUpdated: false,
    stream: textStream(["Let's ", "check ", "fractions."]),
  });
  m.cacheGet.mockResolvedValue([]);
  m.cacheAppend.mockResolvedValue(undefined);
  m.cacheDelete.mockResolvedValue(undefined);
});

describe("POST /api/sessions/[id]/message — guards", () => {
  it("401 when unauthenticated", async () => {
    m.requireUserApi.mockResolvedValue(null);
    const res = await call({ message: "hi" });
    expect(res.status).toBe(401);
  });

  it("400 on unparseable body", async () => {
    const res = await call("{not json");
    expect(res.status).toBe(400);
  });

  it("400 when message is missing or blank", async () => {
    expect((await call({})).status).toBe(400);
    expect((await call({ message: "   " })).status).toBe(400);
  });

  it("404 when the session is not found", async () => {
    m.getSessionById.mockResolvedValue(null);
    const res = await call({ message: "hi" });
    expect(res.status).toBe(404);
  });

  it("403 when the session belongs to another student", async () => {
    m.getSessionById.mockResolvedValue({ ...sessionRow, studentId: "someone-else" });
    const res = await call({ message: "hi" });
    expect(res.status).toBe(403);
    expect(m.handleTurn).not.toHaveBeenCalled();
  });

  it("409 when the session is not active", async () => {
    m.getSessionById.mockResolvedValue({ ...sessionRow, status: "completed" });
    const res = await call({ message: "hi" });
    expect(res.status).toBe(409);
  });

  it("404 when the problem is not found", async () => {
    m.getProblemById.mockResolvedValue(null);
    const res = await call({ message: "hi" });
    expect(res.status).toBe(404);
  });

  it("500 when handleTurn throws (before the stream opens)", async () => {
    m.handleTurn.mockRejectedValue(new Error("claude down"));
    const res = await call({ message: "hi" });
    expect(res.status).toBe(500);
    expect(m.updateSessionState).not.toHaveBeenCalled();
  });
});

describe("POST /api/sessions/[id]/message — isFinalAttempt", () => {
  it("forwards isFinalAttempt: true to handleTurn", async () => {
    await call({ message: "48", isFinalAttempt: true });
    expect(m.handleTurn).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isFinalAttempt: true }),
    );
  });

  it("defaults to false when omitted", async () => {
    await call({ message: "48" });
    expect(m.handleTurn).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isFinalAttempt: false }),
    );
  });

  it("coerces any non-true value to false, not just literal false", async () => {
    // Strict equality to `true` — a truthy-but-not-boolean value (e.g. a stray
    // string) must not accidentally flag a turn as a final-answer attempt.
    await call({ message: "48", isFinalAttempt: "true" });
    expect(m.handleTurn).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isFinalAttempt: false }),
    );
  });
});

describe("POST /api/sessions/[id]/message — streaming turn", () => {
  it("streams meta first, then tokens, then done; persists state + transcript", async () => {
    const res = await call({ message: "the denominators match" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/x-ndjson");

    const frames = await readFrames(res);

    // meta is first and carries the post-turn snapshot (locked, no answer).
    expect(frames[0].type).toBe("meta");
    expect(frames[0].phase).toBe("gap_check");
    expect(frames[0].unlocked).toBe(false);
    expect(frames[0].problem.questionContent).toBeNull();

    // tokens in order, reassembling the reply.
    const tokens = frames.filter((f) => f.type === "token").map((f) => f.text);
    expect(tokens.join("")).toBe("Let's check fractions.");

    // done is last and reports the persisted status.
    expect(frames.at(-1)).toEqual({ type: "done", status: "active" });

    // The answer never leaks across any frame.
    expect(JSON.stringify(frames)).not.toContain("7/8");

    // Durable state persisted; transcript appended with this turn's pair.
    expect(m.updateSessionState).toHaveBeenCalledWith({}, "sess-x", activeState);
    expect(m.cacheAppend).toHaveBeenCalledWith(
      "sess-x",
      { role: "user", content: "the denominators match" },
      { role: "assistant", content: "Let's check fractions." },
    );
    expect(m.cacheDelete).not.toHaveBeenCalled();
    expect(m.setCompletionSummary).not.toHaveBeenCalled();
  });

  it("deletes the transcript and reports completed when the turn finishes the session", async () => {
    m.handleTurn.mockResolvedValue({
      state: {
        phase: "review",
        status: "completed",
        gaps: [],
        solveAttemptRecorded: true,
      },
      event: { type: "SOLVE_ATTEMPT", correct: true },
      judged: null,
      misconceptionFired: false,
      misconceptionPromise: null,
      masteryUpdated: true,
      stream: textStream(["Nicely done."]),
    });

    const res = await call({ message: "7/8" });
    const frames = await readFrames(res);

    expect(frames.at(-1)).toEqual({ type: "done", status: "completed" });
    expect(m.cacheDelete).toHaveBeenCalledWith("sess-x");
    expect(m.cacheAppend).not.toHaveBeenCalled();
    expect(m.setCompletionSummary).toHaveBeenCalledWith(
      {},
      "sess-x",
      "Nicely done.",
    );
  });

  it("emits an error frame (not a status code) if the reply stream fails mid-flight", async () => {
    async function* boom() {
      yield { type: "content_block_delta", delta: { type: "text_delta", text: "Let's " } };
      throw new Error("stream broke");
    }
    m.handleTurn.mockResolvedValue({
      state: activeState,
      event: null,
      judged: null,
      misconceptionFired: false,
      misconceptionPromise: null,
      masteryUpdated: false,
      stream: boom(),
    });

    const res = await call({ message: "hi" });
    expect(res.status).toBe(200); // already committed before the failure
    const frames = await readFrames(res);

    expect(frames[0].type).toBe("meta");
    expect(frames.some((f) => f.type === "token")).toBe(true);
    expect(frames.at(-1)).toEqual({ type: "error", message: "Reply stream failed" });
    // A failed turn does not write the transcript.
    expect(m.cacheAppend).not.toHaveBeenCalled();
    expect(m.setCompletionSummary).not.toHaveBeenCalled();
  });
});

describe("POST /api/sessions/[id]/message — deferred misconception write", () => {
  it("hands the misconception promise to after() when the pipeline fired", async () => {
    const misconceptionPromise = Promise.resolve();
    m.handleTurn.mockResolvedValue({
      state: activeState,
      event: { type: "GAP_ATTEMPT", correct: false },
      judged: null,
      misconceptionFired: true,
      misconceptionPromise,
      masteryUpdated: false,
      stream: textStream(["Let's ", "check ", "fractions."]),
    });

    await call({ message: "the denominators match" });

    expect(m.after).toHaveBeenCalledTimes(1);
    const [callback] = m.after.mock.calls[0] as [() => unknown];
    expect(callback()).toBe(misconceptionPromise);
  });

  it("does not call after() when the pipeline did not fire", async () => {
    await call({ message: "the denominators match" });
    expect(m.after).not.toHaveBeenCalled();
  });
});
