import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set — refusing to start without a database connection string.");
}

// node-postgres treats `?schema=public` (a Prisma-ism) as an unknown
// connection option; strip it so the same DATABASE_URL keeps working.
const connectionString = databaseUrl.replace(/[?&]schema=[^&]*/, "").replace(/\?$/, "");

const pool = new Pool({ connectionString });
// An idle client erroring (e.g. the server restarted) emits on the pool; without
// a listener Node treats it as an uncaught exception and kills the process.
pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
});

// The only database handle in the system (ARCHITECTURE-SPINE.md AD-5, AD-11)
// — reachable only from apps/api. Never create a second Pool/drizzle instance
// anywhere else.
export const db = drizzle(pool, { schema });

export type Database = typeof db;
// What `db.transaction(async (tx) => ...)` hands to its callback.
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export * from "./schema";
// Query operators are re-exported so apps/api never imports drizzle-orm
// directly — one entry point, one installed copy of the library.
export { and, asc, count, desc, eq, exists, gte, ilike, inArray, lt, notInArray, or, sql } from "drizzle-orm";
export { auditContext } from "./audit-context";

const PG_UNIQUE_VIOLATION = "23505";

// drizzle-orm wraps driver errors in a DrizzleQueryError whose `cause` is the
// original pg DatabaseError, so the SQLSTATE can be on either level.
function pgErrorCode(err: unknown): string | undefined {
  for (let current: unknown = err, depth = 0; current && depth < 3; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

// Services translate this into a 409 (expertise-api-rest: "translate ORM
// errors at the Service layer").
export function isUniqueViolation(err: unknown): boolean {
  return pgErrorCode(err) === PG_UNIQUE_VIOLATION;
}

// Readiness probe: resolves if the database answers, rejects otherwise.
export async function pingDatabase(): Promise<void> {
  await db.execute(sql`select 1`);
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
