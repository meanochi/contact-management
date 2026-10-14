// Shared mock of the Drizzle `db` handle from @contact-management/db for
// service unit tests (expertise-testing / expertise-postgres-drizzle).
//
// Statements are built by a REAL Drizzle query builder (`drizzle.mock()` — a
// driver-less instance), so the SQL a service generates is genuine and can be
// asserted on. Only execution is replaced: awaiting a statement records its
// SQL + parameters and resolves with the next result queued by the test.
//
// Wire it in a spec with:
//   jest.mock("@contact-management/db", () => jest.requireActual("../test-utils/db-mock").mockedDbModule());
//   import { dbMock } from "../test-utils/db-mock";
// then `dbMock.queue(rows, countRows, ...)` in the order the service awaits
// its statements, and read back `dbMock.executed`.

import { drizzle } from "drizzle-orm/node-postgres";

export interface ExecutedStatement {
  sql: string;
  params: unknown[];
}

type Builder = object & { toSQL(): ExecutedStatement };

const isBuilder = (value: unknown): value is Builder =>
  typeof value === "object" && value !== null && typeof (value as Builder).toSQL === "function";

function createDbMock() {
  const real = drizzle.mock();
  const executed: ExecutedStatement[] = [];
  let results: unknown[] = [];

  // Wraps a real builder so that every chained call keeps building real SQL,
  // but `await`ing it records the statement and returns the next queued result.
  // An `Error` in the queue is thrown instead of returned.
  function track<T extends Builder>(builder: T): T {
    const proxy: T = new Proxy(builder, {
      get(target, prop) {
        if (prop === "then") {
          return (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
            executed.push(target.toSQL());
            const next = results.length > 0 ? results.shift() : [];
            const settled = next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
            return settled.then(onFulfilled, onRejected);
          };
        }
        const value: unknown = Reflect.get(target, prop);
        // `constructor` and symbols are read by Drizzle's own `is()` type
        // checks and must stay untouched.
        if (typeof value !== "function" || typeof prop === "symbol" || prop === "constructor") return value;
        return (...args: unknown[]) => {
          const out: unknown = (value as (...a: unknown[]) => unknown).apply(target, args);
          if (out === target) return proxy;
          return isBuilder(out) ? track(out) : out;
        };
      },
    });
    return proxy;
  }

  const db = {
    select: (...args: unknown[]) => track((real.select as unknown as (...a: unknown[]) => Builder)(...args)),
    insert: (...args: unknown[]) => wrapBuilderFactory((real.insert as unknown as (...a: unknown[]) => object)(...args)),
    update: (...args: unknown[]) => wrapBuilderFactory((real.update as unknown as (...a: unknown[]) => object)(...args)),
    delete: (...args: unknown[]) => track((real.delete as unknown as (...a: unknown[]) => Builder)(...args)),
    // The callback gets the same mock as `tx`; a throw inside it propagates,
    // like a rolled-back transaction.
    transaction: <R>(callback: (tx: unknown) => Promise<R>) => callback(db),
    execute: () => Promise.resolve([]),
  };

  // `insert(t)` / `update(t)` return a builder that is not itself a statement
  // (`.values()` / `.set()` produce the statement) — wrap what it produces.
  function wrapBuilderFactory(factory: object): object {
    return new Proxy(factory, {
      get(target, prop) {
        const value: unknown = Reflect.get(target, prop);
        if (typeof value !== "function" || typeof prop === "symbol" || prop === "constructor") return value;
        return (...args: unknown[]) => {
          const out: unknown = (value as (...a: unknown[]) => unknown).apply(target, args);
          return isBuilder(out) ? track(out) : out;
        };
      },
    });
  }

  return {
    db,
    executed,
    /** Results for the next awaited statements, in await order. */
    queue: (...next: unknown[]) => {
      results.push(...next);
    },
    reset: () => {
      results = [];
      executed.length = 0;
    },
    /** Executed statements whose SQL matches. */
    matching: (pattern: RegExp) => executed.filter((statement) => pattern.test(statement.sql)),
  };
}

export const dbMock = createDbMock();

// Replacement for the "@contact-management/db" module: everything real (tables,
// operators, isUniqueViolation) except the `db` handle.
export function mockedDbModule() {
  const actual = jest.requireActual<Record<string, unknown>>("@contact-management/db");
  return { ...actual, db: dbMock.db };
}

/** A driver error as pg raises it for a unique-constraint violation. */
export const uniqueViolation = () => Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
