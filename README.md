# Math Mate

An AI math-tutoring platform. Students work assignment problems through a Claude-powered tutor that checks prerequisite knowledge, resolves weak spots ("gaps") with a mini-lesson, then scaffolds the student through the problem itself — without ever handing over the answer.

## Overview

Each tutoring session walks a fixed path:

1. **Intro** — greet the student and set up the problem.
2. **Gap check** — probe the topics the problem depends on. Any topic below the mastery threshold gets a short mini-lesson and a follow-up check before moving on.
3. **Solve** — the problem is revealed and the tutor scaffolds the student toward a solution (hints and guiding questions, never the answer).
4. **Review** — a wrap-up once the student answers correctly.

A judge model classifies each turn (attempted? correct?) before the tutor replies, so phase transitions are deterministic rather than inferred from prose. Wrong answers are meant to feed inferred misconceptions back into the student's knowledge profile — that write-back loop is a planned milestone and not implemented yet.

## Objectives and goals

- **Never give away the answer.** The tutor scaffolds and questions; it doesn't solve.
- **Fix prerequisites before the problem.** A student missing foundational topics gets a mini-lesson first, so the main problem is tackled with the right footing.
- **Make mastery a derived, honest signal.** Mastery is computed from attempt history (`correct / attempted`), never hand-set, and unassessed topics are treated as unknown rather than as gaps.
- **Keep the tutor brain testable in isolation.** The core state machine and prompt logic have no direct DB or HTTP dependency, so tutoring behavior can be unit-tested with fakes.
- **Close the loop on mistakes (in progress).** Wrong answers should eventually update an inferred-misconceptions profile that shapes future sessions.

## Tech stack

- [Next.js 15](https://nextjs.org) (App Router) + React 19
- [Supabase](https://supabase.com) (Postgres + Auth, via `@supabase/ssr`)
- [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript) — Claude Sonnet for tutoring, Claude Haiku for turn judging
- shadcn/ui + Radix + Tailwind 4 + Recharts
- Vitest for unit tests

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (URL + anon key)
- An [Anthropic API key](https://console.anthropic.com)

## Installation

1. **Clone and install dependencies**

   ```bash
   git clone <repo-url>
   cd math-mate
   npm install
   ```

2. **Configure environment variables**

   Create a `.env.local` file in the project root:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ANTHROPIC_API_KEY=your-anthropic-api-key
   ```

3. **Set up the database**

   Apply the SQL migrations in `utils/supabase/migrations/` to your Supabase project, in numeric order (via the Supabase SQL editor or CLI). They set up the student/topic/mastery schema, the `tutoring_sessions` table, and row-level security (owner-scoped to `student_id = auth.uid()`).

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

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
```

## Project structure

- `app/queries/` — typed Supabase query functions (masteries, weaknesses, sessions, problems).
- `app/tutor/` — the tutor brain: state machine, gap classification, system prompt builder, turn judge, and conversation orchestration. Pure logic with injected dependencies (no direct DB/HTTP), so it's unit-testable with fakes.
- `app/api/sessions/` — HTTP layer: session bootstrap/resume and the per-turn message endpoint (streamed as NDJSON).
- `utils/supabase/` — Supabase client setup and SQL migrations.
- `lib/historyCache.ts` — ephemeral conversation-transcript cache, separate from the durable session row.
- `app/` (App Router pages) — dashboard, courses, login, and the tutoring UI.

See [TICKETS.md](TICKETS.md) for the full roadmap, milestone status, and resolved design decisions, and [CLAUDE.md](CLAUDE.md) for a deeper architectural writeup.
