import { z } from "zod";
import {
  REQUIRED,
  atLeastOneFieldMessage,
  maxLengthMessage,
  nonEmptyIdList,
  requiredChoice,
  requiredFlag,
  requiredText,
} from "../fields";

// Shared by every domainIds field below (create/add/edit-link) — same
// min(1) rule, same Hebrew message, defined once instead of three times.
const domainIdsSchema = nonEmptyIdList("יש לבחור לפחות תחום אחד");

// Real format validation for ת"ז, not just "not empty". Exactly 9 digits,
// plus the standard Israeli ID checksum (a weighted-digit check, the same
// algorithm the real teudat zehut uses) — so a random 9-digit string that
// isn't a real ID number is rejected too. Only used on create — idNumber
// isn't editable (Story 1.6 decision, unchanged).
function israeliIdChecksumValid(value: string): boolean {
  let sum = 0;
  for (let i = 0; i < value.length; i++) {
    const digit = Number(value[i]) * ((i % 2) + 1); // odd position ×1, even position ×2 — never above 18
    sum += digit > 9 ? digit - 9 : digit; // fold a two-digit product (max 18) to one digit, e.g. 9×2=18 → 1+8=9
  }
  return sum % 10 === 0;
}

const idNumberRequiredMessage = 'ת"ז היא שדה חובה';

const idNumberSchema = z
  .string({ error: idNumberRequiredMessage })
  .trim()
  .min(1, { error: idNumberRequiredMessage })
  .refine((value) => /^\d{9}$/.test(value) && israeliIdChecksumValid(value), {
    error: 'מספר ת"ז אינו תקין — יש להזין 9 ספרות תקינות',
  });

// A reasonable minimum length (9 characters), not a full phone-format/
// country-code validator. Shared by create and update.
const phoneSchema = z
  .string({ error: REQUIRED })
  .trim()
  .min(1, { error: REQUIRED })
  .min(9, { error: "מספר טלפון קצר מדי — נדרשים לפחות 9 תווים" })
  .max(50, { error: maxLengthMessage(50) });

const NO_EMAIL_MESSAGE = 'יש להזין לפחות כתובת דוא"ל אחת';
const emailsSchema = z
  .array(z.string({ error: REQUIRED }).trim().email({ error: 'כתובת דוא"ל אינה תקינה' }), { error: NO_EMAIL_MESSAGE })
  .min(1, { error: NO_EMAIL_MESSAGE });

// notes is the one genuinely optional/clearable field, filled from a plain
// text input whose form default is "", not undefined — so "" must pass. The
// Service layer (not the schema) turns "" into `null` in storage.
const notesSchema = z.string({ error: "ערך לא תקין" }).trim().max(2000, { error: maxLengthMessage(2000) });

export const createContactSchema = z.object({
  firstName: requiredText(100),
  lastName: requiredText(100),
  idNumber: idNumberSchema,
  role: requiredText(100),
  phone: phoneSchema,
  // FR-10: validated server-side and re-validated client-side through this
  // same schema (zodResolver) — "the bug returns" if only one side checks.
  emails: emailsSchema,
  notes: notesSchema.optional(),
  emailOptIn: requiredFlag(),
  smsOptIn: requiredFlag(),
  supportedBodyId: requiredChoice("יש לבחור גוף נתמך"),
  // Must be a non-empty subset of supportedBodyId's own domains — which
  // domains belong to that body isn't known here, so that part is checked in
  // the Service layer, not by the schema.
  domainIds: domainIdsSchema,
});

// Story 1.8 — search/filter, query params arrive as strings over HTTP.
// `includeInactive` is a boolean, not a `status` string (see the story's AC).
export const listContactsQuerySchema = z.object({
  // An empty search box arrives as "" — the service treats it as no search.
  search: z.string().trim().max(200).optional(),
  supportedBodyId: z.string().optional(),
  domainId: z.string().optional(),
  includeInactive: z.stringbool().optional(),
  updatedYear: z.coerce.number().int().min(2000).max(2100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Story 1.6 — PATCH /contacts/:id. Every field optional to send, but at least
// one must be present. firstName/lastName/idNumber/supportedBodyId are
// intentionally excluded. role/phone are required business fields: they may be
// omitted from a PATCH, but if sent they can't be blanked — only notes is
// clearable.
export const updateContactSchema = z
  .object({
    role: requiredText(100).optional(),
    phone: phoneSchema.optional(),
    emails: emailsSchema.optional(),
    notes: notesSchema.optional(),
    emailOptIn: requiredFlag().optional(),
    smsOptIn: requiredFlag().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    error: atLeastOneFieldMessage,
  });

// Story 1.6 — POST /contacts/:id/supported-bodies
export const addSupportedBodySchema = z.object({
  supportedBodyId: requiredChoice("יש לבחור גוף נתמך"),
  domainIds: domainIdsSchema,
});

// PATCH /contacts/:id/supported-bodies/:supportedBodyId — editing an
// existing link's domain subset (requested by Rachel).
// existing link's domain subset.
export const updateSupportedBodyDomainsSchema = z.object({
  domainIds: domainIdsSchema,
});

export const externalRequestSourceSchema = z.enum(["PHONE", "EMAIL", "OTHER"], {
  error: "יש לבחור את מקור הבקשה",
});

// Story 1.7 — POST /contacts/:id/deactivate. Both required (not a conditional
// "if one then both" rule): a deactivation without a documented source/date
// would violate FR-9. `date` stays an ISO string end to end (the service
// parses it) so the same schema works for the form and the wire.
export const deactivateContactSchema = z.object({
  source: externalRequestSourceSchema,
  date: z
    .string({ error: "יש לבחור תאריך" })
    .min(1, { error: "יש לבחור תאריך" })
    .refine((value) => !Number.isNaN(Date.parse(value)), { error: "תאריך לא תקין" }),
});

// Response shapes — also the source of truth for the Swagger docs.
export const contactSupportedBodyLinkSchema = z.object({
  supportedBodyId: z.string(),
  domainIds: z.array(z.string()),
});

export const contactSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  idNumber: z.string().nullable(),
  role: z.string().nullable(),
  phone: z.string().nullable(),
  emails: z.array(z.string()),
  notes: z.string().nullable(),
  emailOptIn: z.boolean(),
  smsOptIn: z.boolean(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  supportedBodyLinks: z.array(contactSupportedBodyLinkSchema),
});
