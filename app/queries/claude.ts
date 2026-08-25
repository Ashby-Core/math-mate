import Anthropic from "@anthropic-ai/sdk";
import { MISCONCEPTION_MODEL } from "@/app/tutor/constants";
import { DESCRIPTION_MAX } from "@/app/queries/weaknesses";

// Claude-backed inference that feeds the student knowledge profile. On every
// wrong answer, the tutoring conversation handler calls this to classify
// *why* the student was wrong, so the profile can name the misconception
// rather than just record a miss.

export type MisconceptionInput = {
  /**
   * What the student was actually asked — the assignment problem's question
   * text on a wrong solve attempt, or the tutor's ad-hoc follow-up question on
   * a wrong gap-check attempt. Passing the assignment problem in the
   * gap-check case would describe the wrong question entirely, since the
   * student is answering a prerequisite check-in the tutor made up on the
   * fly, not the assignment problem itself.
   */
  question: string;
  /**
   * The fixed correct answer, when there is one (a solve attempt, graded
   * against the problem's stored answer). `null` for a gap-check attempt —
   * an ad-hoc tutor question has no stored answer, so classification falls
   * back to `topicName` and the model's own subject-matter knowledge,
   * mirroring how `judge.ts`'s gap_check prompt has no fixed correctAnswer
   * either.
   */
  correctAnswer: string | null;
  studentAnswer: string;
  topicId: string;
  /** Human-readable topic name — the only classification anchor when correctAnswer is null. */
  topicName: string;
};

const MISCONCEPTION_SCHEMA = {
  type: "object",
  properties: {
    misconception: {
      // Nullable via anyOf, not a `type: ["string", "null"]` array — the
      // latter isn't a documented-supported JSON Schema shape for Claude's
      // structured outputs.
      anyOf: [{ type: "string" }, { type: "null" }],
      description:
        "A short (5-10 word) description of the student's underlying conceptual misunderstanding, phrased so a tutor could name it directly (e.g. 'adds numerators and denominators separately'). null if the wrong answer looks like a careless slip (arithmetic slip, sign error, transcription mistake) rather than clear evidence the student misunderstands the concept.",
    },
  },
  required: ["misconception"],
  additionalProperties: false,
} as const;

// This call only ever sees the question and the two final values — never the
// student's work. That means a slip and a misconception can look identical
// when the wrong value doesn't clearly point to a specific flawed rule. The
// prompt resolves that by biasing to null: a missed misconception costs one
// data point, but a wrongly-labeled one mislabels the student's profile going
// forward.
function misconceptionSystemPrompt(): string {
  return `You are analyzing a wrong answer from a math tutoring session to decide whether it reveals a genuine conceptual misconception.

Read the topic, the question, the correct answer (if given), and the student's wrong answer in the user message. If no correct answer is given, judge correctness yourself using your own knowledge of the topic.

The key judgment call: distinguish a careless slip from a real misconception, using only the question and the two values (you do not see the student's work).
- A careless slip is a one-off arithmetic mistake, a sign error, a transcription error, or any other wrong value that doesn't clearly point to a specific flawed rule. For a careless slip, return null.
- A genuine misconception is a wrong value that clearly points to the student applying a specific flawed rule or misunderstanding the operation itself (e.g. adding numerators and denominators separately instead of finding a common denominator). For a genuine misconception, return a short, specific description (5-10 words) of that misunderstanding — not a restatement that the answer is wrong.

You cannot see the student's work, so if the wrong value is equally consistent with a slip and a misconception, return null. Only report a misconception when the question and values clearly point to one specific, describable misunderstanding.

Respond using the required structured format only.`;
}

/**
 * Classifies a wrong answer against an injected Anthropic client, mirroring
 * `judgeTurn`'s dependency-injection pattern so tests never make a live API
 * call.
 *
 * Returns `null` — never throws — on any failure (API error, missing text
 * block, or a malformed/unparseable response), mirroring judge.ts's "never
 * let a flaky model corrupt state" failure mode: a bad call here must never
 * take down the turn that's asking about a wrong answer, not just fail to
 * classify it. Failures are logged (not silently swallowed), matching the
 * query layer's log+swallow convention.
 */
export async function classifyMisconception(
  input: MisconceptionInput,
  anthropic: Anthropic,
): Promise<string | null> {
  try {
    const response = await anthropic.messages.create({
      model: MISCONCEPTION_MODEL,
      max_tokens: 128,
      system: misconceptionSystemPrompt(),
      messages: [
        {
          role: "user",
          content: `Topic: ${input.topicName}
Question: ${input.question}
Correct answer: ${input.correctAnswer ?? "not given — use your own knowledge of the topic"}
Student's answer: ${input.studentAnswer}`,
        },
      ],
      output_config: { format: { type: "json_schema", schema: MISCONCEPTION_SCHEMA } },
    });

    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return null;

    const parsed = JSON.parse(text) as { misconception: string | null };
    if (!parsed.misconception) return null;
    return parsed.misconception.slice(0, DESCRIPTION_MAX);
  } catch (error) {
    console.error("Error classifying misconception:", error);
    return null;
  }
}
