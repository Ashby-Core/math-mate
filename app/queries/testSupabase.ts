import { vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Test-only fakes for the Supabase query builder. Not imported by app code.
 *
 * `chain(result)` returns a builder where every PostgREST method
 * (`select`/`eq`/`order`/`limit`/`insert`/`update`/`upsert`/`single`/...)
 * returns the same builder, and the builder is awaitable — resolving to
 * `result` no matter where in the chain you stop. That covers every call shape
 * in the queries folder, whose chains terminate at different methods
 * (`.single()`, `.eq()`, `.limit()`, `.maybeSingle()`, ...).
 */
export type QueryResult = { data?: unknown; error?: unknown };

export type Chain = Record<string, ReturnType<typeof vi.fn>> & {
  then: (resolve: (value: QueryResult) => void) => void;
};

const METHODS = [
  "select",
  "eq",
  "neq",
  "in",
  "order",
  "limit",
  "insert",
  "update",
  "upsert",
  "delete",
  "single",
  "maybeSingle",
] as const;

export function chain(result: QueryResult): Chain {
  const builder = {
    then: (resolve: (value: QueryResult) => void) => resolve(result),
  } as Chain;
  for (const method of METHODS) {
    builder[method] = vi.fn(() => builder);
  }
  return builder;
}

/**
 * A fake Supabase client whose successive `.from(...)`/`.rpc(...)` calls
 * return the chains built from `results` in order (the last result repeats if
 * called more times than there are results). `from` and `rpc` share the same
 * queue/index so tests can pass results in true call order across both.
 * Returns the typed client plus the raw chains so tests can assert on the
 * arguments passed to `insert`/`upsert`/`rpc`/etc.
 */
export function fakeSupabase(...results: QueryResult[]) {
  const chains = results.map(chain);
  let i = 0;
  const next = () => chains[Math.min(i++, chains.length - 1)];
  const from = vi.fn(() => next());
  const rpc = vi.fn(() => next());
  return { client: { from, rpc } as unknown as SupabaseClient, from, rpc, chains };
}
