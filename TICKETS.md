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

Each ticket below has an **Overview** (why it exists, what it plugs into) and
**Acceptance criteria** (what "done" means). For shipped tickets these describe what was
actually built, with real file/function references, so a fresh session can verify state
instead of re-deriving it. For open tickets they're a concrete spec to implement against —
file paths and existing types are named directly so the next session doesn't have to
rediscover the architecture from scratch.

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

- [x] **DB-2** · P0 · XS — Weakness dedup support columns / defaults
  **Overview:** The misconception pipeline (Milestone 5) needs to tell a *recurring*
  misconception from a brand-new one without re-deriving bookkeeping columns by hand.
  `observed_count` / `last_observed` exist so `incrementWeakness` (see DB-3) can bump a
  counter instead of inserting a duplicate row, and the `description` cap keeps the column
  bounded regardless of what a model generates.
  **Acceptance criteria:**
  - `student_topic_weaknesses.observed_count` defaults to `1` on insert — verified.
  - `created_at` and `last_observed` default to `now()` — verified.
  - `description` is `varchar(100)`; `insertWeakness` (`app/queries/weaknesses.ts`) truncates to this cap before insert so a longer model output can never violate the column — verified.
  - No DB-level uniqueness on `(student_id, topic_id, description)` — semantic dedup is intentionally an application-layer concern (**MI-2**), not a constraint.

- [x] **DB-3** · P0 · S — Typed query functions (`app/queries/`) — `masteries.ts` + `weaknesses.ts`
  **Overview:** The single place mastery is computed. Every downstream consumer — the gap
  classifier (`gaps.ts`), the profile builder (KP-1/KP-2), the sidebar (FE-3) — reads
  mastery through this layer so there is exactly one definition of "gap" in the system.
  Also owns the weakness CRUD the misconception pipeline will drive.
  **Acceptance criteria:**
  - `getMasteries(supabase, studentId, courseId)` returns one `TopicMastery` per course topic (LEFT-joined so unattempted topics still appear), with `mastery = attempted > 0 ? correct / attempted : null` (`app/queries/masteries.ts:24`).
  - `updateMasteryCounts(supabase, studentId, topicId, wasCorrect)` upserts on `(student_id, topic_id)`, incrementing `problems_attempted` (and `problems_correct` when correct) — used by `conversation.ts` on session completion.
  - `getWeaknesses`, `insertWeakness`, `incrementWeakness` in `weaknesses.ts` — typed, truncate/normalize as described in DB-2.
  - Every function logs the Supabase error and returns `null`/`[]` on failure rather than throwing — callers branch on the return value.
  - Colocated `*.test.ts` per file (`masteries.test.ts`, `weaknesses.test.ts`) covering the derivation edge case (`attempted = 0` → `null`) and the error path.

- [x] **DB-1** · P1 · XS — Indexes + RLS for profile-assembly joins (migration `0001_profile_indexes_and_rls.sql`)
  **Overview:** KP-1's profile query joins masteries and weaknesses per student per
  course on every problem load; this migration makes that join cheap and closes a write
  hole where the initial schema had no owner-scoped UPDATE policy (mastery/weakness
  updates were silently rejected before this landed).
  **Acceptance criteria:**
  - `idx_weaknesses_student_topic` on `student_topic_weaknesses (student_id, topic_id)` exists. (No separate index was needed for masteries — `(student_id, topic_id)` is already covered by the pre-existing `unique_student_topic` constraint.)
  - Owner-scoped `UPDATE` RLS policies exist on both `student_topic_masteries` and `student_topic_weaknesses` (`student_id = auth.uid()`), unblocking `updateMasteryCounts` / `incrementWeakness`.
  - `INSERT` policies are owner-scoped (`with check (student_id = auth.uid())`) rather than open — a student can only write rows attributed to themselves.
  - Migration is reversible (guarded with `if not exists` / `drop policy if exists`, safe to re-run).

- [x] **KP-1** · P0 · M — Profile assembly query (`app/queries/profile.ts` → `buildProfile`)
  **Overview:** Turns raw mastery/weakness rows into the exact shape the tutoring system
  prompt (TS-1) and the client sidebar (FE-3) both consume — keyed by topic id, human
  names attached, so nothing downstream re-joins topics itself.
  **Acceptance criteria:**
  - Returns `StudentProfile = { courseName, student: {id, name}, topicMasteryScores: Record<topicId, {name, mastery}>, weaknesses: Record<topicId, {name, items: string[]}> }` (`app/types.ts:70`).
  - `topicMasteryScores` includes every course topic (via `getMasteries`'s LEFT join); unassessed topics carry `mastery: null`, never a fabricated `0`.
  - Multiple weaknesses for the same topic collapse into one entry with `items` as an array of descriptions.
  - Shape stays stable (empty objects, not `undefined`) when the student has no masteries/weaknesses rows — verified in `profile.test.ts` including an unattempted-topic fixture.

- [x] **KP-2** · P0 · S — Profile builder service + rebuild hook (same file, `buildProfile`)
  **Overview:** Formally, KP-1 and KP-2 collapsed into one function (`buildProfile`) once
  the composition turned out to be a thin `Promise.all` over the DB-3 queries — there was
  no separate caching/service layer worth splitting out. The important behavioral
  guarantee this ticket protects is *freshness*: the profile must never be cached across
  problems, or a misconception written mid-session (Milestone 5) would be invisible to the
  very next prompt build.
  **Acceptance criteria:**
  - `buildProfile(supabase, studentId, courseId)` is called fresh at session bootstrap (`POST /api/sessions`) and again on every turn (`POST /api/sessions/[id]/message`) — never memoized across requests.
  - Makes no Anthropic/Claude calls — pure data composition.
  - Verified this is idempotent and side-effect-free via `profile.test.ts`.

- [x] **DB-4** · P0 · XS — `tutoring_sessions` table (migration `0002_tutoring_sessions.sql`)
  **Overview:** The durable half of the two-store session-persistence design (see the
  Decisions section): small enough state (phase, gap progress, status) to survive a
  server restart or a Redis eviction without losing the student's place, while the bulky
  conversation transcript stays in the ephemeral cache (DB-4 is not the transcript store).
  **Acceptance criteria:**
  - Columns: `id`, `student_id` (FK → `profiles`), `problem_id` (FK → `problems`), `phase` (`check` constrained to `intro|gap_check|solve|review`), `gap_state jsonb`, `status` (`check` constrained to `active|completed|abandoned`), `created_at`, `updated_at`.
  - `idx_sessions_student_status` on `(student_id, status)` for resume lookups.
  - RLS enabled with owner-scoped `select`/`insert`/`update`/`delete` policies (`student_id = auth.uid()`).
  - Maps to/from in-memory `TutoringState` via `toPersisted`/`fromPersisted` in `app/tutor/stateMachine.ts:160`.
  - Migration is additive/reversible (`create table if not exists`, `create index if not exists`).

## Milestone 2 — Tutoring brain
*Exit: Intro → Gap check → Solve → Review runs correctly given an input message (no UI).*

- [x] **TS-1** · P0 · M — System prompt builder (`app/tutor/systemPrompt.ts`)
  **Overview:** Encodes the tutoring pedagogy itself — probe gaps before the problem,
  one mini-lesson + one question per gap, scaffold rather than answer — as a prompt, so
  the state machine (TS-2) only has to decide *when* to move phases while the model
  decides *how* to teach within a phase. Splits static policy from per-turn content so the
  stable prefix can be prompt-cached (cheaper, faster repeated turns).
  **Acceptance criteria:**
  - `buildSystemPrompt(profile, problem, turn?)` returns three `Anthropic.TextBlockParam`s: `[0]` a byte-identical `STATIC_RULES` block marked `cache_control: { type: "ephemeral" }`, `[1]` per-session context (course, student, problem text gated by a "do not reveal" instruction, prerequisite topic list with GAP/OK/UNASSESSED status and known misconceptions), `[2]` the per-turn instruction (only when `turn` is supplied).
  - `STATIC_RULES` contains zero per-student/per-problem content — verified by snapshot test (`systemPrompt.test.ts`); any change to it is a deliberate, reviewed diff since it invalidates the cache prefix for every session.
  - Pure and deterministic — no Claude calls, same inputs always produce the same blocks.
  - Model reference lives in `constants.ts` (`TUTOR_MODEL = "claude-sonnet-4-6"`), not inlined here.

- [x] **TS-2** · P0 · L — Phase state machine (`app/tutor/stateMachine.ts` + `app/tutor/gaps.ts`)
  **Overview:** The deterministic backbone the rest of the tutor brain hangs off of. It
  is pure and serializable on purpose: no Claude call decides a phase transition, only a
  judged `TutoringEvent` does, which is what makes phase state resumable from a Postgres
  row after a server restart and testable without mocking an LLM.
  **Acceptance criteria:**
  - `Phase = "intro" | "gap_check" | "solve" | "review"`; `advance(state, event)` is a pure reducer — never mutates, returns the same reference (`canApply`) when an event doesn't apply to the current phase.
  - Gaps are exactly a problem's tagged prerequisite topics (`problem.tops`, resolved via `gaps.ts::resolvePrerequisites`) classified `GAP` when mastery is non-null and below `GAP_THRESHOLD` (`0.6`); `null` (unassessed) is never a gap — `classifyTopic` (`gaps.ts:15`).
  - `gap_check`: one gap probed at a time (`currentGap` = first unresolved, in `problem.tops` order); one correct `GAP_ATTEMPT` resolves it; phase advances to `solve` once all gaps are resolved, straight to `solve` from `intro` if there were none.
  - `solve` → `review` only on a correct `SOLVE_ATTEMPT`; `review` → `completed` only via an explicit `ADVANCE` (`isComplete`/`status` transitions are one-way — a completed session's state never changes again).
  - `toPersisted`/`fromPersisted` round-trip `{phase, status, gapState: {gaps}}` against the `tutoring_sessions` row shape from DB-4, normalizing a missing/empty `gap_state`.
  - Full transition table covered in `stateMachine.test.ts` (every phase × every applicable/inapplicable event).

- [x] **TS-3** · P0 · L — Conversation handler (`app/tutor/conversation.ts`)
  **Overview:** The glue that turns one HTTP request into judge → state transition →
  side effects → a Sonnet reply, with a hard invariant: **all state and side effects
  resolve before the reply stream is consumed**, so the client's `meta` frame (API-1) is
  never guessing about a phase that might still change mid-stream.
  **Acceptance criteria:**
  - `handleTurn(deps, {profile, problem, state, history, studentMessage})`: in `gap_check`/`solve`, calls `judgeTurn` (Haiku, `judge.ts`) *before* advancing state; `intro`/`review` advance unconditionally (no judging needed) — `conversation.ts:126`.
  - A judge parse failure (`isAttempt: false`) never advances the phase or fires side effects — matches the judge's own documented failure mode.
  - On a wrong `GAP_ATTEMPT`/`SOLVE_ATTEMPT`, calls the injected `inferMisconception` (currently the Milestone-5 no-op stub) — this is the exact call MI-3 will change to fire asynchronously instead of being awaited inline as it is today.
  - On the turn that flips `isComplete(newState)` from `false`→`true`, calls `updateMasteryCounts` once per distinct topic in `problem.tops`, always with `wasCorrect: true` (only a correct final answer reaches `review`→`completed`).
  - All dependencies (`Anthropic`, `SupabaseClient`, `inferMisconception`) are injected via `ConversationDeps` so the handler is unit-testable with fakes — no real network/DB calls in `conversation.test.ts`.
  - Returns the reply as an unconsumed `Anthropic.MessageStream` (`.stream`) — the caller (API-1) is responsible for forwarding it; `handleTurn` itself never awaits it to completion.

- [ ] **TS-4** · P1 · S — Solve judge can't tell a coincidental value match from the real final answer
  **Overview:** Found while designing a fix elsewhere: the `solve`-phase judge
  (`judge.ts:70-78`) marks `correct: true` whenever the student's latest message is
  "mathematically equivalent to the problem's FINAL answer" — a pure value check,
  with no signal for whether the tutor's last message was actually asking for the
  overall final answer versus an intermediate scaffolding quantity. `advance`'s
  `solve` case (`stateMachine.ts:130-133`) then treats *any* correct
  `SOLVE_ATTEMPT` as finishing the problem. If a problem's scaffold ever produces
  an intermediate value that happens to numerically coincide with the final
  answer (e.g. a quantity computed midway through multi-step arithmetic that
  equals the eventual result), the judge has no way to distinguish "the student
  just answered a sub-step that happens to match" from "the student reached the
  real end" — the session would collapse straight to `review`/`completed` before
  the student actually worked through the rest of the scaffold.
  **Acceptance criteria:**
  - A regression test (fixture in `judge.test.ts`, phase `solve`) covers a
    scaffold turn where the tutor's last message asks for an intermediate
    quantity and the student's correct answer to *that* question happens to equal
    `problem.correctAnswer` — the judge must not return `correct: true` on value
    equivalence alone.
  - `judgeSystemPrompt`'s `solve` branch is updated so the judge weighs both (a)
    value equivalence to the final answer, and (b) whether the tutor's most recent
    message was itself asking for the problem's overall final answer (not an
    intermediate step) — `history` already carries the tutor's prior turns, so
    this needs no new plumbing into `JudgeArgs`, only a prompt fix using context
    the judge already receives.
  - Explicitly test the inverse case too (still covered by the existing example in
    the prompt): a genuinely-final correct answer still judges `correct: true` —
    this ticket must not regress normal completion.
  - Document the residual risk if the LLM judge still misjudges "was this the
    final question" occasionally — same class of accepted risk as a flaky judge
    parse failure — but bias any remaining uncertainty toward *not* completing
    early, since a false "not yet done" just costs one extra scaffold turn while a
    false "done" ends the session incorrectly.
  - No `stateMachine.ts` changes expected — if a judge-only fix can't reliably make
    this distinction, escalate rather than special-case `advance`'s `solve` logic
    (mirrors the same "don't special-case the state machine" guidance FE-4 gives
    for its own scope).

- [ ] **TS-5** · P1 · M — Record wrong attempts in mastery counts
  **Overview:** Found while auditing the mastery-update path: `updateMasteryCounts`
  (`app/queries/masteries.ts:69`) is only ever called from one place —
  `conversation.ts:183`, on the turn `isComplete(newState)` flips `false`→`true` —
  and always with `wasCorrect: true`. That's not a missed `if`; it's structurally
  guaranteed, because `advance`'s `solve` case (`stateMachine.ts:130-133`) no-ops on
  an incorrect `SOLVE_ATTEMPT` (stays in `solve`), so `solve`/`gap_check` can only
  ever be *left* via a correct answer. The result: `problems_attempted` and
  `problems_correct` always increment together, so any topic behind a completed
  problem reads as `mastery: 1.0` forever, no matter how many wrong tries it took —
  the exact "struggled but eventually got it" signal mastery is supposed to
  capture never reaches the DB.
  **Design decision (resolved in conversation):** the two judged phases need
  different granularity, because `correct` means different things in each:
  - `gap_check`: each `GAP_ATTEMPT` is graded against whatever question the tutor
    *just asked this turn* (`judge.ts:56-58`) — a nudge/simplified follow-up after
    a wrong answer is still a locally meaningful, single-topic data point, not an
    artifact. **Every judged `GAP_ATTEMPT` counts as an attempt at `currentGap`'s
    topic** — call `updateMasteryCounts(supabase, studentId, currentGap.topicId,
    event.correct)` live, per turn, in `handleTurn`.
  - `solve`: each `SOLVE_ATTEMPT` is graded against the problem's fixed *final*
    answer regardless of what sub-question the tutor actually asked
    (`judge.ts:70-76`), so a correct intermediate scaffolding step is guaranteed
    `correct: false` by design — that's judge noise, not a real gap in
    understanding, and must not be counted as a wrong attempt per turn. Instead of
    deferring to completion (today's approach), write once, live, on the **first**
    judged `SOLVE_ATTEMPT` of the session — whatever its correctness — for every
    topic in `problem.tops`, then suppress any further `problem.tops` writes for
    the rest of the session. This mirrors how `gap_check` already writes live per
    attempt, and (as a side effect) means a session abandoned after one wrong
    solve attempt still leaves a real mastery data point instead of recording
    nothing.
    (A correct-but-premature judge verdict caused by a coincidental value match
    mid-scaffold is a separate, already-tracked risk — see **TS-4** — not
    something this ticket needs to re-solve.)
  **Acceptance criteria:**
  - `TutoringState` gains `solveAttemptRecorded: boolean` (default `false`),
    persisted alongside `gaps` in the `gap_state` jsonb (`{ gaps,
    solveAttemptRecorded }`) — `fromPersisted` normalizes a missing/legacy value
    to `false`, same pattern already used for a missing `gaps` array.
  - `handleTurn` calls `updateMasteryCounts` for `currentGap(state).topicId` on
    *every* judged `GAP_ATTEMPT` (correct or not).
  - `handleTurn` calls `updateMasteryCounts` once per topic in `problem.tops` with
    `wasCorrect: event.correct` the first time a `SOLVE_ATTEMPT` is judged this
    session (`state.solveAttemptRecorded === false`), then flips
    `solveAttemptRecorded` to `true` on the returned state; later `SOLVE_ATTEMPT`s
    in the same session never write to `problem.tops` masteries again.
  - Removes the existing completion-gated loop (`conversation.ts:182-189`) — this
    ticket replaces that write path, it doesn't add a second one alongside it.
  - Gap topics still legitimately get two mastery data points per session (the
    live per-turn gap-check writes, plus the one first-solve-attempt write, since
    gap topics are also listed in `problem.tops`) — document this as intentional,
    not a bug to dedupe later.
  - Both writes are plain Supabase upserts (no Claude call) — stay `await`ed
    inline like today; this ticket does not touch the misconception-pipeline
    latency question (that's MI-3's job).
  - `conversation.test.ts` covers: a wrong `GAP_ATTEMPT` increments
    `problems_attempted` without `problems_correct`; a gap resolved after
    multiple tries produces multiple `updateMasteryCounts` calls; a `solve`
    session whose first attempt is wrong records `wasCorrect: false`
    immediately (not deferred to eventual completion); a second/third
    `SOLVE_ATTEMPT` in the same session never fires another `problem.tops`
    write, regardless of its correctness. `stateMachine.test.ts` covers the new
    field's persistence round-trip and its missing-field default.

## Milestone 3 — Wire it to HTTP
*Exit: full session drivable via curl/Postman.*

- [x] **API-2** · P0 · S — Session bootstrap / profile endpoint (`app/api/sessions/route.ts`)
  **Overview:** Owns the "create or resume" lifecycle for a per-problem session,
  including the concurrency edge case (two tabs bootstrapping the same problem at once)
  and the two-store resume (durable phase from Postgres, transcript from the cache with a
  miss treated as an empty history, never an error).
  **Acceptance criteria:**
  - `POST /api/sessions {problemId}` — auth-guarded (`requireUserApi`), 404 if the problem doesn't exist, 403 if the student isn't enrolled in its course.
  - Resume path: if `getActiveSession` finds a row, rehydrate state via `fromPersisted` and history via `historyCache.get` (`?? []` on miss), return immediately — no new Claude call.
  - Fresh path: generates the Intro greeting (`openSession`) **before** inserting the `tutoring_sessions` row, so a Claude failure leaves no orphan row.
  - Concurrent-create race: a unique-violation (`23505`, from migration 0003's partial unique index) on insert falls back to fetching and resuming whichever row won, rather than erroring.
  - Response is `toSessionResponse(...)`: `{sessionId, phase, status, unlocked, problem, gaps, sidebar, messages}` — `runtime = "nodejs"`, `dynamic = "force-dynamic"`.
  - `historyCache.set` seeds `[seedMessage, greeting]` on a fresh session so later turns keep the required user-first message alternation.

- [x] **API-1** · P0 · M — Tutoring turn endpoint (`app/api/sessions/[id]/message/route.ts`)
  **Overview:** One tutoring turn end-to-end over HTTP, streamed. Everything that could
  change the client's chrome (phase pill, lock state, sidebar) is computed and persisted
  *before* the byte stream opens, so the very first line of the response is a `meta`
  frame the client can render immediately, with tokens trickling in after.
  **Acceptance criteria:**
  - `POST /api/sessions/[id]/message {message}` — auth-guarded to the owning student (`session.studentId !== user.id` → 403), 409 if the session isn't `active`.
  - Response is NDJSON (`Content-Type: application/x-ndjson`, `Cache-Control: no-store`): one `{type:"meta",...}` line, then `{type:"token",text}` lines forwarding Claude's `content_block_delta` text events, then a terminal `{type:"done",status}` or `{type:"error",message}` line.
  - `updateSessionState` (durable row) is written *before* the stream opens; the transcript (`historyCache.append`, or `.delete` on completion) is written only after the full reply text is collected, since it needs the complete assistant turn.
  - A failure after the 200 status is already sent (mid-stream) can only surface as an `{type:"error"}` frame — documented as a client contract in `TutorShell.tsx`'s stream reader, which must check for it.

- [ ] **API-3** · P1 · S — Resume a completed session for review
  **Overview:** Found while manually verifying FE-4: revisiting a problem after its
  session has completed silently starts a brand-new session instead of showing the
  finished one. `getActiveSession` (`app/queries/sessions.ts:33-61`) filters
  `status='active'`, so once a session completes there is no "active" row for
  `POST /api/sessions` to resume — it falls straight into the fresh-session branch,
  regenerating an Intro greeting and resetting phase to `intro` for a problem the
  student already solved. `getSessionStatusesByAssignment`
  (`app/queries/sessions.ts:144-169`) already ranks `completed` above `active`/
  `abandoned` for the assignment page's CTA (implying a "Review" affordance is
  intended), but nothing in API-2 actually serves that completed row back to
  `TutorShell`.
  **Acceptance criteria:**
  - `POST /api/sessions` checks for a `completed` session for the (student, problem)
    pair (in addition to `getActiveSession`'s `active` lookup) and, if found, returns
    it via `toSessionResponse` instead of creating a new row — no new Claude call,
    same as the existing active-resume path.
  - The returned `phase`/`status` reflect the completed session (`review`,
    `completed`) so `TutorShell` renders its existing `completed` branch
    (`TutorShell.tsx:267-270`) immediately, with the problem unlocked per FE-4's
    firewall.
  - Transcript: since `historyCache` deletes the transcript on completion by design
    (Milestone 6 exit criteria), decide and document whether a completed resume
    shows an empty transcript with just the final state, or whether this ticket
    needs to persist a minimal completion summary — don't silently regress FE-2's
    "no message a server never accepted" guarantee while doing so.
  - A student can complete a problem, navigate away, and come back to see it marked
    complete rather than being dropped back into a fresh Intro turn.

## Milestone 4 — UI (first usable demo)
*Exit: a person can complete a problem end-to-end in the browser.*

- [x] **FE-1** · P0 · S — Split layout shell (`app/tutor/[problemId]/TutorShell.tsx`, `page.tsx`)
  **Overview:** The page shell and the session-lifecycle client state machine
  (`LoadState`/`TurnState`) — chat column + sidebar column, responsive (stacks below
  `lg`). Owns bootstrapping against API-2 on mount; everything else (FE-2/FE-3/FE-4)
  renders inside regions this ticket defines.
  **Acceptance criteria:**
  - `TutorPage` (`page.tsx`) auth-guards via `requireUser()`, then renders `<TutorShell problemId>` client-side — enrollment/ownership is re-checked server-side inside API-2, not here.
  - `TutorShell` posts to `/api/sessions` on mount, and renders one of: loading note, error note, or the ready two-column layout (`flex-col` on narrow, `lg:flex-row` at `lg:`).
  - Layout is two independent scroll regions on desktop (chat transcript scrolls, sidebar scrolls) inside a non-scrolling page shell (`lg:h-dvh lg:overflow-hidden` on the outer page).

- [x] **FE-2** · P0 · M — Chat panel + phase pills (`TutorShell.tsx`, `Composer.tsx`, `parseStream.ts`)
  **Overview:** The primary interaction surface — sends student turns to API-1, renders
  the streamed reply token-by-token, and reflects the four-phase pill row so the student
  always knows where they are in Intro → Gap check → Solve → Review.
  **Acceptance criteria:**
  - `Composer` sends on Enter (Shift+Enter inserts a newline), disabled while `disabled` is true (nothing typed, in-flight turn, or completed session).
  - `handleSend` optimistically appends the user bubble immediately, then rolls it back (`fail(...)`) if the request fails or the frame stream errors — the transcript never shows a message the server never accepted.
  - `TurnState` models `idle | sending | streaming | error` explicitly; the streaming assistant bubble renders live from accumulated `token` frames and is replaced by the finalized message on `done`.
  - `parseStream.ts` (`splitLines`/`parseFrame`) buffers partial NDJSON lines across `TextDecoder` chunks — a frame split across two network reads must still parse correctly (covered in `parseStream.test.ts`).
  - `SessionHeader`'s phase pills highlight `session.phase`, sourced from the server's `meta` frame — never inferred client-side.

- [x] **FE-4** · P0 · S — Locked problem reveal
  **Overview:** Most of this ticket's substance already landed as a side effect of
  `responseShape.ts` (the `unlocked`/`questionContent` firewall, API-2/API-1) and
  `TutorShell.tsx`'s rendering of `session.problem`: the question text is `null` until
  `isProblemUnlocked(state)` is true, and the sidebar already shows a "Unlocks after gap
  check" placeholder in its place (`TutorShell.tsx:286-295`). What's left is closing the
  ticket out properly — confirming the edge cases and giving the reveal a moment of
  visual acknowledgment, since right now it's a silent text swap the student could miss.
  **Acceptance criteria:**
  - Verify (write a test if one doesn't exist, e.g. in `responseShape.test.ts`) that `toApiProblem` returns `questionContent: null` for every phase except `solve`/`review`, regardless of what's actually stored on the `Problem` row — the server must never leak it early even under a buggy caller.
  - Verify the resume path: bootstrapping mid-`solve` (or mid-`review`) via API-2 returns the unlocked problem immediately — no extra turn required to "unlock" what a resumed session already earned.
  - Add a lightweight reveal affordance when `unlocked` flips `false → true` within a live session (e.g. a brief highlight/scroll-into-view on the "Current problem" card) so the transition out of Gap check is noticeable, not just a re-render.
  - No new server logic should be needed for this ticket — if you find yourself changing `stateMachine.ts` or `responseShape.ts`'s unlock logic, stop and re-check the gap-resolution rules in TS-2 instead of special-casing here.

- [ ] **FE-3** · P1 · M — Knowledge sidebar
  **Overview:** The data this ticket needs already exists and is already flowing to the
  client on every turn — `toSidebar()` (`responseShape.ts:129`) computes `masteryBars:
  MasteryBar[]` (`{topicId, name, mastery, status, isPrerequisite}`) as part of the
  `sidebar` object in every `meta`/bootstrap response — but `TutorShell.tsx` currently
  only renders `sidebar.tags` (the topic readiness list) and the raw `gapsResolved/
  gapsTotal` counter, not the mastery bars themselves. This ticket is almost entirely a
  rendering task, not a data task.
  **Acceptance criteria:**
  - Add a mastery-bar chart to the sidebar column in `TutorShell.tsx`, driven by `session.sidebar.masteryBars` — do **not** re-fetch from Supabase client-side; the data is already in props (unlike `app/courses/[courseId]/TopicMasteriesChart.tsx`, which fetches its own data and is the wrong pattern to copy verbatim here — copy its Recharts/`ChartContainer` wiring, not its `useEffect` fetch).
  - Reuse the shared chart primitives in `app/components/ui/chart.tsx` (`ChartContainer`, `ChartTooltip`) for visual consistency with the existing mastery chart on the course page.
  - Visually distinguish `isPrerequisite: true` bars (this problem's gap topics) from the rest of the course's topics — e.g. grouped first, or a distinct accent color — so the sidebar reads as "what matters right now" plus "the fuller picture," not one flat list.
  - Render `mastery: null` bars distinctly (e.g. empty/hatched) rather than as a zero-height bar, matching the "unassessed ≠ zero" rule from `gaps.ts`.
  - The sidebar already updates automatically each turn (the whole `sidebar` object comes from the `meta` frame) — don't add a separate poll/refetch; verify the new chart re-renders correctly as `session.sidebar` changes across turns, including the moment a gap flips `gap → resolved`.
  - Session stats (`stats.gapsResolved`/`gapsTotal`, `stats.phase`) already render as plain text — folding them into whatever stats panel this ticket produces is fine, but isn't required to close it out.
  - No unit tests expected here (UI is untested per this repo's Vitest/node-only setup) — manually verify via `npm run dev` against a seeded student with a mix of GAP/OK/UNASSESSED topics.

## Milestone 5 — Misconception pipeline (close the loop)
*Exit: wrong answers feed back into the profile over time. Deferred safely — nothing in the live session blocks on it.*

- [ ] **MI-1** · P1 · M — Haiku misconception inference call
  **Overview:** Replaces the always-`null` stub in `app/queries/claude.ts` with a real
  classification call. This is the first write into the profile that isn't a direct
  mastery increment — it's meant to capture *why* an answer was wrong (a specific,
  short misconception string) so the tutor can address it by name next session, not just
  know the student got it wrong. Model the structured-output pattern directly on
  `app/tutor/judge.ts` (`output_config: {format: {type: "json_schema", schema}}`) — the
  same technique, a different schema and prompt.
  **Acceptance criteria:**
  - `inferMisconception({problem, correctAnswer, studentAnswer, topicId})` (the existing exported type/signature in `claude.ts` — don't change it, `conversation.ts` already depends on it) calls Haiku with `MISCONCEPTION_MODEL` (`constants.ts`, currently `"claude-haiku-4-5-20251001"`) using a JSON-schema structured output, not free-text parsing.
  - Output is a single short string, 5–10 words, hard-capped at 100 chars (matches the `student_topic_weaknesses.description` column from DB-2) — truncate defensively even though `insertWeakness` also truncates, so a caller that skips the insert path still gets a bounded string.
  - Returns `null` — not an empty string — for a careless/arithmetic slip that doesn't reflect a conceptual misconception (e.g. a sign error vs. a genuine misunderstanding of the operation); the prompt must make this distinction explicit since it's the main judgment call the model is making.
  - A malformed/unparseable model response resolves to `null`, mirroring `judge.ts`'s "never let a flaky model corrupt state" failure mode — a bad MI-1 call must never throw and take down `handleTurn`.
  - Unit-tested with a fake/injected Anthropic client (same pattern as `judge.test.ts`) — no live API calls in tests. Update the existing `claude.test.ts` (currently pins the "always null" stub contract) to cover the real classification cases: careless-mistake → `null`, genuine misconception → truncated string, malformed response → `null`.

- [ ] **MI-2** · P1 · M — Semantic dedup
  **Overview:** Without this, every wrong answer on the same misconception creates a new
  `student_topic_weaknesses` row instead of incrementing one — `observed_count` (DB-2)
  would stay meaningless and the profile would fill with near-duplicate strings like "adds
  numerators without a common denominator" / "forgets to find common denominator." The
  decided approach is a Haiku classification call (not embeddings/fuzzy string match) —
  same structured-output pattern as MI-1/`judge.ts`.
  **Acceptance criteria:**
  - New function, e.g. `matchWeakness(existing: TopicWeakness[], candidate: string): Promise<{ id: string } | "novel">` — takes the student+topic's existing weaknesses (from `getWeaknesses`, already scoped by `weaknesses.ts`) and the newly-inferred MI-1 string.
  - Calls Haiku with a structured output classifying the candidate against each existing description for the *same topic* (dedup is scoped per topic, not global) — returns the matching row's `id`, or the literal `"novel"` when none match closely enough.
  - The similarity threshold/criterion is a named constant (alongside `GAP_THRESHOLD` in `constants.ts` or colocated with this function) with a comment on why that bar was chosen — "configurable, documented" per the original decision, not a magic number buried in a prompt string.
  - Unit-tested with an injected fake Anthropic client: exact paraphrase → match, unrelated misconception on the same topic → novel, empty existing-weaknesses list → always novel (no Haiku call needed in that case — skip the call entirely as a cost/latency optimization).

- [ ] **MI-3** · P1 · S — Async write path + un-stub TS-3
  **Overview:** Wires MI-1 + MI-2 into the live turn handler and — this is the part
  that actually changes existing code, not just adds new code — fixes a real gap between
  the current implementation and the recorded decision. Today, `conversation.ts:171`
  `await`s `fireMisconception` **inline, before building the reply stream**, which means
  every wrong answer currently pays the Haiku misconception latency before the student sees
  the tutor's next message. The decision on record says this must never block the reply.
  **Acceptance criteria:**
  - Replace `inferMisconception`'s stubbed injection in `ConversationDeps` with the real MI-1 call, and follow it with MI-2's dedup + the correct `insertWeakness`/`incrementWeakness` write (novel → insert, match → increment, `null` → no write at all).
  - The misconception call + write must not block the reply: restructure so `handleTurn` either (a) returns a detached promise for the caller to hand to Next.js `after()` in the API-1 route, or (b) the route itself fires it via `after()` once it has what it needs from `handleTurn`'s result (topic id, problem, wrong answer, correct answer) — either way, the stream in API-1 must start flowing before this call resolves, not after.
  - Failures in the misconception call or the write are logged and swallowed (matching every other query function's error contract in this repo) — a Haiku hiccup must never surface as a user-facing error or fail the turn.
  - Ordering guarantee: the write must land before the *next* profile rebuild that could read it — since `buildProfile` is called fresh at the top of every turn and every bootstrap (KP-2), and `after()` runs before the response is fully flushed to the client, this should hold naturally, but verify it explicitly (e.g. an integration-style test that runs a turn, awaits the deferred write, then rebuilds the profile and asserts the weakness appears) rather than assuming it.
  - Update `conversation.test.ts` to assert the non-blocking contract (the returned stream must be obtainable without waiting on the misconception promise) in addition to the existing wrong-answer-fires-MI assertion.

## Milestone 6 — Redis-backed history cache
*Exit: conversation history survives serverless cold starts and multi-instance deploys
with zero caller changes. Not a live-flow blocker — the in-memory cache already works
correctly for a single dev/demo instance; this milestone is about production correctness.*

Today `lib/historyCache.ts` only has `InMemoryHistoryCache`, a process-local `Map`. Its own
comment already flags the problem: "a cache miss is expected in multi-instance/serverless
deploys" — but in a real Vercel/serverless deployment that's not an edge case, it's the
common case, since each request can land on a cold or different instance with an empty
Map. The `HistoryCache` interface was deliberately designed so this swap needs zero
changes in `app/api/sessions/route.ts` or `app/api/sessions/[id]/message/route.ts` — both
already depend only on the interface, never the concrete class.

**Provider decision:** Upstash Redis — REST-based (`@upstash/redis`), so it needs no
persistent TCP connection/pool, which fits Next.js route handlers running on serverless
(`runtime = "nodejs"`, `dynamic = "force-dynamic"`) far more cleanly than a TCP client like
`ioredis`. This also matches the "~30 MB free tier" framing already in this file's stack
line above — that number is Upstash's free-tier ceiling.

- [ ] **CACHE-1** · P0 · XS — Provision Upstash Redis + env plumbing
  **Overview:** Stands up the actual instance and credentials the rest of this milestone
  talks to. Deliberately no application code changes — just makes Redis reachable from
  both local dev and the deployed app.
  **Acceptance criteria:**
  - Upstash Redis database created, sized for the ~30 MB free-tier budget this repo already assumes.
  - `@upstash/redis` added to `package.json` dependencies.
  - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` added locally to `.env.local` (gitignored, never committed) — if the repo has no `.env.example`, add one listing the required var *names* (no values) alongside the existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`.
  - Same two vars added to the production deploy target's environment config (e.g. Vercel project settings) — this is a manual dashboard step, call it out as such rather than assuming it's scriptable.
  - A manual `GET`/`SET` round trip against the instance confirms connectivity before CACHE-2 builds on it.

- [ ] **CACHE-2** · P0 · M — `RedisHistoryCache` implementation
  **Overview:** Implements the existing `HistoryCache` interface (`lib/historyCache.ts:12`) against Upstash so it's a drop-in replacement for `InMemoryHistoryCache` — same method signatures, same semantics, just backed by a network store instead of a `Map`.
  **Acceptance criteria:**
  - New `RedisHistoryCache implements HistoryCache`, colocated in `lib/historyCache.ts` (or split into `lib/historyCache.redis.ts` if the file gets unwieldy) alongside the existing in-memory class.
  - Key scheme: `history:{sessionId}`, namespaced so this Redis instance can later hold other cached data without key collisions. Note: `sessionId` already uniquely identifies a (student, problem) pair per the migration-0003 unique-active-session index, so this is already effectively student-scoped despite this file's stack line calling it a "student-keyed cache" — no separate student-id component needed in the key.
  - `get(sessionId)`: fetch + JSON-parse the value; `null` on a miss (Upstash returns `null`/`undefined` for a missing key) — matches the interface's documented miss contract.
  - `set(sessionId, messages)`: write JSON with the TTL (re)armed on every write (`EX`/`PX`), mirroring `InMemoryHistoryCache.set`'s behavior of resetting `expiresAt` on every call, not just on creation.
  - `append(sessionId, ...messages)`: a get-then-set is not atomic under concurrent writes to the same key — document (don't silently assume) that this is acceptable because API-1 only ever has one in-flight turn per session (auth + `status === "active"` checks serialize turns per session in practice), the same kind of documented assumption API-2 already makes about its one known concurrency race (handled there via a DB unique index, not locking). If a real concurrent-append race is ever found, revisit with a Redis list type (`RPUSH`/`LRANGE`) instead of a JSON blob.
  - `delete(sessionId)`: removes the key outright — don't rely on TTL alone for the explicit-delete-on-completion path.
  - Default TTL matches the in-memory default (`30 * 60 * 1000` ms), passed as a constructor param so tests can use a short TTL like the existing `historyCache.test.ts` does for `InMemoryHistoryCache`.
  - Redis client errors (network blip, rate limit) are caught, logged, and treated as a miss on read / silently dropped on write — same log-and-swallow contract as every query function in `app/queries/`. A transient Redis outage must degrade a session to "fresh chat against the rebuilt profile" (the existing documented miss behavior), never a 500.

- [ ] **CACHE-3** · P0 · S — Swap the production singleton, keep tests offline
  **Overview:** Flips the exported `historyCache` singleton over to Redis in real environments while keeping `InMemoryHistoryCache` available for Vitest (no jsdom, no network in CI) and for local dev when Upstash credentials aren't configured.
  **Acceptance criteria:**
  - `lib/historyCache.ts`'s exported `historyCache` singleton uses `RedisHistoryCache` when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set, and falls back to `InMemoryHistoryCache` otherwise — log a one-time warning on fallback so it's obvious in dev logs that history won't survive a restart.
  - Zero changes to `app/api/sessions/route.ts` or `app/api/sessions/[id]/message/route.ts` — if closing this ticket requires editing either route, the interface boundary has broken; fix that instead of the routes.
  - `npm test` still passes with no live Upstash credentials present — existing tests keep exercising `InMemoryHistoryCache` directly by name; any Redis-hitting tests (CACHE-4) are skip-gated on env presence, not run by default.

- [ ] **CACHE-4** · P1 · S — Test coverage for the Redis implementation
  **Overview:** Mirrors the existing `historyCache.test.ts` contract suite against `RedisHistoryCache` so both implementations are verified against the same behavior (miss → `null`, round-trip, append semantics, delete, TTL expiry) and can't silently drift apart.
  **Acceptance criteria:**
  - A hand-rolled fake Upstash client (covering only the methods `RedisHistoryCache` actually calls) lets the same contract tests from `historyCache.test.ts` run against `RedisHistoryCache` with no network call, in CI.
  - TTL-expiry coverage either drives the fake client's clock directly, or is written as a live-only test explicitly gated with `describe.skipIf(!process.env.UPSTASH_REDIS_REST_URL)` so it never runs without real (disposable/test) credentials.
  - Optional: one live smoke test behind the same `skipIf` gate that round-trips against the real Upstash instance — a manual "does this actually work" check, not a CI requirement.

- [ ] **CACHE-5** · P2 · XS — Operational cleanup
  **Overview:** Small follow-ups once Redis is live in production: keep the docs honest about which implementation is used when, and sanity-check the memory-budget assumption this file has been carrying since before Redis existed.
  **Acceptance criteria:**
  - Update the comment block atop `lib/historyCache.ts` (currently phrases the Redis swap as a future event) to describe both implementations as they now exist and when each is selected, rather than describing a completed migration as still-upcoming.
  - Sanity-check the "~75 KB per session" estimate in this file's stack line against a real multi-turn transcript's JSON size, and correct the concurrent-session budget note if it's meaningfully off.
  - Confirm `historyCache.delete` on session completion (already called from `app/api/sessions/[id]/message/route.ts`) frees the Upstash key immediately rather than relying on the TTL to eventually reclaim it — true by construction for the in-memory `Map.delete`; verify it's still true for the Redis `DEL` call.

---

## Why this order

- **Strict dependency chain:** DB → KP → TS → API → FE; a layer can't be meaningfully tested without the one below it.
- **MI deferred on purpose:** it's the only write-only, async subsystem — nothing in the live flow waits on it, so it ships last and incrementally.
- **Earliest demo:** M1→M4 is the fastest path to clicking through a real session; the P1 sidebar (FE-3) is last so its absence doesn't block the demo.

> Note: FE-3 is labeled P1 but the knowledge sidebar is the platform's signature UI — bump to P0 if this goes in front of stakeholders.

## What's actually left for the MVP

Milestones 1–2 are fully shipped (data layer, tutor brain). Milestone 3 (HTTP) is shipped
apart from **API-3** (resume-a-completed-session gap found while verifying FE-4 — not a
live-flow blocker, since a fresh problem still plays through fine, just doesn't resume
correctly once already completed). Of Milestone 4, **FE-1/FE-2/FE-4 are shipped** and
**FE-3 needs a rendering pass over data that's already being sent to the client**. Milestone 5
(MI-1/MI-2/MI-3) is unstarted but explicitly deferrable — the live tutoring flow already
calls a stubbed no-op in its place, so shipping without it does not block a usable demo.
Milestone 6 (Redis) is also deferrable for a demo — the in-memory cache works fine for a
single running instance — but matters before any real multi-instance/serverless
deployment, since a cache miss today is silent and just means a resumed session loses its
transcript (not a crash, but a degraded experience worth fixing before calling this done).
