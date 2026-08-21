import { readFileSync } from "node:fs";
import type { UUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { buildSystemPrompt, TurnContext } from "./systemPrompt";
import { TUTOR_MODEL } from "./constants";
import { judgeTurn } from "./judge";
import { SESSION_SEED_MESSAGE } from "./conversation";
import { advance, currentGap, initTutoringState, TutoringState } from "./stateMachine";
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

const functionsProfile: StudentProfile = {
  courseName: "Functions",
  student: { id: "u1", firstName: "John" },
  topicMasteryScores: {},
  weaknesses: {},
};

const functionsProblem: Problem = {
  id: "p2" as Problem["id"],
  questionContent: "f(x) = 3x + 2. If x = 2, what is the value of f(x)?",
  correctAnswer: "8",
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

  it("nudges toward the final-answer toggle instead of writing a recap, when a value matches but isn't flagged final", async () => {
    // The second manual repro: f(x) = 3x + 2, x = 2. The student gave the
    // correct value ("Is it 8?") without flagging the final-answer toggle, so
    // the state correctly stayed in "solve" — but with the OLD prompt the
    // tutor's reply read like a completed recap anyway ("Quick recap of what
    // you did... Nice work, John!"), even though the phase never advanced.
    const system = buildSystemPrompt(functionsProfile, functionsProblem, {
      phase: "solve",
      currentGap: null,
      resolvedCount: 0,
      totalGaps: 0,
      valueMatchesFinalAnswer: true,
    });

    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: "Hi! I'm ready to start." },
      {
        role: "assistant",
        content:
          "Hey John! Great to have you here — let's do this! Today we're going to work on a problem involving functions and evaluating expressions.",
      },
      { role: "user", content: "Yeah" },
      {
        role: "assistant",
        content:
          "Great news — you're solid on the prerequisites here, so let's dive right in! Here's the problem: f(x) = 3x + 2. If x = 2, what is the value of f(x)? Let's take it step by step. The first thing we want to do is substitute the value of x into the function. Since x = 2, what do you get when you replace x with 2 in 3x + 2?",
      },
      { role: "user", content: "7" },
      {
        role: "assistant",
        content:
          "Almost there! Let's double-check that. When x = 2, we get: 3(2) + 2. What is 3 × 2? And then what do you get when you add 2 to that?",
      },
      { role: "user", content: "Is it 8?" },
    ];

    for (let i = 0; i < 5; i++) {
      const response = await anthropic.messages.create({
        model: TUTOR_MODEL,
        max_tokens: 512,
        system,
        messages,
      });

      const text = response.content.find((b) => b.type === "text")?.text;
      console.log(`--- Sonnet solve-nudge reply (run ${i + 1}) ---\n${text}\n---`);
    }
  }, 60_000);

  it("recaps a correct final answer as correct, built from a full real session — issue #33", async () => {
    // Unlike the fixtures above (a hand-written guess at what a transcript
    // looks like), this drives an actual session turn by turn — intro, a
    // wrong gap-check answer, a correct one, two wrong solve attempts, then
    // the correct final answer — using the same judge -> advance ->
    // buildSystemPrompt sequence conversation.ts's handleTurn uses (inlined
    // here rather than calling handleTurn itself, since its mastery/
    // misconception side effects are irrelevant to this eval and would only
    // require mocking Supabase for no benefit). This gives the final
    // review-phase call a real, live-model-authored transcript to react to,
    // which is what actually reproduces issue #33 (Sonnet re-grading the
    // final answer against the tutor's last scaffold sub-question and
    // calling it wrong) instead of a fabrication that only looks plausible.
    const SUBSTITUTION = "44444444-4444-4444-4444-444444444444" as UUID;

    const functionsProfileFull: StudentProfile = {
      courseName: "Functions",
      student: { id: "u3", firstName: "Sam" },
      topicMasteryScores: {
        [SUBSTITUTION]: { name: "Substituting into Expressions", mastery: 0.3 },
      },
      weaknesses: {},
    };

    const functionsProblemFull: Problem = {
      id: "p3" as Problem["id"],
      questionContent: "f(x) = 3x + 2. If x = 2, what is the value of f(x)?",
      correctAnswer: "8",
      orderIndex: 0,
      tops: [SUBSTITUTION],
    };

    function turnContextFor(
      state: TutoringState,
      valueMatchesFinalAnswer?: boolean,
    ): TurnContext {
      return {
        phase: state.phase,
        currentGap: currentGap(state),
        resolvedCount: state.gaps.filter((g) => g.resolved).length,
        totalGaps: state.gaps.length,
        valueMatchesFinalAnswer,
      };
    }

    async function tutorReply(
      state: TutoringState,
      history: Anthropic.MessageParam[],
      studentMessage: string,
      valueMatchesFinalAnswer?: boolean,
    ): Promise<string> {
      const system = buildSystemPrompt(
        functionsProfileFull,
        functionsProblemFull,
        turnContextFor(state, valueMatchesFinalAnswer),
      );
      const response = await anthropic.messages.create({
        model: TUTOR_MODEL,
        max_tokens: 512,
        system,
        messages: [...history, { role: "user", content: studentMessage }],
      });
      return response.content.find((b) => b.type === "text")?.text ?? "";
    }

    let state = initTutoringState(functionsProfileFull, functionsProblemFull); // intro
    let history: Anthropic.MessageParam[] = [];

    // Opening greeting against the seed message, mirroring openSession.
    const greeting = await tutorReply(state, [], SESSION_SEED_MESSAGE);
    history = [
      { role: "user", content: SESSION_SEED_MESSAGE },
      { role: "assistant", content: greeting },
    ];

    // Intro turn: any message advances straight to gap_check, no judging.
    state = advance(state, { type: "ADVANCE" });
    expect(state.phase).toBe("gap_check");
    let studentMessage = "Hi, I'm ready!";
    let reply = await tutorReply(state, history, studentMessage);
    history.push({ role: "user", content: studentMessage }, { role: "assistant", content: reply });

    // Gap check, wrong answer. The tutor picks its own concrete example on
    // the fly (e.g. "what's 4(2) + 3?"), so a live judge call here would be
    // grading our scripted wording against an unpredictable question — not
    // what this eval is about. The correctness of *this* answer is known by
    // construction, so the transition is forced directly; only the final
    // solve attempt below needs a real, asserted judge verdict, since that's
    // the one that actually gates entry into the review phase in production.
    studentMessage =
      "Substitution means replacing the whole expression with the value of x, so f(x) just becomes 2.";
    state = advance(state, { type: "GAP_ATTEMPT", correct: false });
    expect(state.phase).toBe("gap_check"); // stays open, tutor nudges
    reply = await tutorReply(state, history, studentMessage);
    history.push({ role: "user", content: studentMessage }, { role: "assistant", content: reply });

    // Gap check, correct answer.
    studentMessage =
      "Substitution means replacing every x in the expression with its given value, so 3x + 2 becomes 3(2) + 2 before you simplify.";
    state = advance(state, { type: "GAP_ATTEMPT", correct: true });
    expect(state.phase).toBe("solve"); // gap resolved, problem unlocked
    reply = await tutorReply(state, history, studentMessage);
    history.push({ role: "user", content: studentMessage }, { role: "assistant", content: reply });

    // Solve, first attempt — wrong, final-answer toggle ON.
    studentMessage = "10";
    state = advance(state, { type: "SOLVE_ATTEMPT", correct: false });
    expect(state.phase).toBe("solve");
    reply = await tutorReply(state, history, studentMessage);
    history.push({ role: "user", content: studentMessage }, { role: "assistant", content: reply });

    // Solve, second attempt — wrong again, toggle ON.
    studentMessage = "7";
    state = advance(state, { type: "SOLVE_ATTEMPT", correct: false });
    expect(state.phase).toBe("solve");
    reply = await tutorReply(state, history, studentMessage);
    history.push({ role: "user", content: studentMessage }, { role: "assistant", content: reply });

    // Solve, third attempt — the correct final answer, toggle ON. This is the
    // turn that collapses solve -> review -> completed in one step (same as
    // handleTurn), and the review-phase reply generated for it is exactly
    // what issue #33 reported as sometimes grading the answer WRONG against
    // whatever narrower sub-question the tutor's last scaffold message asked.
    // Unlike the setup turns above, this judge call IS real and asserted:
    // it's the one that actually decides completion in production.
    studentMessage = "8";
    const judged = await judgeTurn({
      anthropic,
      phase: "solve",
      history,
      studentMessage,
      correctAnswer: functionsProblemFull.correctAnswer,
      isFinalAttempt: true,
    });
    expect(judged.correct).toBe(true);
    state = advance(state, { type: "SOLVE_ATTEMPT", correct: true });
    expect(state.phase).toBe("review");
    state = advance(state, { type: "ADVANCE" });
    expect(state.status).toBe("completed");

    const finalMessages: Anthropic.MessageParam[] = [
      ...history,
      { role: "user", content: studentMessage },
    ];
    const system = buildSystemPrompt(
      functionsProfileFull,
      functionsProblemFull,
      turnContextFor(state),
    );

    for (let i = 0; i < 5; i++) {
      const response = await anthropic.messages.create({
        model: TUTOR_MODEL,
        max_tokens: 512,
        system,
        messages: finalMessages,
      });
      const text = response.content.find((b) => b.type === "text")?.text;
      console.log(
        `--- Sonnet review-phase recap, full-session issue #33 fixture (run ${i + 1}) ---\n${text}\n---`,
      );
    }
  }, 180_000);
});
