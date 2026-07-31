import type { TurnMeta } from "./responseShape";

// Pure client-side counterpart to the NDJSON frames API-1 writes (see
// app/api/sessions/[id]/message/route.ts). Kept free of React/DOM so it can be
// unit-tested under the existing node vitest config.

export type StreamFrame =
  | ({ type: "meta" } & TurnMeta)
  | { type: "token"; text: string }
  | { type: "done"; status: TurnMeta["status"] }
  | { type: "error"; message: string };

/**
 * Buffers a decoded chunk onto whatever was left over from the previous call
 * and splits out every complete (newline-terminated) line. Blank lines are
 * skipped. Whatever trails the last newline is returned as the new buffer to
 * carry into the next call.
 */
export function splitLines(
  buffer: string,
  chunk: string,
): { lines: string[]; remainder: string } {
  const combined = buffer + chunk;
  const parts = combined.split("\n");
  const remainder = parts.pop() ?? "";
  const lines = parts.filter((l) => l.length > 0);
  return { lines, remainder };
}

/** Parses one NDJSON line into a StreamFrame; throws on malformed/unrecognized input. */
export function parseFrame(line: string): StreamFrame {
  const parsed = JSON.parse(line);
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("type" in parsed) ||
    !["meta", "token", "done", "error"].includes(parsed.type)
  ) {
    throw new Error(`Unrecognized stream frame: ${line}`);
  }
  return parsed as StreamFrame;
}
