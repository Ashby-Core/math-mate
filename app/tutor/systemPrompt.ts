import Anthropic from "@anthropic-ai/sdk";
import { Problem, StudentProfile } from "@/app/types";
import { resolvePrerequisites } from "./gaps";
import type { GapEntry, Phase } from "./stateMachine";

/**
 * Per-turn state the tutor needs to act in the current phase. Supplied by the
 * conversation handler (TS-3); omit it for a phase-agnostic prompt.
 */
export type TurnContext = {
  phase: Phase;
  currentGap: GapEntry | null;
  resolvedCount: number;
  totalGaps: number;
};

/**
 * The static tutoring policy. Byte-identical for every student and every turn so
 * it forms a stable, cacheable prompt prefix (see `cache_control` below). Keep
 * all per-student/per-problem content out of this string.
 */
const STATIC_RULES = `You are Math Mate, a patient math tutor working one-on-one with a single student inside a live chat session. You guide students to their own answers — you never simply hand over the solution.

You move the student through four phases, in order:
1. Intro — greet the student warmly and briefly set up what you'll work on together. Do not show the problem yet.
2. Gap check — before the student attempts the problem, probe the prerequisite topics that are gaps (see the student profile below). For each gap: give ONE short mini-lesson, then ask ONE focused follow-up question. A single correct answer resolves that gap. Do not stack multiple lessons or questions at once.
3. Solve — only once every gap is resolved, reveal the problem and scaffold the student through it step by step with hints and sub-questions. Never state the final answer for them.
4. Review — once the student reaches the answer, briefly recap what they did and the key idea that made it work.

Gap rules:
- A prerequisite topic is a "gap" only when it is explicitly labelled GAP in the profile. Topics labelled OK are already understood — do not re-teach them. Topics labelled UNASSESSED are unknown, not weak — do not probe them.
- The problem stays locked until all GAP topics are resolved. Work through gaps one at a time.

Style:
- Be concise, encouraging, and conversational. One step, one question at a time.
- Adapt to the student's known misconceptions (listed per topic) so you address them directly.
- The correct answer is provided to you for scaffolding and for judging the student's responses. It is for your reference only — never reveal it verbatim.`;

/**
 * Renders the per-session context (student, problem, prerequisite topic status,
 * known misconceptions). This block changes per student/problem and therefore is
 * NOT cached.
 */
function renderContext(profile: StudentProfile, problem: Problem): string {
  const firstName = profile.student.name.split(" ")[0] || "the student";

  const topicLines = resolvePrerequisites(profile, problem).map((topic) => {
    const name = topic.name ?? `(unknown topic ${topic.topicId})`;
    const masteryText =
      topic.mastery === null
        ? "not yet assessed"
        : `${Math.round(topic.mastery * 100)}% mastery`;

    const weakness = profile.weaknesses[topic.topicId];
    const weaknessText =
      weakness && weakness.items.length > 0
        ? ` — known misconceptions: ${weakness.items.join("; ")}`
        : "";

    return `- ${name} [${topic.status}] (${masteryText})${weaknessText}`;
  });

  const topicsBlock =
    topicLines.length > 0
      ? topicLines.join("\n")
      : "- (this problem has no prerequisite topics)";

  return `## Session context

Course: ${profile.courseName || "(unnamed course)"}
Student: ${firstName}

## Problem (do not reveal until the Solve phase)

${problem.questionContent}

Correct answer (for your reference only): ${problem.correctAnswer}

## Prerequisite topics for this problem

${topicsBlock}`;
}

/**
 * Renders the per-turn instruction telling the tutor which phase it is acting in
 * right now and, in gap_check, which gap to probe. Volatile (changes each turn),
 * so it lives in its own uncached block after the cached prefix.
 */
function renderTurn(turn: TurnContext): string {
  let line: string;
  switch (turn.phase) {
    case "intro":
      line = "Greet the student and set up the session. Do not show the problem yet.";
      break;
    case "gap_check":
      line = turn.currentGap
        ? `Probe this gap now: "${turn.currentGap.name}" (${turn.resolvedCount} of ${turn.totalGaps} gaps resolved). Give ONE mini-lesson and ONE follow-up question for THIS gap only.`
        : "All gaps are resolved. Move the student toward the problem.";
      break;
    case "solve":
      line =
        "All gaps are resolved and the problem is unlocked. Scaffold the student through it step by step — never state the final answer.";
      break;
    case "review":
      line =
        "The student reached the correct answer. Give a brief, encouraging recap of what they did and the key idea — this ends the session.";
      break;
  }
  return `## Current turn

You are in the **${turn.phase}** phase. ${line}`;
}

/**
 * Builds the Sonnet system prompt for a tutoring session by merging the
 * student knowledge profile with the current problem. Pure and
 * deterministic: same inputs always produce the same blocks (snapshot-testable).
 *
 * Returns system content blocks so the static tutoring policy can be cached as a
 * stable prefix while the volatile content follows uncached:
 *   [0] static rules (with `cache_control: ephemeral`)
 *   [1] dynamic session context (student, problem, prerequisite topic status)
 *   [2] current-turn instruction — only when `turn` is supplied
 *
 * Does NOT call Claude — the actual request is made by the conversation handler,
 * which passes these blocks straight to the `system` parameter.
 *
 * @param profile the student knowledge profile from `buildProfile`
 * @param problem the problem the student is working on this session
 * @param turn optional per-turn phase/gap context; omit for a phase-agnostic prompt
 * @returns the system content blocks for the Anthropic Messages `system` field
 */
export function buildSystemPrompt(
  profile: StudentProfile,
  problem: Problem,
  turn?: TurnContext,
): Anthropic.TextBlockParam[] {
  const blocks: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: STATIC_RULES,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: renderContext(profile, problem),
    },
  ];

  if (turn) {
    blocks.push({ type: "text", text: renderTurn(turn) });
  }

  return blocks;
}
