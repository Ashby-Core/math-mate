import Anthropic from "@anthropic-ai/sdk";

/**
 * Constructs the Anthropic client, reading `ANTHROPIC_API_KEY` from the
 * environment. The conversation handler (TS-3) takes its client as an injected
 * dependency so tests can supply a fake; the API layer (Milestone 3) uses this
 * factory to build the real one.
 */
export function getAnthropic(): Anthropic {
  return new Anthropic();
}
