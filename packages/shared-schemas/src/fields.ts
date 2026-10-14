import { z } from "zod";

// Every message a user can see comes from the schemas, and the user reads
// Hebrew only. Zod's built-in messages are English, so:
//  1. the Hebrew locale is installed globally — a safety net so that any rule
//     without an explicit message still reads Hebrew (it is technical, e.g.
//     "קלט לא תקין: צריך להיות מחרוזת…", but never English);
//  2. user-facing rules get an explicit, plain Hebrew message through the
//     helpers below.
// This module is imported by every schema file, so the locale is always set
// before a schema is built, in both apps/api and apps/web.
z.config(z.locales.he());

export const REQUIRED = "שדה חובה";
export const maxLengthMessage = (max: number) => `ניתן להזין עד ${max} תווים`;

/** A required, trimmed text field: missing, blank and too long each get a Hebrew message. */
export const requiredText = (max: number) =>
  z
    .string({ error: REQUIRED })
    .trim()
    .min(1, { error: REQUIRED })
    .max(max, { error: maxLengthMessage(max) });

/** A required reference to another record (an id picked from a list). */
export const requiredChoice = (message: string) => z.string({ error: message }).min(1, { error: message });

/** A required list of ids with at least one entry. */
export const nonEmptyIdList = (message: string) => z.array(z.string(), { error: message }).min(1, { error: message });

export const requiredFlag = () => z.boolean({ error: "יש לבחור ערך" });

export const atLeastOneFieldMessage = "יש לשלוח לפחות שדה אחד לעדכון";
