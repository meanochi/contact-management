import Joi from "joi";
import type {
  CreateContactInput,
  ListContactsQuery,
  UpdateContactInput,
  AddSupportedBodyInput,
  UpdateSupportedBodyDomainsInput,
  DeactivateContactInput,
} from "./types";

// Record<keyof T, Joi.Schema> fails to compile if a field is added to/removed
// from CreateContactInput without updating the schema (expertise-nodejs-typescript).
const createContactFields: Record<keyof CreateContactInput, Joi.Schema> = {
  firstName: Joi.string().trim().min(1).max(100).required(),
  lastName: Joi.string().trim().min(1).max(100).required(),
  // .allow('') — these are genuinely optional fields filled from a plain text
  // input whose RHF default value is "", not undefined; without this, Joi's
  // default "string disallows empty" rule rejects every untouched optional
  // field and blocks saving (e.g. leaving "הערות" blank). The Service layer
  // (not Joi) is what turns "" into `null` in storage — see contacts.service.ts.
  idNumber: Joi.string().trim().max(20).allow("").optional(),
  role: Joi.string().trim().max(100).allow("").optional(),
  phone: Joi.string().trim().max(50).allow("").optional(),
  // FR-10: format validated here (server) and re-validated client-side via
  // the same schema (joiResolver) — "the bug returns" if only one side checks.
  emails: Joi.array().items(Joi.string().trim().email()).min(1).required(),
  notes: Joi.string().trim().max(2000).allow("").optional(),
  emailOptIn: Joi.boolean().required(),
  smsOptIn: Joi.boolean().required(),
  supportedBodyId: Joi.string().required(),
  // Must be a non-empty subset of supportedBodyId's own domains — which
  // domains belong to that body isn't known to Joi, so that part is checked
  // in the Service layer (contacts.service.ts), not here.
  domainIds: Joi.array().items(Joi.string()).min(1).required(),
};

export const createContactSchema = Joi.object(createContactFields).required();

// Story 1.8 — search/filter. See types.ts for why `includeInactive` is a
// boolean, not a `status` string.
const listContactsQueryFields: Record<keyof ListContactsQuery, Joi.Schema> = {
  search: Joi.string().trim().max(200).empty("").optional(),
  supportedBodyId: Joi.string().optional(),
  domainId: Joi.string().optional(),
  includeInactive: Joi.boolean().optional(),
  updatedYear: Joi.number().integer().min(2000).max(2100).optional(),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
};

export const listContactsQuerySchema = Joi.object(listContactsQueryFields).required();

// Story 1.6 — PATCH /contacts/:id. Every field optional, `.min(1)` rejects
// an empty body. firstName/lastName/idNumber/supportedBodyId intentionally
// excluded — see UpdateContactInput.
//
// .allow('') rather than .empty('') (unlike createContactFields, which could
// use either): the edit form always sends the full field set, so a field
// intentionally cleared to "" must still reach the Service as "" — not be
// stripped into "not sent, leave the existing value alone". The Service
// converts "" to `null` (clears the column), per Rachel: "אני רוצה שגם
// בעדכון אוכל לעדכן את ההערות וזה ישמר" (clearing notes on edit must persist).
const updateContactFields: Record<keyof UpdateContactInput, Joi.Schema> = {
  role: Joi.string().trim().max(100).allow("").optional(),
  phone: Joi.string().trim().max(50).allow("").optional(),
  emails: Joi.array().items(Joi.string().trim().email()).min(1).optional(),
  notes: Joi.string().trim().max(2000).allow("").optional(),
  emailOptIn: Joi.boolean().optional(),
  smsOptIn: Joi.boolean().optional(),
};

export const updateContactSchema = Joi.object(updateContactFields).min(1).required();

// Story 1.6 — POST /contacts/:id/supported-bodies
const addSupportedBodyFields: Record<keyof AddSupportedBodyInput, Joi.Schema> = {
  supportedBodyId: Joi.string().required(),
  domainIds: Joi.array().items(Joi.string()).min(1).required(),
};

export const addSupportedBodySchema = Joi.object(addSupportedBodyFields).required();

// PATCH /contacts/:id/supported-bodies/:supportedBodyId — editing an
// existing link's domain subset (requested by Rachel).
const updateSupportedBodyDomainsFields: Record<keyof UpdateSupportedBodyDomainsInput, Joi.Schema> = {
  domainIds: Joi.array().items(Joi.string()).min(1).required(),
};

export const updateSupportedBodyDomainsSchema = Joi.object(updateSupportedBodyDomainsFields).required();

// Story 1.7 — POST /contacts/:id/deactivate. Both plain `.required()`, not a
// conditional "if one then both" rule — the epic's "נדרשים ביחד" note just
// means neither is independently optional (UX-DR13: no immediate toggle).
const deactivateContactFields: Record<keyof DeactivateContactInput, Joi.Schema> = {
  source: Joi.string().valid("PHONE", "EMAIL", "OTHER").required(),
  date: Joi.date().required(),
};

export const deactivateContactSchema = Joi.object(deactivateContactFields).required();
