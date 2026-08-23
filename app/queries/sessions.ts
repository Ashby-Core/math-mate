import { SupabaseClient } from "@supabase/supabase-js";
import { ProblemStatus } from "@/app/types";
import {
  GapEntry,
  Phase,
  PersistedTutoringState,
  SessionStatus,
  TutoringState,
  toPersisted,
} from "@/app/tutor/stateMachine";

// Durable `tutoring_sessions` row access. Holds only the resumable state (phase
// + gaps + status); the conversation transcript lives in the history cache. The
// in-memory `TutoringState` maps to/from the row via toPersisted/fromPersisted.

/** A session row reduced to its persisted state plus the row id. */
export type SessionRow = { id: string } & PersistedTutoringState & {
    /** The final tutor reply from the turn that completed the session, or
     * null for an active session (or a completed one from before this
     * column existed). */
    completionSummary: string | null;
  };

/** A session row plus its ownership keys (for the turn endpoint's auth + problem load). */
export type OwnedSessionRow = SessionRow & {
  studentId: string;
  problemId: string;
};

/** createSession outcome: the new id, or a conflict to resume, or null on error. */
export type CreateSessionResult = { id: string } | { conflict: true };

const SESSION_ROW_COLUMNS =
  "id, phase, status, gap_state, solve_attempt_recorded, completion_summary";

/** Shapes one raw `tutoring_sessions` row (selected via `SESSION_ROW_COLUMNS`) into a `SessionRow`. */
function toSessionRow(row: {
  id: string;
  phase: string;
  status: string;
  gap_state: unknown;
  solve_attempt_recorded: boolean | null;
  completion_summary: string | null;
}): SessionRow {
  return {
    id: row.id,
    phase: row.phase as Phase,
    status: row.status as SessionStatus,
    gapState: (row.gap_state ?? { gaps: [] }) as { gaps: GapEntry[] },
    solveAttemptRecorded: row.solve_attempt_recorded ?? false,
    completionSummary: row.completion_summary ?? null,
  };
}

/**
 * The single active session for a (student, problem), or null. Filters
 * `status='active'` and takes the most recent row defensively (the partial
 * unique index from migration 0003 should keep this to at most one).
 */
export async function getActiveSession(
  supabase: SupabaseClient,
  studentId: string,
  problemId: string,
): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from("tutoring_sessions")
    .select(SESSION_ROW_COLUMNS)
    .eq("student_id", studentId)
    .eq("problem_id", problemId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error fetching active session:", error.message);
    return null;
  }

  const row = data?.[0];
  return row ? toSessionRow(row) : null;
}

/**
 * The session to resume for a (student, problem) pair, or null if there is
 * none: a completed session (to review) if one exists, otherwise the active
 * one. A single query rather than two sequential lookups — completed
 * outranks active the same way `STATUS_RANK` (below) does, since once a
 * problem is solved the bootstrap endpoint always serves that session back
 * for review rather than an older active row for the same problem.
 */
export async function getResumableSession(
  supabase: SupabaseClient,
  studentId: string,
  problemId: string,
): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from("tutoring_sessions")
    .select(SESSION_ROW_COLUMNS)
    .eq("student_id", studentId)
    .eq("problem_id", problemId)
    .in("status", ["active", "completed"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching resumable session:", error.message);
    return null;
  }
  if (!data || data.length === 0) return null;

  const row =
    data.find((r) => r.status === "completed") ??
    data.find((r) => r.status === "active");
  return row ? toSessionRow(row) : null;
}

/**
 * A single session by its id, including the student/problem it belongs to, or
 * null if not found. The turn endpoint uses `studentId` to authorize the
 * caller and `problemId` to load the problem. Note: returns the row regardless of
 * `status` (a completed session must still resolve for the auth check); callers
 * gate on `status` themselves.
 */
export async function getSessionById(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<OwnedSessionRow | null> {
  const { data, error } = await supabase
    .from("tutoring_sessions")
    .select(`student_id, problem_id, ${SESSION_ROW_COLUMNS}`)
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching session by id:", error.message);
    return null;
  }
  if (!data) return null;

  return {
    ...toSessionRow(data),
    studentId: data.student_id,
    problemId: data.problem_id,
  };
}

/**
 * Inserts a new active session row for a (student, problem). Returns the new id,
 * `{ conflict: true }` when the active-session unique index rejects a concurrent
 * create (caller should resume the existing row), or `null` on any other error.
 */
export async function createSession(
  supabase: SupabaseClient,
  input: { studentId: string; problemId: string; state: TutoringState },
): Promise<CreateSessionResult | null> {
  const persisted = toPersisted(input.state);
  const { data, error } = await supabase
    .from("tutoring_sessions")
    .insert({
      student_id: input.studentId,
      problem_id: input.problemId,
      phase: persisted.phase,
      status: persisted.status,
      gap_state: persisted.gapState,
      solve_attempt_recorded: persisted.solveAttemptRecorded,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { conflict: true }; // unique violation
    console.error("Error creating session:", error.message);
    return null;
  }

  return { id: data.id };
}

// Status precedence when a problem has more than one session row: a completed
// session outranks an active one, which outranks an abandoned one.
const STATUS_RANK: Record<ProblemStatus, number> = {
  completed: 3,
  active: 2,
  abandoned: 1,
};

/**
 * Maps each of an assignment's problems that the student has a session for to
 * its status (problemId → status). Problems with no session are simply absent
 * from the map ("not started"). Used by the assignment page to label each
 * problem's CTA (Start / Continue / Review).
 *
 * Sessions link to a problem, not an assignment, so this filters via an inner
 * join to `problems` on `assignment_id`.
 */
export async function getSessionStatusesByAssignment(
  supabase: SupabaseClient,
  studentId: string,
  assignmentId: string,
): Promise<Record<string, ProblemStatus>> {
  const { data, error } = await supabase
    .from("tutoring_sessions")
    .select("problem_id, status, problems!inner(assignment_id)")
    .eq("student_id", studentId)
    .eq("problems.assignment_id", assignmentId);

  if (error || !data) {
    console.error("Error fetching session statuses:", error?.message);
    return {};
  }

  const statuses: Record<string, ProblemStatus> = {};
  for (const row of data) {
    const status = row.status as ProblemStatus;
    const current = statuses[row.problem_id];
    if (!current || STATUS_RANK[status] > STATUS_RANK[current]) {
      statuses[row.problem_id] = status;
    }
  }
  return statuses;
}

/**
 * Persists the latest state for a session (phase, status, gaps). Used by the
 * turn endpoint (API-1) after each transition. Returns whether the write
 * succeeded.
 */
export async function updateSessionState(
  supabase: SupabaseClient,
  sessionId: string,
  state: TutoringState,
): Promise<boolean> {
  const persisted = toPersisted(state);
  const { error } = await supabase
    .from("tutoring_sessions")
    .update({
      phase: persisted.phase,
      status: persisted.status,
      gap_state: persisted.gapState,
      solve_attempt_recorded: persisted.solveAttemptRecorded,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    console.error("Error updating session state:", error.message);
    return false;
  }

  return true;
}

/**
 * Records the minimal completion summary (the final tutor reply from the
 * turn that completed the session) once the transcript itself is dropped
 * from the history cache. Used by the turn endpoint only on the turn that
 * completes a session, so a later review-resume has something to show
 * besides an empty transcript.
 */
export async function setCompletionSummary(
  supabase: SupabaseClient,
  sessionId: string,
  summary: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("tutoring_sessions")
    .update({ completion_summary: summary })
    .eq("id", sessionId);

  if (error) {
    console.error("Error setting completion summary:", error.message);
    return false;
  }

  return true;
}

