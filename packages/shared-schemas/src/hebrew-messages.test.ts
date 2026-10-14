import type { ZodObject, ZodRawShape } from "zod";
import {
  addSupportedBodySchema,
  createContactSchema,
  deactivateContactSchema,
  listContactsQuerySchema,
  updateContactSchema,
  updateSupportedBodyDomainsSchema,
} from "./contacts/schema";
import {
  createSupportedBodySchema,
  listSupportedBodiesQuerySchema,
  updateSupportedBodySchema,
} from "./supported-bodies/schema";

// The users read Hebrew only, and every message a schema produces can reach
// them (under a form field, or from the API's VALIDATION_ERROR details). This
// feeds each request schema a spread of wrong values, field by field, and
// asserts that no message is English-only. A new rule added without an
// explicit message still passes (the global Hebrew locale covers it); what
// fails is the locale not being installed.
const HEBREW_LETTER = /[֐-׿]/;

const BAD_VALUES: unknown[] = [
  undefined,
  null,
  123,
  true,
  "",
  "   ",
  "abc",
  "-1",
  "x".repeat(3000),
  [],
  [""],
  ["not-an-email"],
  [123],
  {},
];

const objectSchemas: Record<string, ZodObject<ZodRawShape>> = {
  createContactSchema,
  updateContactSchema,
  listContactsQuerySchema,
  addSupportedBodySchema,
  updateSupportedBodyDomainsSchema,
  deactivateContactSchema,
  createSupportedBodySchema,
  updateSupportedBodySchema,
  listSupportedBodiesQuerySchema,
} as unknown as Record<string, ZodObject<ZodRawShape>>;

describe("schema validation messages are Hebrew", () => {
  it.each(Object.entries(objectSchemas))("%s", (_name, schema) => {
    const messages = new Set<string>();
    const collect = (input: unknown) => {
      const result = schema.safeParse(input);
      if (!result.success) result.error.issues.forEach((issue) => messages.add(issue.message));
    };

    collect({});
    collect(null);
    collect("not an object");
    for (const key of Object.keys(schema.shape)) {
      for (const bad of BAD_VALUES) collect({ [key]: bad });
    }

    expect(messages.size).toBeGreaterThan(0);
    const english = [...messages].filter((message) => !HEBREW_LETTER.test(message));
    expect(english).toEqual([]);
  });

  it("gives the common form mistakes a plain, specific Hebrew message", () => {
    const messageFor = (input: unknown, path: string) =>
      createContactSchema.safeParse(input).error?.issues.find((i) => i.path.join(".") === path)?.message;

    expect(messageFor({}, "firstName")).toBe("שדה חובה");
    expect(messageFor({ firstName: "" }, "firstName")).toBe("שדה חובה");
    expect(messageFor({ firstName: "x".repeat(101) }, "firstName")).toBe("ניתן להזין עד 100 תווים");
    expect(messageFor({ emails: ["abc"] }, "emails.0")).toBe('כתובת דוא"ל אינה תקינה');
    expect(messageFor({ emails: [] }, "emails")).toBe('יש להזין לפחות כתובת דוא"ל אחת');
    expect(messageFor({ supportedBodyId: "" }, "supportedBodyId")).toBe("יש לבחור גוף נתמך");
    expect(messageFor({ domainIds: [] }, "domainIds")).toBe("יש לבחור לפחות תחום אחד");
  });
});
