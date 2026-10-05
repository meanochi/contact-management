import "dotenv/config";
import { prisma } from "../src/client";

// Story 1.2: one-time seed for sample domains — there is no domain
// management screen in Epic 1 (ARCHITECTURE-SPINE.md Deferred), so this is
// how domains get into the database at all for now.
const SAMPLE_DOMAINS = ["חינוך", "בריאות"];

async function main() {
  for (const name of SAMPLE_DOMAINS) {
    await prisma.domain.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.warn(`Seeded ${SAMPLE_DOMAINS.length} domains.`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
