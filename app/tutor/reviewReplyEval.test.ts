import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { describe, it } from "vitest";
import { buildSystemPrompt } from "./systemPrompt";
import { TUTOR_MODEL } from "./constants";
import type { Problem, StudentProfile } from "@/app/types";

// Diagnostic for a report from manual testing: after jumping ahead with
// isFinalAttempt (flagging a sub-step's value as the final answer), the STATE
// correctly completed the session, but the Sonnet REPLY text kept scaffolding
// ("what's 48 x 1?") instead of recapping. This calls the real tutor model with
// the exact system prompt + history handleTurn would build, to see the raw
// reply and check whether it's a real prompt-following gap.
//
//   REVIEW_EVAL=1 npx vitest run app/tutor/reviewReplyEval.test.ts

const ENABLED = process.env.REVIEW_EVAL === "1";

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

const profile: StudentProfile = {
  courseName: "Order of Operations",
  student: { id: "u1", firstName: "Aaron" },
  topicMasteryScores: {},
  weaknesses: {},
};

const problem: Problem = {
  id: "p1" as Problem["id"],
  questionContent: "What is (8 * 6) * 1?",
  correctAnswer: "48",
  orderIndex: 0,
  tops: [],
};

describe.skipIf(!ENABLED)("Sonnet review-phase reply", () => {
  loadApiKey();
  const anthropic = new Anthropic();

  it("recaps rather than continuing the scaffold, after a jump-ahead completion", async () => {
    const system = buildSystemPrompt(profile, problem, {
      phase: "review",
      currentGap: null,
      resolvedCount: 0,
      totalGaps: 0,
    });

    // Exactly the transcript from the manual repro: the tutor's last real
    // question was the sub-step "8 * 6", the student answered "48" with
    // isFinalAttempt flagged — which the judge (correctly, per the toggle's
    // semantics) graded as the final answer, since (8*6)*1 = 48 too.
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: "Hi! I'm ready to start." },
      { role: "assistant", content: "Hi Aaron! Let's work through today's problem together." },
      { role: "user", content: "ok" },
      { role: "assistant", content: "Great — let's start with the part in parentheses. What's 8 * 6?" },
      { role: "user", content: "48" },
    ];

    for (let i = 0; i < 5; i++) {
      const response = await anthropic.messages.create({
        model: TUTOR_MODEL,
        max_tokens: 512,
        system,
        messages,
      });

      const text = response.content.find((b) => b.type === "text")?.text;
      console.log(`--- Sonnet review-phase reply (run ${i + 1}) ---\n${text}\n---`);
    }
  }, 60_000);
});
