import type { z } from "zod";
import type {
  createSupportedBodySchema,
  listSupportedBodiesQuerySchema,
  supportedBodySchema,
  updateSupportedBodySchema,
} from "./schema";

// Inferred from the Zod schemas — see contacts/types.ts.
export type CreateSupportedBodyInput = z.output<typeof createSupportedBodySchema>;
export type UpdateSupportedBodyInput = z.output<typeof updateSupportedBodySchema>;
export type SupportedBodyDto = z.output<typeof supportedBodySchema>;
export type ListSupportedBodiesQuery = z.output<typeof listSupportedBodiesQuerySchema>;

export interface ListSupportedBodiesResult {
  items: SupportedBodyDto[];
  total: number;
  page: number;
  pageSize: number;
}
