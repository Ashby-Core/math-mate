import { SupabaseClient } from "@supabase/supabase-js";
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
export type SessionRow = { id: string } & PersistedTutoringState;

/** A session row plus its ownership keys (for the turn endpoint's auth + problem load). */
export type OwnedSessionRow = SessionRow & {
  studentId: string;
  problemId: string;
};

/** createSession outcome: the new id, or a conflict to resume, or null on error. */
export type CreateSessionResult = { id: string } | { conflict: true };

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
    .select("id, phase, status, gap_state")
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
  if (!row) return null;

  return {
    id: row.id,
    phase: row.phase as Phase,
    status: row.status as SessionStatus,
    gapState: (row.gap_state ?? { gaps: [] }) as { gaps: GapEntry[] },
  };
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
    .select("id, student_id, problem_id, phase, status, gap_state")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching session by id:", error.message);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id,
    studentId: data.student_id,
    problemId: data.problem_id,
    phase: data.phase as Phase,
    status: data.status as SessionStatus,
    gapState: (data.gap_state ?? { gaps: [] }) as { gaps: GapEntry[] },
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    console.error("Error updating session state:", error.message);
    return false;
  }

  return true;
}

