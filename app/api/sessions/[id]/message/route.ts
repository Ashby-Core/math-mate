import { NextRequest, NextResponse } from "next/server";
import { requireUserApi } from "@/app/queries/auth";
import { getProblemById } from "@/app/queries/problems";
import { buildProfile } from "@/app/queries/profile";
import { getSessionById, updateSessionState } from "@/app/queries/sessions";
import { getAnthropic } from "@/app/tutor/anthropic";
import { handleTurn } from "@/app/tutor/conversation";
import { fromPersisted, isComplete } from "@/app/tutor/stateMachine";
import { toTurnMeta } from "@/app/tutor/responseShape";
import { historyCache } from "@/lib/historyCache";

// API-1 — POST /api/sessions/[id]/message: process one tutoring turn.
// Needs Node (Anthropic SDK + Supabase SSR client) and must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The response is an NDJSON stream: one JSON object per line, separated by "\n".
// We send a `meta` line first (the post-turn phase/sidebar/lock — known up front
// because handleTurn resolves all state before the reply streams), then a `token`
// line per chunk of Claude's reply, then a final `done` (or `error`) line.
type Frame =
  | { type: "meta"; [k: string]: unknown }
  | { type: "token"; text: string }
  | { type: "done"; status: string }
  | { type: "error"; message: string };

const encoder = new TextEncoder();

/** Encodes one frame as a single NDJSON line (`{...}\n`). */
function line(frame: Frame): Uint8Array {
  return encoder.encode(JSON.stringify(frame) + "\n");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // In Next.js 15 the dynamic route params are async.
  const { id: sessionId } = await params;

  // --- Everything up to the stream returns a normal JSON status code. Once we
  //     start streaming we've already sent 200, so failures after that point can
  //     only surface as an `error` frame (see the ReadableStream below).

  const auth = await requireUserApi();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, user } = auth;

  // Parse + validate the body.
  let message: unknown;
  try {
    const body = await req.json();
    message = body?.message;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof message !== "string" || message.trim() === "") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Load the session and authorize: it must exist, belong to the caller, and be
  // active. (RLS should already scope rows to the owner; the explicit check is
  // defense-in-depth and lets us return a precise 403 rather than a 404.)
  const session = await getSessionById(supabase, sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.studentId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (session.status !== "active") {
    return NextResponse.json(
      { error: "Session is not active" },
      { status: 409 },
    );
  }

  // Load the problem (and its course) so we can rebuild the profile + judge.
  const found = await getProblemById(supabase, session.problemId);
  if (!found) {
    return NextResponse.json({ error: "Problem not found" }, { status: 404 });
  }
  const { problem, courseId } = found;
  const profile = await buildProfile(supabase, user.id, courseId);

  // Rehydrate state from the durable row and the transcript from the cache. A
  // cache miss yields an empty history — the turn still runs (fresh chat against
  // the rebuilt profile), matching the resume policy from the session decision.
  const state = fromPersisted(session);
  const history = (await historyCache.get(sessionId)) ?? [];

  // Run the turn. This makes the judge call, advances the phase, fires the
  // (stubbed) misconception + mastery side effects, and hands back the reply
  // stream — all the state is settled by the time this resolves. A throw here is
  // still a clean 500 because we haven't opened the response stream yet.
  let result;
  try {
    result = await handleTurn(
      { anthropic: getAnthropic(), supabase },
      { profile, problem, state, history, studentMessage: message },
    );
  } catch (err) {
    console.error("Error handling turn:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const newState = result.state;

  // Persist the new durable state before streaming. The transcript is written
  // only after the reply finishes (we need the full assistant text first).
  await updateSessionState(supabase, sessionId, newState);

  const completed = isComplete(newState);
  const meta = toTurnMeta({ state: newState, profile, problem });

  // Build the NDJSON stream: meta first, then forward Claude's text deltas as
  // they arrive, then persist the transcript and emit a terminal frame.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(line({ type: "meta", ...meta }));

      let assistantText = "";
      try {
        // The Anthropic stream yields raw events; we forward only text deltas.
        for await (const event of result.stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            assistantText += event.delta.text;
            controller.enqueue(line({ type: "token", text: event.delta.text }));
          }
        }

        // Persist the turn. On completion the transcript is dropped (the durable
        // learning signal already lives in masteries/weaknesses); otherwise we
        // append this turn's user + assistant messages for the next turn.
        if (completed) {
          await historyCache.delete(sessionId);
        } else {
          await historyCache.append(
            sessionId,
            { role: "user", content: message },
            { role: "assistant", content: assistantText },
          );
        }

        controller.enqueue(line({ type: "done", status: newState.status }));
      } catch (err) {
        // We've already sent 200 + the meta frame, so the only way to signal a
        // mid-stream failure is an error frame. The client must check for it.
        console.error("Error streaming turn reply:", err);
        controller.enqueue(
          line({ type: "error", message: "Reply stream failed" }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  });
}
