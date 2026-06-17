# Math Mate — Implementation Tickets

AI math tutoring platform. Students complete assignment problems through a Claude-powered
tutor that checks prerequisite knowledge, resolves gaps with mini-lessons, then scaffolds
the student through the problem. Misconceptions inferred from wrong answers feed back into
the student's knowledge profile.

**Stack:** Next.js 15 (App Router) + React 19 · Next.js route handlers · Supabase (Postgres)
· Redis (student-keyed cache for active-session conversation history; free tier ~30 MB is
ample — sized by *concurrent* active sessions, ~75 KB each) · `@anthropic-ai/sdk` (Sonnet
`claude-sonnet-4-6` for tutoring, Haiku `claude-haiku-4-5-20251001` for misconception
inference) · shadcn/ui + Radix + Tailwind 4 + Recharts.

**Labels:** Priority P0 (high) / P1 (med) / P2 (low) · Size XS / S / M / L / XL.

---

## ⚠️ Decisions to resolve before their milestone

- [x] **Mastery threshold for "gap"** → `0.6` — affects **TS-2**
- [x] **Mastery for unassessed topics** → **`null`** ("not yet assessed", don't probe). Applies to both `problems_attempted = 0` and topics with no row. — resolved; affects **KP-1**, **TS-2**
- [x] **Mastery scale** → **`0–1` float** from the query; format to percentage at render only. — resolved; affects **DB-3**, **KP-1**, **FE-3**
- [x] **Prerequisite → problem mapping source** (confirm a problem↔topic relation exists) — blocks **TS-2**
- [x] **Session persistence** → **durable `tutoring_sessions` row in Postgres** (phase + gap state, one per problem) + **conversation history in a student-keyed Redis cache** with an inactivity TTL. History is deleted on completion (explicit delete; TTL is the safety net for abandoned sessions). **Full transcript archival is out of scope for v1** — the durable learning signal already lives in masteries/weaknesses. — resolved; blocks **API-2**, adds **DB-4**
- [x] **`mastery_score` update rule on completion** → (increment problems_attempted (and problems_correct if student was correct) for topic(s)) — blocks **TS-3**
- [x] **Streaming vs. full response** → streaming — affects **API-1**, **FE-2**
- [x] **Semantic-dedup method** → Haiku classification — blocks **MI-2**

---

## Milestone 1 — Data foundation
*Exit: produce the exact profile JSON for a real student.*

- [x] **DB-2** · P0 · XS — Weakness dedup support columns / defaults — verified already satisfied (observed_count def 1, last_observed def now(), description varchar(100))
  - `observed_count` default 1; `created_at`/`last_observed` default `now()`.
  - Update path: `observed_count = observed_count + 1, last_observed = now()` by id.
  - Verify `description` varchar(100) cap; inference output must be validated/truncated to fit.
  - Note: semantic dedup lives in MI-2, not a DB constraint.
- [x] **DB-3** · P0 · S — Typed query functions (`app/queries/`) — `masteries.ts` + `weaknesses.ts`
  - `getMasteries(studentId, courseId)`, `getWeaknesses(studentId, courseId)`.
  - **Mastery is derived, not stored:** compute `mastery = attempted > 0 ? correct / attempted : null` (0–1 float) in this layer (single source of truth for all consumers — page, profile builder, gap logic). Return the raw `problems_attempted` / `problems_correct` alongside the derived mastery.
  - `insertWeakness(...)`, `incrementWeakness(id)`, and an update path for `problems_attempted` / `problems_correct` on completion.
  - All return typed results; use the server Supabase client (`@supabase/ssr`).
- [x] **DB-1** · P1 · XS — Indexes for profile-assembly joins (migration 0001; also added owner-scoped UPDATE RLS to unblock writes)
  - Composite `student_topic_masteries (student_id, course_id)`.
  - `student_topic_weaknesses (student_id, topic_id)`; `topics (slug)`.
- [x] **KP-1** · P0 · M — Profile assembly query (`app/queries/profile.ts` → `assembleProfile`)
  - Returns `{ courseName, student:{id,name}, topicMasteryScores:{slug:float}, weaknesses:{slug:[string]} }`.
  - `topicMasteryScores` uses the derived `0–1` mastery from DB-3 (computed from `problems_correct` / `problems_attempted`); unassessed topics (`attempted = 0` or no row) are `null`.
  - Multiple weaknesses per topic group into an array.
  - Unit-tested against a seeded student fixture (include an unattempted-topic case).
- [x] **KP-2** · P0 · S — Profile builder service + rebuild hook (`app/queries/profile.ts` → `buildProfile`)
  - `buildProfile(studentId, courseId)` returns validated profile.
  - Rebuilt from DB at the start of each new problem (not cached across problems).
  - Stable shape when masteries/weaknesses are empty. No Claude calls here.
- [x] **DB-4** · P0 · XS — `tutoring_sessions` table (durable session state) (migration 0002, owner-scoped RLS)
  - Columns: `id`, `student_id`, `problem_id`, `phase`, gap-resolution state, `status` (active/completed/abandoned), `created_at`, `updated_at`. One row per problem-session.
  - Holds only small structured state needed to resume — **not** the conversation transcript (that lives in the Redis cache; see session-persistence decision).
  - Reversible migration. Index on `(student_id, status)` for resume lookups.

## Milestone 2 — Tutoring brain
*Exit: Intro → Gap check → Solve → Review runs correctly given an input message (no UI).*

- [ ] **TS-1** · P0 · M — System prompt builder
  - Merges profile (KP-2) + current problem; encodes probe-gaps-first, one mini-lesson per gap, scaffold not answer.
  - Snapshot-tested. Model `claude-sonnet-4-6`; consider prompt caching for the static block.
- [ ] **TS-2** · P0 · L — Phase state machine *(resolve threshold + prerequisite-mapping decisions first)*
  - Gap topics = prerequisites with mastery below threshold. `null` (unassessed) is **not** a gap — don't probe it.
  - Gap check: one mini-lesson + one follow-up per gap; one correct answer resolves it.
  - Problem gated until all gaps resolved; transitions deterministic and serializable.
- [ ] **TS-3** · P0 · L — Conversation handler *(stub the MI trigger as a no-op for now)*
  - Takes message + state → Sonnet reply + updated phase.
  - Detects correct/incorrect follow-up answers; on wrong answer fires MI pipeline (stubbed).
  - On completion: mastery update + summary.

## Milestone 3 — Wire it to HTTP
*Exit: full session drivable via curl/Postman.*

- [ ] **API-2** · P0 · S — Session bootstrap / profile endpoint
  - `POST /api/sessions` → creates (or resumes) a `tutoring_sessions` row (DB-4), returns session id, profile, initial phase (Intro), gap topics, locked problem.
  - Rebuilds profile fresh (KP-2). Returns sidebar data (mastery bars, gap/ok/checking tags, stats scaffold).
  - Conversation history is held in the student-keyed Redis cache, not the session row. On resume, rehydrate history from cache (cache miss → fresh chat against the rebuilt profile, phase from the durable row).
  - On completion: mark the row `completed` and delete the cached transcript.
- [ ] **API-1** · P0 · M — Tutoring turn endpoint
  - `POST /api/sessions/[id]/message` → reply + phase + gap status. Auth-guarded to owning student.
  - Streams tokens if TS-3 streams.

## Milestone 4 — UI (first usable demo)
*Exit: a person can complete a problem end-to-end in the browser.*

- [ ] **FE-1** · P0 · S — Split layout shell (chat left, sidebar right; responsive). Wired to API-2.
- [ ] **FE-2** · P0 · M — Chat panel + phase pills
  - Sends to API-1, renders (streamed) replies; active pill reflects phase; in-flight/optimistic states.
- [ ] **FE-4** · P0 · S — Locked problem reveal
  - Hidden during Intro + Gap check; auto-reveals on Solve. Lock derives from server phase only.
- [ ] **FE-3** · P1 · M — Knowledge sidebar
  - Mastery bars (Recharts), per-topic gap/ok/checking tags, live session stats; updates as gaps resolve.

## Milestone 5 — Misconception pipeline (close the loop)
*Exit: wrong answers feed back into the profile over time. Deferred safely — nothing in the live session blocks on it.*

- [ ] **MI-1** · P1 · M — Haiku misconception inference call
  - `inferMisconception({problem, correctAnswer, studentAnswer, topicId})` → `string | null`.
  - 5–10 words, ≤100 chars; clean `null` for careless mistakes. Prefer structured/JSON output.
  - Model `claude-haiku-4-5-20251001`. Replaces the placeholder in `app/queries/claude.ts`.
- [ ] **MI-2** · P1 · M — Semantic dedup *(resolve dedup-method decision first)*
  - Compare inferred string to existing weaknesses for student+topic → matching id or "novel".
  - Configurable, documented threshold.
- [ ] **MI-3** · P1 · S — Async write path + un-stub TS-3
  - Triggered async on wrong answer (Next.js `after()`), never blocks the reply.
  - Novel → `insertWeakness`; duplicate → `incrementWeakness`; `null` → no write.
  - Failures logged and swallowed. Ensure writes land before the next problem's profile rebuild.
  - Flip the TS-3 MI no-op (step from M2) to the real call.

---

## Why this order

- **Strict dependency chain:** DB → KP → TS → API → FE; a layer can't be meaningfully tested without the one below it.
- **MI deferred on purpose:** it's the only write-only, async subsystem — nothing in the live flow waits on it, so it ships last and incrementally.
- **Earliest demo:** M1→M4 is the fastest path to clicking through a real session; the P1 sidebar (FE-3) is last so its absence doesn't block the demo.

> Note: FE-3 is labeled P1 but the knowledge sidebar is the platform's signature UI — bump to P0 if this goes in front of stakeholders.
