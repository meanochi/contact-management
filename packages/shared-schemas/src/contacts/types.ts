import type { z } from "zod";
import type {
  addSupportedBodySchema,
  contactSchema,
  contactSupportedBodyLinkSchema,
  createContactSchema,
  deactivateContactSchema,
  externalRequestSourceSchema,
  listContactsQuerySchema,
  updateContactSchema,
  updateSupportedBodyDomainsSchema,
} from "./schema";

// Types are inferred from the Zod schemas, so a type can never drift from the
// validation that guards it. `z.input` is what a form/client sends (before
// defaults and transforms); `z.output` is what a service receives.
export type CreateContactInput = z.output<typeof createContactSchema>;
export type UpdateContactInput = z.output<typeof updateContactSchema>;
export type AddSupportedBodyInput = z.output<typeof addSupportedBodySchema>;
export type UpdateSupportedBodyDomainsInput = z.output<typeof updateSupportedBodyDomainsSchema>;
export type ExternalRequestSource = z.output<typeof externalRequestSourceSchema>;
export type DeactivateContactInput = z.output<typeof deactivateContactSchema>;
export type ContactSupportedBodyLink = z.output<typeof contactSupportedBodyLinkSchema>;
export type ContactDto = z.output<typeof contactSchema>;
export type ListContactsQuery = z.output<typeof listContactsQuerySchema>;

export interface ListContactsResult {
  items: ContactDto[];
  total: number;
  page: number;
  pageSize: number;
}
