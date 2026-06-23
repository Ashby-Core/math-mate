import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { requireUserApi } from "@/app/queries/auth";
import { getProblemById } from "@/app/queries/problems";
import { isStudentEnrolled } from "@/app/queries/enrollments";
import { buildProfile } from "@/app/queries/profile";
import { createSession, getActiveSession } from "@/app/queries/sessions";
import { getAnthropic } from "@/app/tutor/anthropic";
import { openSession, SESSION_SEED_MESSAGE } from "@/app/tutor/conversation";
import { fromPersisted, initTutoringState } from "@/app/tutor/stateMachine";
import { toSessionResponse } from "@/app/tutor/responseShape";
import { historyCache } from "@/lib/historyCache";

// API-2 — POST /api/sessions: bootstrap or resume a per-problem tutoring session.
// Needs Node (Anthropic SDK + Supabase SSR client) and must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Concatenates the text blocks of a completed assistant message. */
function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export async function POST(req: NextRequest) {
  const auth = await requireUserApi();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, user } = auth;

  // Parse + validate the body.
  let problemId: unknown;
  try {
    const body = await req.json();
    problemId = body?.problemId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof problemId !== "string" || problemId.trim() === "") {
    return NextResponse.json({ error: "problemId is required" }, { status: 400 });
  }

  // Load the problem + its course; authorize the student.
  const found = await getProblemById(supabase, problemId);
  if (!found) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  }
  const { problem, courseId } = found;

  if (!(await isStudentEnrolled(supabase, user.id, courseId))) {
    return NextResponse.json(
      { error: "Not enrolled in this course" },
      { status: 403 },
    );
  }

  const profile = await buildProfile(supabase, user.id, courseId);

  try {
    // Resume the active session if one exists (durable phase from the row;
    // transcript from the cache, empty on a miss).
    const existing = await getActiveSession(supabase, user.id, problemId);
    if (existing) {
      const state = fromPersisted(existing);
      const history = (await historyCache.get(existing.id)) ?? [];
      return NextResponse.json(
        toSessionResponse({ sessionId: existing.id, state, profile, problem, history }),
        { status: 200 },
      );
    }

    // Create a fresh session. Generate the greeting FIRST so a Claude failure
    // leaves no orphan row + empty cache entry.
    const state = initTutoringState(profile, problem);
    const { stream } = await openSession(
      { anthropic: getAnthropic(), supabase },
      { profile, problem, state },
    );
    const greeting = textOf(await stream.finalMessage());

    const created = await createSession(supabase, {
      studentId: user.id,
      problemId,
      state,
    });
    if (created === null) {
      return NextResponse.json(
        { error: "Could not create session" },
        { status: 500 },
      );
    }

    // Lost a concurrent-create race → resume whichever row won.
    if ("conflict" in created) {
      const winner = await getActiveSession(supabase, user.id, problemId);
      if (!winner) {
        return NextResponse.json(
          { error: "Could not resume session" },
          { status: 500 },
        );
      }
      const state = fromPersisted(winner);
      const history = (await historyCache.get(winner.id)) ?? [];
      return NextResponse.json(
        toSessionResponse({ sessionId: winner.id, state, profile, problem, history }),
        { status: 200 },
      );
    }

    const history: Anthropic.MessageParam[] = [
      { role: "user", content: SESSION_SEED_MESSAGE },
      { role: "assistant", content: greeting },
    ];
    await historyCache.set(created.id, history);

    return NextResponse.json(
      toSessionResponse({ sessionId: created.id, state, profile, problem, history }),
      { status: 200 },
    );
  } catch (err) {
    console.error("Error bootstrapping session:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
