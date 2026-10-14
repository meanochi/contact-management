import { z } from "zod";
import { REQUIRED, atLeastOneFieldMessage, nonEmptyIdList, requiredText } from "../fields";

const DOMAINS_REQUIRED = "יש לבחור לפחות תחום אחד";

export const createSupportedBodySchema = z.object({
  name: requiredText(200),
  companyId: requiredText(50), // ח"פ
  domainIds: nonEmptyIdList(DOMAINS_REQUIRED), // at least one — Story 1.2
});

// Story 1.4 — query params arrive as strings over HTTP; they are coerced to
// their real types here (expertise-api-rest: validate GET query filters the
// same way as a mutating body). "status" (UX wording) maps onto the
// `isActive` boolean column. Page numbers are 1-based.
export const listSupportedBodiesQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  domainId: z.string().optional(),
  isActive: z.stringbool().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Story 1.3 — PATCH /supported-bodies/:id. Every field optional (partial
// update), but at least one must be present so an empty body is rejected
// instead of silently no-op-ing. `domainIds`, if sent, still can't be emptied.
export const updateSupportedBodySchema = z
  .object({
    name: requiredText(200).optional(),
    companyId: requiredText(50).optional(),
    domainIds: nonEmptyIdList(DOMAINS_REQUIRED).optional(),
    isActive: z.boolean({ error: REQUIRED }).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    error: atLeastOneFieldMessage,
  });

export const supportedBodySchema = z.object({
  id: z.string(),
  name: z.string(),
  companyId: z.string(),
  isActive: z.boolean(),
  domainIds: z.array(z.string()),
});
