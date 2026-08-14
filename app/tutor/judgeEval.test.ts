import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { judgeTurn } from "./judge";

// Live-model eval for the solve-phase judge. Unlike judge.test.ts (which mocks
// the client and can only assert prompt content / the deterministic
// isFinalAttempt gate), this calls the real model, so it's the only thing that
// can verify the part still left to the model: isAttempt classification and
// math-equivalence judgment.
//
// Earlier revisions of this fix tried to have the model itself infer whether
// the tutor's last question was asking for the overall final answer versus an
// intermediate step. A run of this eval against that version showed the
// disqualifier was unreliable (correct: true 1-2 times out of 5 on a value that
// coincidentally matched the final answer, even when the tutor named the
// sub-quantity explicitly) and the "default" case was wrong 5/5 on open-ended
// tutor phrasing. That inference was replaced with `isFinalAttempt`, an
// explicit signal the student sets rather than one the model guesses — see
// judge.ts. Fixture 4 below re-confirms end-to-end that a coincidental match
// no longer completes the problem now that the gate is deterministic.
//
// It is SKIPPED unless JUDGE_EVAL=1, so `npm test` never makes network calls or
// spends tokens:
//
//   JUDGE_EVAL=1 npx vitest run app/tutor/judgeEval.test.ts
//
// Each fixture is sampled RUNS times because the judge call does not pin
// temperature — a split result is itself a finding, not noise to average away.

const ENABLED = process.env.JUDGE_EVAL === "1";
const RUNS = Number(process.env.JUDGE_EVAL_RUNS ?? 5);

/** Loads ANTHROPIC_API_KEY from .env.local, which vitest does not read itself. */
function loadApiKey(): void {
  if (process.env.ANTHROPIC_API_KEY) return;
  try {
    for (const raw of readFileSync(".env.local", "utf8").split("\n")) {
      const match = /^\s*ANTHROPIC_API_KEY\s*=\s*(.*)\s*$/.exec(raw);
      if (match) process.env.ANTHROPIC_API_KEY = match[1].replace(/^["']|["']$/g, "");
    }
  } catch {
    // No .env.local — the key may still come from the ambient environment.
  }
}

type Fixture = {
  name: string;
  tutorAsked: string;
  studentMessage: string;
  correctAnswer: string;
  isFinalAttempt?: boolean;
  expectedCorrect: boolean;
  expectedIsAttempt: boolean;
};

const FIXTURES: Fixture[] = [
  {
    name: "final attempt, matching value",
    tutorAsked: "So what's (8 * 6) * 1?",
    studentMessage: "48",
    correctAnswer: "48",
    isFinalAttempt: true,
    expectedCorrect: true,
    expectedIsAttempt: true,
  },
  {
    name: "final attempt, wrong value",
    tutorAsked: "So what's (8 * 6) * 1?",
    studentMessage: "50",
    correctAnswer: "48",
    isFinalAttempt: true,
    expectedCorrect: false,
    expectedIsAttempt: true,
  },
  {
    name: "final attempt, equivalent but differently formatted value",
    tutorAsked: "What's 3/4 + 1/8?",
    studentMessage: "seven eighths",
    correctAnswer: "7/8",
    isFinalAttempt: true,
    expectedCorrect: true,
    expectedIsAttempt: true,
  },
  {
    // Reproduces the reported bug end-to-end: a sub-step's value coincidentally
    // equals the final answer, and isFinalAttempt is NOT set — must not
    // complete the problem regardless of what the model reports for `correct`.
    name: "sub-step reply whose value coincidentally equals the final answer",
    tutorAsked: "Let's start with the part in parentheses. What's 8 * 6?",
    studentMessage: "48",
    correctAnswer: "48",
    isFinalAttempt: false,
    expectedCorrect: false,
    expectedIsAttempt: true,
  },
  {
    name: "clarifying question is not an attempt",
    tutorAsked: "So what's (8 * 6) * 1?",
    studentMessage: "wait, can you remind me what that first number means?",
    correctAnswer: "48",
    isFinalAttempt: true,
    expectedCorrect: false,
    expectedIsAttempt: false,
  },
];

describe.skipIf(!ENABLED)("judgeTurn — live model eval", () => {
  loadApiKey();
  const anthropic = new Anthropic();

  for (const fixture of FIXTURES) {
    it(
      `${fixture.name} → correct: ${fixture.expectedCorrect}, isAttempt: ${fixture.expectedIsAttempt}`,
      { timeout: 120_000 },
      async () => {
        const results = [];
        for (let i = 0; i < RUNS; i++) {
          results.push(
            await judgeTurn({
              anthropic,
              phase: "solve",
              history: [
                { role: "user", content: "Maya's problem is (8 * 6) * 1." },
                { role: "assistant", content: fixture.tutorAsked },
              ],
              studentMessage: fixture.studentMessage,
              correctAnswer: fixture.correctAnswer,
              isFinalAttempt: fixture.isFinalAttempt,
            }),
          );
        }

        const correctCount = results.filter((r) => r.correct).length;
        const attemptCount = results.filter((r) => r.isAttempt).length;
        console.log(
          `[${fixture.name}] correct: ${correctCount}/${RUNS} true` +
            ` (expected ${fixture.expectedCorrect})` +
            ` | isAttempt: ${attemptCount}/${RUNS} true` +
            ` (expected ${fixture.expectedIsAttempt})`,
        );

        expect(results.every((r) => r.correct === fixture.expectedCorrect)).toBe(true);
        expect(results.every((r) => r.isAttempt === fixture.expectedIsAttempt)).toBe(true);
      },
    );
  }
});
