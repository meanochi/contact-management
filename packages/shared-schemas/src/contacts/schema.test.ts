import type { ZodType } from "zod";
import {
  createContactSchema,
  updateContactSchema,
  listContactsQuerySchema,
  addSupportedBodySchema,
  updateSupportedBodyDomainsSchema,
  deactivateContactSchema,
} from "./schema";

// 000000018 is a real checksum-valid Israeli ID (weights 1,2,1,2,... → sum 10).
const VALID_ID = "000000018";

const validCreate = () => ({
  firstName: "רחל",
  lastName: "כהן",
  idNumber: VALID_ID,
  role: "מנהלת",
  phone: "0500000000",
  emails: ["rachel@example.com"],
  emailOptIn: true,
  smsOptIn: false,
  supportedBodyId: "body-1",
  domainIds: ["domain-1"],
});

const without = <T extends object>(obj: T, ...keys: (keyof T)[]) =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k as keyof T)));

const isValid = (schema: ZodType, input: unknown) => schema.safeParse(input).success;

// Distinct top-level field names that failed, in report order.
const errorFields = (schema: ZodType, input: unknown) => {
  const result = schema.safeParse(input);
  return result.success ? undefined : [...new Set(result.error.issues.map((issue) => issue.path[0]))];
};

describe("createContactSchema", () => {
  it("accepts a fully valid contact", () => {
    expect(isValid(createContactSchema, validCreate())).toBe(true);
  });

  describe("idNumber", () => {
    it.each([
      ["a 9-digit string that fails the checksum", "123456789"],
      ["fewer than 9 digits", "12345678"],
      ["more than 9 digits", "0000000180"],
      ["non-digit characters", "00000001a"],
      ["an empty string", ""],
    ])("rejects %s", (_label, idNumber) => {
      expect(errorFields(createContactSchema, { ...validCreate(), idNumber })).toEqual(["idNumber"]);
    });

    it("rejects a missing idNumber", () => {
      expect(errorFields(createContactSchema, without(validCreate(), "idNumber"))).toEqual(["idNumber"]);
    });

    it("trims surrounding whitespace before validating", () => {
      const result = createContactSchema.safeParse({ ...validCreate(), idNumber: ` ${VALID_ID} ` });
      expect(result.success && result.data.idNumber).toBe(VALID_ID);
    });
  });

  describe("phone", () => {
    it("rejects a phone shorter than 9 characters", () => {
      expect(errorFields(createContactSchema, { ...validCreate(), phone: "12345678" })).toEqual(["phone"]);
    });

    it("rejects a missing phone", () => {
      expect(errorFields(createContactSchema, without(validCreate(), "phone"))).toEqual(["phone"]);
    });

    it("rejects a phone longer than 50 characters", () => {
      expect(errorFields(createContactSchema, { ...validCreate(), phone: "1".repeat(51) })).toEqual(["phone"]);
    });
  });

  describe("emails", () => {
    it("rejects an empty list", () => {
      expect(errorFields(createContactSchema, { ...validCreate(), emails: [] })).toEqual(["emails"]);
    });

    it("rejects a malformed address", () => {
      expect(errorFields(createContactSchema, { ...validCreate(), emails: ["not-an-email"] })).toEqual(["emails"]);
    });
  });

  describe("domainIds", () => {
    it("rejects an empty list with the Hebrew message", () => {
      const result = createContactSchema.safeParse({ ...validCreate(), domainIds: [] });
      expect(!result.success && result.error.issues[0]?.message).toBe("יש לבחור לפחות תחום אחד");
    });

    it("rejects a missing domainIds with the same Hebrew message", () => {
      const result = createContactSchema.safeParse(without(validCreate(), "domainIds"));
      expect(!result.success && result.error.issues[0]?.message).toBe("יש לבחור לפחות תחום אחד");
    });
  });

  describe("required string fields", () => {
    it.each(["firstName", "lastName", "role"])("rejects a blank %s", (field) => {
      expect(errorFields(createContactSchema, { ...validCreate(), [field]: "   " })).toEqual([field]);
    });
  });

  describe("notes", () => {
    it("allows an empty string (the 'clear it' signal) and an omitted value", () => {
      expect(isValid(createContactSchema, { ...validCreate(), notes: "" })).toBe(true);
      expect(isValid(createContactSchema, validCreate())).toBe(true);
    });

    it("rejects notes longer than 2000 characters", () => {
      expect(errorFields(createContactSchema, { ...validCreate(), notes: "x".repeat(2001) })).toEqual(["notes"]);
    });
  });

  it("requires both opt-in flags to be sent explicitly", () => {
    expect(errorFields(createContactSchema, without(validCreate(), "emailOptIn", "smsOptIn"))).toEqual([
      "emailOptIn",
      "smsOptIn",
    ]);
  });

  it("strips unknown keys so they never reach the service", () => {
    const result = createContactSchema.safeParse({ ...validCreate(), isAdmin: true });
    expect(result.success && "isAdmin" in result.data).toBe(false);
  });
});

describe("updateContactSchema", () => {
  it("rejects an empty body", () => {
    expect(isValid(updateContactSchema, {})).toBe(false);
  });

  it("accepts a partial update", () => {
    expect(isValid(updateContactSchema, { smsOptIn: true })).toBe(true);
  });

  it.each(["role", "phone"])("does not let %s be blanked to an empty string", (field) => {
    expect(isValid(updateContactSchema, { [field]: "" })).toBe(false);
  });

  it("lets notes be cleared with an empty string", () => {
    expect(isValid(updateContactSchema, { notes: "" })).toBe(true);
  });

  it("ignores fields that are not editable (idNumber, firstName), so they alone make an empty update", () => {
    expect(isValid(updateContactSchema, { idNumber: VALID_ID })).toBe(false);
    expect(isValid(updateContactSchema, { firstName: "x" })).toBe(false);
    const result = updateContactSchema.safeParse({ smsOptIn: true, idNumber: VALID_ID });
    expect(result.success && result.data).toEqual({ smsOptIn: true });
  });
});

describe("listContactsQuerySchema", () => {
  it("applies page=1 and pageSize=20 defaults", () => {
    const result = listContactsQuerySchema.safeParse({});
    expect(result.success && result.data).toEqual({ page: 1, pageSize: 20 });
  });

  it("coerces query-string values to their real types", () => {
    const result = listContactsQuerySchema.safeParse({
      includeInactive: "true",
      page: "2",
      pageSize: "50",
      updatedYear: "2026",
    });
    expect(result.success && result.data).toMatchObject({
      includeInactive: true,
      page: 2,
      pageSize: 50,
      updatedYear: 2026,
    });
  });

  it("reads includeInactive=false as false, not as a truthy string", () => {
    const result = listContactsQuerySchema.safeParse({ includeInactive: "false" });
    expect(result.success && result.data.includeInactive).toBe(false);
  });

  it("accepts an empty search string, which the service treats as no search", () => {
    const result = listContactsQuerySchema.safeParse({ search: "" });
    expect(result.success && !result.data.search).toBe(true);
  });

  it.each([
    ["page below 1", { page: 0 }],
    ["pageSize above 100", { pageSize: 101 }],
    ["updatedYear below 2000", { updatedYear: 1999 }],
    ["updatedYear above 2100", { updatedYear: 2101 }],
    ["a non-integer page", { page: 1.5 }],
  ])("rejects %s", (_label, query) => {
    expect(isValid(listContactsQuerySchema, query)).toBe(false);
  });
});

describe("addSupportedBodySchema / updateSupportedBodyDomainsSchema", () => {
  it("requires supportedBodyId and at least one domain when adding a link", () => {
    expect(isValid(addSupportedBodySchema, { supportedBodyId: "b", domainIds: ["d"] })).toBe(true);
    expect(isValid(addSupportedBodySchema, { domainIds: ["d"] })).toBe(false);
    expect(isValid(addSupportedBodySchema, { supportedBodyId: "b", domainIds: [] })).toBe(false);
  });

  it("rejects emptying a link's domain subset", () => {
    expect(isValid(updateSupportedBodyDomainsSchema, { domainIds: [] })).toBe(false);
    expect(isValid(updateSupportedBodyDomainsSchema, { domainIds: ["d"] })).toBe(true);
  });
});

describe("deactivateContactSchema", () => {
  it("requires both source and date", () => {
    expect(isValid(deactivateContactSchema, { source: "PHONE", date: "2026-10-01" })).toBe(true);
    expect(isValid(deactivateContactSchema, { source: "PHONE" })).toBe(false);
    expect(isValid(deactivateContactSchema, { date: "2026-10-01" })).toBe(false);
  });

  it("rejects an unknown source", () => {
    expect(isValid(deactivateContactSchema, { source: "FAX", date: "2026-10-01" })).toBe(false);
  });

  it("rejects an unparsable date", () => {
    expect(isValid(deactivateContactSchema, { source: "EMAIL", date: "not-a-date" })).toBe(false);
  });
});
