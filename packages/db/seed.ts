import "dotenv/config";
import { closeDatabase, db, domains } from "./src/client";

// Story 1.2: one-time seed for sample domains — there is no domain
// management screen in Epic 1 (ARCHITECTURE-SPINE.md Deferred), so this is
// how domains get into the database at all for now.
const SAMPLE_DOMAINS = ["חינוך", "בריאות"];

async function main() {
  await db
    .insert(domains)
    .values(SAMPLE_DOMAINS.map((name) => ({ name })))
    .onConflictDoNothing({ target: domains.name });
  console.warn(`Seeded ${SAMPLE_DOMAINS.length} domains.`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
