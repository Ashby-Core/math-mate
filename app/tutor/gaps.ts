import { Problem, StudentProfile } from "@/app/types";
import { GAP_THRESHOLD } from "./constants";

// Single source of truth for "what is a gap". Both the system prompt builder
// (TS-1) and the phase state machine (TS-2) classify prerequisite topics here so
// they can never disagree about which topics need probing.

export type TopicStatus = "GAP" | "OK" | "UNASSESSED";

/**
 * Classifies a prerequisite topic from its derived mastery (0–1 float or
 * `null`): below the threshold is a gap to probe; `null` is unassessed and is
 * deliberately NOT a gap; otherwise the topic is OK.
 */
export function classifyTopic(mastery: number | null): TopicStatus {
  if (mastery === null) return "UNASSESSED";
  return mastery < GAP_THRESHOLD ? "GAP" : "OK";
}

/**
 * A problem's prerequisite topic paired with the student's mastery and gap
 * classification — the in-memory join of the problem's `tops` ids against the
 * already-built profile (no DB access; the topics/masteries join happened in
 * `buildProfile`). `name`/`mastery` are `null` when the id is absent from the
 * profile, which classifies as UNASSESSED (never a gap).
 */
export type PrerequisiteTopic = {
  topicId: string;
  name: string | null;
  mastery: number | null;
  status: TopicStatus;
};

/**
 * Resolves a problem's prerequisite topic ids (`problem.tops`) into classified
 * entries, in probe order. Deduplicates ids (keeping first occurrence) so a
 * malformed problem can't list or gate the same topic twice.
 * 
 * TODO: For the MVP, I decided to stick with just using the problem's
 * associated topics as the prereqs, but in the future, it might be useful to let
 * teachers specify a prereq graph (optional for extra customizability)
 *
 * @param profile the student knowledge profile from `buildProfile`
 * @param problem the problem whose prerequisites to resolve
 * @returns one classified entry per distinct prerequisite topic, in `tops` order
 */
export function resolvePrerequisites(
  profile: StudentProfile,
  problem: Problem,
): PrerequisiteTopic[] {
  const seen = new Set<string>();
  const result: PrerequisiteTopic[] = [];

  for (const topicId of problem.tops) {
    if (seen.has(topicId)) continue;
    seen.add(topicId);

    const topic = profile.topicMasteryScores[topicId];
    const mastery = topic?.mastery ?? null;
    result.push({
      topicId,
      name: topic?.name ?? null,
      mastery,
      status: classifyTopic(mastery),
    });
  }

  return result;
}
