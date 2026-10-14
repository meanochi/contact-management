import { z } from "zod";

// Story 1.2: read-only DTO — no create/edit schema in this story (no domain
// management screen in Epic 1, ARCHITECTURE-SPINE.md Deferred).
export const domainSchema = z.object({
  id: z.string(),
  name: z.string(),
  isActive: z.boolean(),
});
