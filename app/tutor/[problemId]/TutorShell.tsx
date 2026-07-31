"use client";

import React, { useEffect, useState } from "react";
import type { Phase } from "@/app/tutor/stateMachine";
import type { DisplayMessage, SessionResponse } from "@/app/tutor/responseShape";
import { parseFrame, splitLines } from "@/app/tutor/parseStream";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import Composer from "./Composer";

// The split layout shell: chat on the left, knowledge sidebar on the right,
// stacking on narrow viewports. It bootstraps the per-problem session from
// POST /api/sessions, then streams each turn from POST
// /api/sessions/[id]/message and renders the phase-aware chrome. Mastery bars
// and the locked-problem reveal are layered in on top of these regions — this
// file owns the layout, the session bootstrap, and the turn/streaming state.

const PHASES: { key: Phase; label: string }[] = [
  { key: "intro", label: "Intro" },
  { key: "gap_check", label: "Gap check" },
  { key: "solve", label: "Solve" },
  { key: "review", label: "Review" },
];

/** Turn-in-flight state, separate from the outer LoadState/session status. */
type TurnState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "streaming"; assistantText: string }
  | { kind: "error"; message: string };

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; session: SessionResponse; turn: TurnState };

export default function TutorShell({ problemId }: { problemId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [composerText, setComposerText] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ problemId }),
        });
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setState({
            status: "error",
            message: body?.error ?? "Could not start this session.",
          });
          return;
        }
        setState({
          status: "ready",
          session: body as SessionResponse,
          turn: { kind: "idle" },
        });
      } catch {
        if (!cancelled) {
          setState({ status: "error", message: "Network error. Try again." });
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [problemId]);

  async function handleSend(sessionId: string, text: string) {
    const userMessage: DisplayMessage = { role: "user", content: text };

    setComposerText("");
    setState((s) =>
      s.status !== "ready"
        ? s
        : {
            ...s,
            session: {
              ...s.session,
              messages: [...s.session.messages, userMessage],
            },
            turn: { kind: "sending" },
          },
    );

    const fail = (message: string) => {
      setComposerText(text);
      setState((s) => {
        if (s.status !== "ready") return s;
        // Drop the optimistic user bubble — nothing was accepted, so the
        // failed message shouldn't linger in the transcript.
        const messages = s.session.messages.filter((m) => m !== userMessage);
        return {
          ...s,
          session: { ...s.session, messages },
          turn: { kind: "error", message },
        };
      });
    };

    try {
      const res = await fetch(`/api/sessions/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        fail(body?.error ?? "Could not send that message.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const { lines, remainder } = splitLines(
          buffer,
          decoder.decode(value, { stream: true }),
        );
        buffer = remainder;

        for (const raw of lines) {
          let frame;
          try {
            frame = parseFrame(raw);
          } catch {
            fail("Received a malformed reply. Try again.");
            return;
          }

          if (frame.type === "meta") {
            const { phase, status, unlocked, problem, gaps, sidebar } = frame;
            setState((s) =>
              s.status !== "ready"
                ? s
                : {
                    ...s,
                    session: {
                      ...s.session,
                      phase,
                      status,
                      unlocked,
                      problem,
                      gaps,
                      sidebar,
                    },
                    turn: { kind: "streaming", assistantText: "" },
                  },
            );
          } else if (frame.type === "token") {
            setState((s) =>
              s.status !== "ready" || s.turn.kind !== "streaming"
                ? s
                : {
                    ...s,
                    turn: {
                      kind: "streaming",
                      assistantText: s.turn.assistantText + frame.text,
                    },
                  },
            );
          } else if (frame.type === "done") {
            setState((s) => {
              if (s.status !== "ready") return s;
              const assistantText =
                s.turn.kind === "streaming" ? s.turn.assistantText : "";
              return {
                ...s,
                session: {
                  ...s.session,
                  messages: [
                    ...s.session.messages,
                    { role: "assistant", content: assistantText },
                  ],
                },
                turn: { kind: "idle" },
              };
            });
          } else if (frame.type === "error") {
            fail(frame.message);
            return;
          }
        }
      }
    } catch {
      fail("Network error. Try again.");
    }
  }

  if (state.status === "loading") {
    return <CenteredNote>Starting your session…</CenteredNote>;
  }
  if (state.status === "error") {
    return <CenteredNote tone="error">{state.message}</CenteredNote>;
  }

  const { session, turn } = state;
  const completed = session.status === "completed";
  const composerDisabled =
    turn.kind === "sending" || turn.kind === "streaming" || completed;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:flex-row lg:overflow-hidden">
      {/* Chat column — the primary work surface. */}
      <section className="flex min-h-0 flex-1 flex-col">
        <SessionHeader session={session} />
        <Card className="mt-4 flex min-h-0 flex-1 flex-col">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            {session.messages.length === 0 && turn.kind !== "streaming" ? (
              <p className="text-muted-foreground">No messages yet.</p>
            ) : (
              session.messages.map((m, i) => <MessageBubble key={i} message={m} />)
            )}
            {turn.kind === "streaming" && (
              <MessageBubble
                message={{ role: "assistant", content: turn.assistantText }}
              />
            )}
          </CardContent>
        </Card>
        {turn.kind === "error" && (
          <p className="text-destructive mt-2 text-sm">{turn.message}</p>
        )}
        <div className="mt-2">
          {completed ? (
            <p className="text-muted-foreground text-sm">
              This problem is complete.
            </p>
          ) : (
            <Composer
              value={composerText}
              onChange={setComposerText}
              onSend={(text) => handleSend(session.sessionId, text)}
              disabled={composerDisabled}
            />
          )}
        </div>
      </section>

      {/* Sidebar column — knowledge state + current problem. Placeholder content;
          mastery bars and live stats are wired up separately. */}
      <aside className="flex w-full flex-col gap-4 lg:w-[360px] lg:shrink-0 lg:overflow-y-auto">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Topic readiness</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {session.sidebar.tags.length === 0 ? (
              <p className="text-muted-foreground">No prerequisites tagged.</p>
            ) : (
              session.sidebar.tags.map((t) => (
                <div key={t.topicId} className="flex items-center justify-between">
                  <span>{t.name}</span>
                  <span className="text-muted-foreground text-xs uppercase">
                    {t.status}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Current problem</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs">
              Problem {session.problem.orderIndex + 1}
            </p>
            {/* Question text is gated behind the server phase — null until Solve. */}
            {session.problem.questionContent ? (
              <p>{session.problem.questionContent}</p>
            ) : (
              <p className="text-muted-foreground">Unlocks after gap check.</p>
            )}
            <div className="text-muted-foreground mt-2 flex justify-between text-xs">
              <span>Gaps resolved</span>
              <span>
                {session.sidebar.stats.gapsResolved}/
                {session.sidebar.stats.gapsTotal}
              </span>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function MessageBubble({ message }: { message: DisplayMessage }) {
  return (
    <div
      className={
        message.role === "user"
          ? "self-end rounded-lg bg-primary/10 px-3 py-2"
          : "self-start rounded-lg bg-muted px-3 py-2"
      }
    >
      {message.content}
    </div>
  );
}

function SessionHeader({ session }: { session: SessionResponse }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-semibold">
        Problem {session.problem.orderIndex + 1}
      </h1>
      <div className="flex gap-1.5">
        {PHASES.map((p) => (
          <span
            key={p.key}
            className={
              p.key === session.phase
                ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                : "rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
            }
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function CenteredNote({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "error";
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <p className={tone === "error" ? "text-destructive" : "text-muted-foreground"}>
        {children}
      </p>
    </div>
  );
}
