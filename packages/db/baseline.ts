import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool } from "pg";

// One-time helper for a database that was created by the old Prisma migrations
// and already contains the schema 0000_init.sql would create. It records that
// migration as applied (without running it), keeping all existing data, so
// `drizzle-kit migrate` only applies later migrations. Refuses to run if the
// migration history already has entries.
const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
  entries: { tag: string; when: number }[];
};
const first = journal.entries[0];
if (!first) throw new Error("No migrations in drizzle/meta/_journal.json");

// Same hash drizzle-orm computes: sha256 of the migration file's SQL.
const hash = createHash("sha256").update(readFileSync(`drizzle/${first.tag}.sql`, "utf8")).digest("hex");

async function main() {
  const pool = new Pool({ connectionString: databaseUrl!.replace(/[?&]schema=[^&]*/, "") });
  try {
    await pool.query('CREATE SCHEMA IF NOT EXISTS "drizzle"');
    await pool.query(
      'CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)',
    );
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM "drizzle"."__drizzle_migrations"');
    if (rows[0].n > 0) {
      console.warn("Migration history is not empty — nothing to baseline.");
      return;
    }
    await pool.query('INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)', [hash, first!.when]);
    console.warn(`Recorded ${first!.tag} as applied.`);
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
