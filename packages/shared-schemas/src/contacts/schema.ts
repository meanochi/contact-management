import Joi from "joi";
import type {
  CreateContactInput,
  ListContactsQuery,
  UpdateContactInput,
  AddSupportedBodyInput,
  UpdateSupportedBodyDomainsInput,
  DeactivateContactInput,
} from "./types";

// Shared by every domainIds field below (create/add/edit-link) — same
// min(1) rule, same Hebrew message, defined once instead of three times.
const domainIdsSchema = Joi.array()
  .items(Joi.string())
  .min(1)
  .required()
  .messages({ "array.min": "יש לבחור לפחות תחום אחד", "any.required": "יש לבחור לפחות תחום אחד" });

// Requested by Rachel: real format validation for ת"ז, not just "not empty".
// Exactly 9 digits, plus the standard Israeli ID checksum (a weighted-digit
// check, the same algorithm the real teudat zehut uses) — not just a length
// check, so a random 9-digit string that isn't a real ID number is rejected
// too. Only used in createContactFields — idNumber isn't editable (Story 1.6
// decision, unchanged).
function israeliIdChecksumValid(value: string): boolean {
  let sum = 0;
  for (let i = 0; i < value.length; i++) {
    const digit = Number(value[i]) * ((i % 2) + 1); // odd position ×1, even position ×2 — never above 18
    sum += digit > 9 ? digit - 9 : digit; // fold a two-digit product (max 18) to one digit, e.g. 9×2=18 → 1+8=9
  }
  return sum % 10 === 0;
}

const idNumberSchema = Joi.string()
  .trim()
  .custom((value: string, helpers) => {
    if (!/^\d{9}$/.test(value) || !israeliIdChecksumValid(value)) {
      return helpers.error("idNumber.invalid");
    }
    return value;
  }, "Israeli ID checksum")
  .required()
  .messages({
    "idNumber.invalid": 'מספר ת"ז אינו תקין — יש להזין 9 ספרות תקינות',
    "any.required": 'ת"ז היא שדה חובה',
    "string.empty": 'ת"ז היא שדה חובה',
  });

// Requested by Rachel: "מספר תווים הגיוני, מינימום 9" — a plain length
// floor, not a full phone-format/country-code validator. Shared by create
// and update (both currently require phone to be non-blank when present).
const phoneSchema = Joi.string()
  .trim()
  .min(9)
  .max(50)
  .messages({ "string.min": "מספר טלפון קצר מדי — נדרשים לפחות 9 תווים" });

// Record<keyof T, Joi.Schema> fails to compile if a field is added to/removed
// from CreateContactInput without updating the schema (expertise-nodejs-typescript).
const createContactFields: Record<keyof CreateContactInput, Joi.Schema> = {
  firstName: Joi.string().trim().min(1).max(100).required(),
  lastName: Joi.string().trim().min(1).max(100).required(),
  // Revised per Rachel: these are required, same as firstName/lastName —
  // only notes (below) is genuinely optional/clearable.
  idNumber: idNumberSchema,
  role: Joi.string().trim().min(1).max(100).required(),
  phone: phoneSchema.required(),
  // FR-10: format validated here (server) and re-validated client-side via
  // the same schema (joiResolver) — "the bug returns" if only one side checks.
  emails: Joi.array().items(Joi.string().trim().email()).min(1).required(),
  // .allow('') — notes is the one genuinely optional/clearable field, filled
  // from a plain text input whose RHF default value is "", not undefined;
  // without this, Joi's default "string disallows empty" rule rejects an
  // untouched field and blocks saving. The Service layer (not Joi) turns ""
  // into `null` in storage — see contacts.service.ts.
  notes: Joi.string().trim().max(2000).allow("").optional(),
  emailOptIn: Joi.boolean().required(),
  smsOptIn: Joi.boolean().required(),
  supportedBodyId: Joi.string().required(),
  // Must be a non-empty subset of supportedBodyId's own domains — which
  // domains belong to that body isn't known to Joi, so that part is checked
  // in the Service layer (contacts.service.ts), not here.
  domainIds: domainIdsSchema,
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

// Story 1.6 — PATCH /contacts/:id. Every field optional **to send** (`.min(1)`
// on the whole object rejects an empty body) — firstName/lastName/idNumber/
// supportedBodyId intentionally excluded, see UpdateContactInput. role/phone
// are required business fields (per Rachel): optional to omit from a PATCH,
// but if sent, can't be blanked to "" — `.min(1)`, no `.allow("")`, unlike
// notes below. Editing can't un-set a required field, only create something
// that was never required in the first place.
const updateContactFields: Record<keyof UpdateContactInput, Joi.Schema> = {
  role: Joi.string().trim().min(1).max(100).optional(),
  phone: phoneSchema.optional(),
  emails: Joi.array().items(Joi.string().trim().email()).min(1).optional(),
  // .allow('') — notes is the one field that's genuinely clearable; see
  // createContactFields above and contacts.service.ts's blankToNull, per
  // Rachel: "אני רוצה שגם בעדכון אוכל לעדכן את ההערות וזה ישמר" (clearing
  // notes on edit must persist).
  notes: Joi.string().trim().max(2000).allow("").optional(),
  emailOptIn: Joi.boolean().optional(),
  smsOptIn: Joi.boolean().optional(),
};

export const updateContactSchema = Joi.object(updateContactFields).min(1).required();

// Story 1.6 — POST /contacts/:id/supported-bodies
const addSupportedBodyFields: Record<keyof AddSupportedBodyInput, Joi.Schema> = {
  supportedBodyId: Joi.string().required(),
  domainIds: domainIdsSchema,
};

export const addSupportedBodySchema = Joi.object(addSupportedBodyFields).required();

// PATCH /contacts/:id/supported-bodies/:supportedBodyId — editing an
// existing link's domain subset (requested by Rachel).
const updateSupportedBodyDomainsFields: Record<keyof UpdateSupportedBodyDomainsInput, Joi.Schema> = {
  domainIds: domainIdsSchema,
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
