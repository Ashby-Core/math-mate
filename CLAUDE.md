# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Math Mate is an AI math-tutoring platform. Students work assignment problems through a Claude-powered tutor that (1) probes prerequisite topics that are weak ("gaps"), (2) resolves each gap with a mini-lesson, then (3) scaffolds the student through the problem without ever handing over the answer. Wrong answers are meant to feed inferred misconceptions back into the student's knowledge profile (Milestone 5, not yet built).

`TICKETS.md` is the authoritative roadmap and design record — it tracks milestones, per-ticket scope, and the resolved design decisions (gap threshold, mastery scale, session-persistence strategy, etc.). Read it before starting non-trivial work; update checkboxes when you complete a ticket.

## Commands

```bash
npm run dev          # Next.js dev server (localhost:3000)
npm run build        # production build
npm run lint         # next lint (eslint 9)
npm test             # vitest run (all *.test.ts under app/ and lib/)
npm run test:watch   # vitest watch mode
```

Run a single test file or filter by name:

```bash
npx vitest run app/tutor/stateMachine.test.ts
npx vitest run -t "resolves a gap on a correct answer"
npx vitest run -u    # update snapshots (e.g. app/tutor/systemPrompt snapshot)
```

Tests are pure-TS unit tests in a `node` environment (no jsdom). The `@/*` import alias resolves to the project root in both `tsconfig.json` and `vitest.config.ts` — keep them in sync if you change it.

## Architecture

The system is a strict dependency chain — DB → queries → tutor brain → HTTP → UI — where each layer is testable only with the one below it. Respect the layer boundaries; they're what makes the tutor brain unit-testable without a database or a live model.

### Data layer — `app/queries/` + `utils/supabase/`
- Typed query functions, one file per table/concern (`masteries.ts`, `weaknesses.ts`, `sessions.ts`, `problems.ts`, …). Each returns typed results and logs+swallows Supabase errors (returning `null`/`[]`), so callers branch on the value rather than catching.
- **Mastery is derived, never stored:** `mastery = attempted > 0 ? correct / attempted : null` (a `0–1` float; `null` = unassessed). This derivation lives once in the query layer and everyone downstream consumes it. `null` mastery is deliberately *not* a gap — don't probe unassessed topics.
- Supabase clients: `utils/supabase/server.ts` (`createClient`, cookie-bound SSR client used in route handlers and server components) and `utils/supabase/client.ts` (browser). `middleware.ts` refreshes sessions on every non-static request via `utils/supabase/middleware.ts`.
- SQL migrations live in `utils/supabase/migrations/` (numbered `NNNN_*.sql`). Row-level security is owner-scoped (`student_id = auth.uid()`) on all student data; migration 0003 adds a partial unique index enforcing at most one `active` session per `(student, problem)`.
- `app/queries/profile.ts::buildProfile` composes the mastery/weakness queries into the `StudentProfile` injected into the tutor prompt. It is rebuilt fresh per problem (never cached) so a mid-session misconception write is reflected on the next rebuild.

### Tutor brain — `app/tutor/` (pure logic + injected Claude)
This is the core. No HTTP, no direct DB — dependencies (the Anthropic client, Supabase client, misconception fn) are **injected** so everything is unit-testable with fakes.
- `stateMachine.ts` — the deterministic, serializable phase machine: `intro → gap_check → solve → review → completed`. Pure reducer (`advance(state, event)`); events come from judging a turn. `toPersisted`/`fromPersisted` map state to/from the `tutoring_sessions` row (phase + status columns, gaps in a `gap_state` jsonb).
- `gaps.ts` — single source of truth for *what is a gap*. A problem's prerequisites are exactly its tagged topics (`problem.tops`); there is no separate topic→topic prereq graph. `classifyTopic` → `GAP` / `OK` / `UNASSESSED` against `GAP_THRESHOLD`.
- `systemPrompt.ts` — builds the Sonnet system prompt as three blocks: a byte-identical `STATIC_RULES` policy block marked `cache_control: ephemeral` (stable, cacheable prefix — keep all per-student/per-turn content out of it), then per-session context, then the per-turn instruction. Snapshot-tested.
- `judge.ts` — a cheap Haiku structured-output classifier that decides, per turn, `isAttempt` and `correct`. Runs *before* the Sonnet reply so the phase can advance deterministically. Parse failure → `{isAttempt:false, correct:false}` (never advances on a flaky judge).
- `conversation.ts` — ties it together: `handleTurn` = judge → advance state → side effects (misconception pipeline on wrong answers, mastery update on completion) → stream the Sonnet reply. **All state and side effects resolve before the stream is consumed;** the stream is only the user-facing text and never affects state.
- `constants.ts` — models (`TUTOR_MODEL` Sonnet, `JUDGE_MODEL`/`MISCONCEPTION_MODEL` Haiku) and `GAP_THRESHOLD = 0.6`.

### HTTP layer — `app/api/sessions/`
- `POST /api/sessions` (`route.ts`) — bootstrap or resume a per-problem session. Generates the greeting *before* inserting the row so a Claude failure leaves no orphan; handles the concurrent-create race by falling back to resume.
- `POST /api/sessions/[id]/message` — one tutoring turn. Auth-guarded to the owning student. Responds with an **NDJSON stream**: a `meta` frame (post-turn phase/sidebar/lock, known up front because state settles before streaming), then `token` frames, then a terminal `done`/`error` frame. Once streaming starts the status is already 200, so mid-stream failures surface only as an `error` frame — clients must check for it.
- Both routes set `runtime = "nodejs"` and `dynamic = "force-dynamic"` (SDK + SSR client, never cached).
- `app/tutor/responseShape.ts` is the **firewall**: it keeps `correctAnswer` off the wire and gates problem text behind the server-owned phase (problem stays hidden until Solve). Never serialize domain objects to the client directly — go through this layer.

### Session persistence (two stores, on purpose)
- **Durable** small state (phase, gaps, status) → `tutoring_sessions` Postgres row.
- **Ephemeral** conversation transcript → `lib/historyCache.ts` (`HistoryCache` interface; currently `InMemoryHistoryCache`, intended to swap to Redis with no caller change). A cache miss is expected in multi-instance/serverless deploys — callers treat a miss as an empty history and continue. Transcript is deleted on completion (TTL is the safety net for abandoned sessions). Full transcript archival is out of scope; the durable learning signal lives in masteries/weaknesses.

### Front end — `app/` (App Router, React 19)
Server-component pages under `app/dashboard`, `app/courses`, `app/login`, etc.; shared shadcn/Radix primitives in `app/components/ui/`; Recharts for mastery charts. The tutoring UI (Milestone 4, `FE-*` tickets) is not built yet.

## Conventions worth knowing
- The misconception pipeline (`app/queries/claude.ts::inferMisconception`) is currently a **no-op stub** always returning `null`. `conversation.ts` already calls it on wrong answers; Milestone 5 replaces the body and wires the async write path. Don't assume it does anything yet.
- When adding a query function, follow the existing shape: typed return, `console.error` + return empty/null on Supabase error, use the injected/SSR client — and add a colocated `*.test.ts`.
- Keep Claude models and thresholds in `app/tutor/constants.ts`, not inline.
- Supabase MCP server (`.mcp.json`) requires interactive auth before its tools are usable.
