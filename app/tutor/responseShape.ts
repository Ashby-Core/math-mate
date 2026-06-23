import type Anthropic from "@anthropic-ai/sdk";
import { Problem, StudentProfile } from "@/app/types";
import { classifyTopic, resolvePrerequisites } from "./gaps";
import { SESSION_SEED_MESSAGE } from "./conversation";
import {
  currentGap,
  GapEntry,
  isProblemUnlocked,
  Phase,
  SessionStatus,
  TutoringState,
} from "./stateMachine";

// Pure translation layer between internal domain objects (StudentProfile,
// Problem, TutoringState, Claude history) and the JSON the HTTP client receives.
// Crucially, it is the firewall that keeps `correctAnswer` off the wire and gates
// the problem text behind the server-owned phase. Reused by API-2 and API-1.

export type TopicTagStatus = "ok" | "unassessed" | "gap" | "checking" | "resolved";
export type TopicTag = { topicId: string; name: string; status: TopicTagStatus };

export type ApiProblem = {
  id: string;
  orderIndex: number;
  unlocked: boolean;
  /** The question text — only present once the problem is unlocked (Solve+). */
  questionContent: string | null;
  topics: TopicTag[];
};

export type MasteryBar = {
  topicId: string;
  name: string;
  mastery: number | null;
  status: "ok" | "gap" | "unassessed";
  isPrerequisite: boolean;
};

export type Sidebar = {
  masteryBars: MasteryBar[];
  tags: TopicTag[];
  stats: {
    gapsTotal: number;
    gapsResolved: number;
    phase: Phase;
    unlocked: boolean;
  };
};

export type DisplayMessage = { role: "user" | "assistant"; content: string };

export type SessionResponse = {
  sessionId: string;
  phase: Phase;
  status: SessionStatus;
  unlocked: boolean;
  problem: ApiProblem;
  gaps: GapEntry[];
  messages: DisplayMessage[];
  sidebar: Sidebar;
};

function contentToString(content: Anthropic.MessageParam["content"]): string {
  if (typeof content === "string") return content;
  return content
    .filter((b): b is Anthropic.TextBlockParam => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** Lowercased base classification for a topic's overall mastery standing. */
function baseStatus(mastery: number | null): "ok" | "gap" | "unassessed" {
  const s = classifyTopic(mastery);
  return s === "GAP" ? "gap" : s === "OK" ? "ok" : "unassessed";
}

/**
 * Classifies a problem's prerequisite topics for display, overlaying the live
 * session state on the base mastery classification. Precedence: a resolved gap →
 * "resolved"; the gap currently being probed (gap_check) → "checking"; otherwise
 * the base "gap"/"ok"/"unassessed".
 */
export function buildTopicTags(
  profile: StudentProfile,
  problem: Problem,
  state: TutoringState,
): TopicTag[] {
  const active = currentGap(state);
  return resolvePrerequisites(profile, problem).map((t) => {
    let status: TopicTagStatus;
    if (t.status === "GAP") {
      const gap = state.gaps.find((g) => g.topicId === t.topicId);
      if (gap?.resolved) status = "resolved";
      else if (active?.topicId === t.topicId) status = "checking";
      else status = "gap";
    } else {
      status = t.status === "OK" ? "ok" : "unassessed";
    }
    return { topicId: t.topicId, name: t.name ?? "Unknown topic", status };
  });
}

/** The problem shaped for the client — never includes `correctAnswer`. */
export function toApiProblem(
  profile: StudentProfile,
  problem: Problem,
  state: TutoringState,
): ApiProblem {
  const unlocked = isProblemUnlocked(state);
  return {
    id: problem.id,
    orderIndex: problem.orderIndex,
    unlocked,
    questionContent: unlocked ? problem.questionContent : null,
    topics: buildTopicTags(profile, problem, state),
  };
}

/** The knowledge-sidebar payload (mastery bars, session tags, progress stats). */
export function toSidebar(
  profile: StudentProfile,
  problem: Problem,
  state: TutoringState,
): Sidebar {
  const prereqs = new Set<string>(problem.tops);
  const masteryBars: MasteryBar[] = Object.entries(profile.topicMasteryScores).map(
    ([topicId, { name, mastery }]) => ({
      topicId,
      name,
      mastery,
      status: baseStatus(mastery),
      isPrerequisite: prereqs.has(topicId),
    }),
  );

  return {
    masteryBars,
    tags: buildTopicTags(profile, problem, state),
    stats: {
      gapsTotal: state.gaps.length,
      gapsResolved: state.gaps.filter((g) => g.resolved).length,
      phase: state.phase,
      unlocked: isProblemUnlocked(state),
    },
  };
}

/** Display transcript: strips the synthetic seed turn, flattens to plain text. */
export function toDisplayMessages(
  history: Anthropic.MessageParam[],
): DisplayMessage[] {
  return history
    .filter(
      (m, i) =>
        !(
          i === 0 &&
          m.role === "user" &&
          contentToString(m.content) === SESSION_SEED_MESSAGE
        ),
    )
    .filter(
      (m): m is Anthropic.MessageParam & { role: "user" | "assistant" } =>
        m.role !== "system",
    )
    .map((m) => ({ role: m.role, content: contentToString(m.content) }));
}

/** Composes the full bootstrap/turn response from internal state. */
export function toSessionResponse(args: {
  sessionId: string;
  state: TutoringState;
  profile: StudentProfile;
  problem: Problem;
  history: Anthropic.MessageParam[];
}): SessionResponse {
  const { sessionId, state, profile, problem, history } = args;
  return {
    sessionId,
    phase: state.phase,
    status: state.status,
    unlocked: isProblemUnlocked(state),
    problem: toApiProblem(profile, problem, state),
    gaps: state.gaps,
    messages: toDisplayMessages(history),
    sidebar: toSidebar(profile, problem, state),
  };
}
