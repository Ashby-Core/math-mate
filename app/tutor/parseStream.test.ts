import { describe, expect, it } from "vitest";
import { parseFrame, splitLines } from "./parseStream";

describe("splitLines", () => {
  it("splits a single complete line delivered in one chunk", () => {
    const { lines, remainder } = splitLines("", '{"a":1}\n');
    expect(lines).toEqual(['{"a":1}']);
    expect(remainder).toBe("");
  });

  it("splits multiple complete lines delivered in one chunk", () => {
    const { lines, remainder } = splitLines("", '{"a":1}\n{"b":2}\n');
    expect(lines).toEqual(['{"a":1}', '{"b":2}']);
    expect(remainder).toBe("");
  });

  it("carries a partial line across chunks and completes it on the next call", () => {
    const first = splitLines("", '{"a":1}\n{"b":');
    expect(first.lines).toEqual(['{"a":1}']);
    expect(first.remainder).toBe('{"b":');

    const second = splitLines(first.remainder, '2}\n');
    expect(second.lines).toEqual(['{"b":2}']);
    expect(second.remainder).toBe("");
  });

  it("skips blank lines", () => {
    const { lines, remainder } = splitLines("", '{"a":1}\n\n{"b":2}\n');
    expect(lines).toEqual(['{"a":1}', '{"b":2}']);
    expect(remainder).toBe("");
  });

  it("returns no lines and an empty remainder for an empty chunk", () => {
    const { lines, remainder } = splitLines("", "");
    expect(lines).toEqual([]);
    expect(remainder).toBe("");
  });
});

describe("parseFrame", () => {
  it("parses a token frame", () => {
    expect(parseFrame('{"type":"token","text":"hi"}')).toEqual({
      type: "token",
      text: "hi",
    });
  });

  it("parses a done frame", () => {
    expect(parseFrame('{"type":"done","status":"active"}')).toEqual({
      type: "done",
      status: "active",
    });
  });

  it("parses an error frame", () => {
    expect(parseFrame('{"type":"error","message":"boom"}')).toEqual({
      type: "error",
      message: "boom",
    });
  });

  it("parses a meta frame", () => {
    const meta = { type: "meta", phase: "solve", status: "active" };
    expect(parseFrame(JSON.stringify(meta))).toEqual(meta);
  });

  it("throws on malformed JSON", () => {
    expect(() => parseFrame("{not json")).toThrow();
  });

  it("throws on an unrecognized frame type", () => {
    expect(() => parseFrame('{"type":"mystery"}')).toThrow();
  });

  it("throws on a non-object payload", () => {
    expect(() => parseFrame("42")).toThrow();
  });
});
