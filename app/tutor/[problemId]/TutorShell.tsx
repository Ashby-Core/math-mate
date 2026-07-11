"use client";

import React, { useEffect, useState } from "react";
import type { Phase } from "@/app/tutor/stateMachine";
import type { SessionResponse } from "@/app/tutor/responseShape";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";

// The split layout shell: chat on the left, knowledge sidebar on the right,
// stacking on narrow viewports. It bootstraps the per-problem session from
// POST /api/sessions and renders the phase-aware chrome. The interactive chat
// (send/stream), live mastery bars, and the locked-problem reveal are layered in
// on top of these regions — this file only owns the layout + data wiring.

const PHASES: { key: Phase; label: string }[] = [
  { key: "intro", label: "Intro" },
  { key: "gap_check", label: "Gap check" },
  { key: "solve", label: "Solve" },
  { key: "review", label: "Review" },
];

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: SessionResponse };

export default function TutorShell({ problemId }: { problemId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

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
        setState({ status: "ready", data: body as SessionResponse });
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

  if (state.status === "loading") {
    return <CenteredNote>Starting your session…</CenteredNote>;
  }
  if (state.status === "error") {
    return <CenteredNote tone="error">{state.message}</CenteredNote>;
  }

  const session = state.data;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:h-[calc(100dvh-4rem)] lg:flex-row lg:overflow-hidden">
      {/* Chat column — the primary work surface. */}
      <section className="flex min-h-0 flex-1 flex-col">
        <SessionHeader session={session} />
        {/* Transcript + composer are filled in by the chat panel work; the shell
            just provides the scroll container and the seed messages. */}
        <Card className="mt-4 flex min-h-0 flex-1 flex-col">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            {session.messages.length === 0 ? (
              <p className="text-muted-foreground">No messages yet.</p>
            ) : (
              session.messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "self-end rounded-lg bg-primary/10 px-3 py-2"
                      : "self-start rounded-lg bg-muted px-3 py-2"
                  }
                >
                  {m.content}
                </div>
              ))
            )}
          </CardContent>
        </Card>
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
