// Shared constants for the tutoring brain (Milestone 2). Centralized so the
// system prompt builder (TS-1), phase state machine (TS-2), and conversation
// handler (TS-3) all agree on models and the gap threshold.

/** Sonnet model that drives the tutoring conversation. */
export const TUTOR_MODEL = "claude-sonnet-4-6";

/** Haiku model used for lightweight misconception inference (Milestone 5). */
export const MISCONCEPTION_MODEL = "claude-haiku-4-5-20251001";

/**
 * Haiku model that runs the per-turn correctness judge in the conversation
 * handler (TS-3) — a cheap structured classifier, separate from the Sonnet
 * tutor reply.
 */
export const JUDGE_MODEL = "claude-haiku-4-5";

/**
 * Mastery below this value (and not `null`) marks a prerequisite topic as a
 * "gap" the tutor must probe before unlocking the problem. `null` mastery means
 * the topic is unassessed and is deliberately NOT treated as a gap.
 */
export const GAP_THRESHOLD = 0.6;
