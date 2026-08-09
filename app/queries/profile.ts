import { SupabaseClient } from "@supabase/supabase-js";
import { StudentProfile } from "../types";
import { getCourseById } from "./courses";
import { getProfileById } from "./profiles";
import { getMasteries } from "./masteries";
import { getWeaknesses } from "./weaknesses";

/**
 * Builds the student knowledge profile for a course by composing the mastery
 * and weakness query functions — it only shapes their output, it does not
 * re-implement any SQL or the mastery derivation. Rebuilt fresh per problem (no
 * caching) so mid-session misconception inferences are reflected the next time
 * it runs. No Claude calls.
 *
 * Topics are keyed by topic id; each value carries the human-readable topic
 * name so the profile is meaningful to the tutoring model. Every course topic
 * appears in `topicMasteryScores` (mastery is `null` when the student hasn't
 * attempted it). `weaknesses` only includes topics that have recorded
 * weaknesses, grouped into a list of descriptions. The shape is stable even
 * when the student has no data (empty maps, blank course/student fields).
 *
 * @param supabase the Supabase client
 * @param studentId the student whose profile to build
 * @param courseId the course to scope the profile to
 * @returns the StudentProfile to inject into the tutoring system prompt
 */
export async function buildProfile(
  supabase: SupabaseClient,
  studentId: string,
  courseId: string,
): Promise<StudentProfile> {
  const [course, profile, masteries, weaknesses] = await Promise.all([
    getCourseById(supabase, courseId),
    getProfileById(supabase, studentId),
    getMasteries(supabase, studentId, courseId),
    getWeaknesses(supabase, studentId, courseId),
  ]);

  const topicMasteryScores: StudentProfile["topicMasteryScores"] = {};
  for (const m of masteries) {
    topicMasteryScores[m.topicId] = { name: m.name, mastery: m.mastery };
  }

  const weaknessMap: StudentProfile["weaknesses"] = {};
  for (const w of weaknesses) {
    const entry = weaknessMap[w.topicId] ?? { name: w.name, items: [] };
    entry.items.push(w.description);
    weaknessMap[w.topicId] = entry;
  }

  return {
    courseName: course?.name ?? "",
    student: {
      id: studentId,
      firstName: profile?.firstName ?? "",
    },
    topicMasteryScores,
    weaknesses: weaknessMap,
  };
}
