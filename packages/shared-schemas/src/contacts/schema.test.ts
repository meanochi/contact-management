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

const errorFields = (error: { details: { path: (string | number)[] }[] } | undefined) =>
  error?.details.map((d) => d.path[0]);

describe("createContactSchema", () => {
  it("accepts a fully valid contact", () => {
    expect(createContactSchema.validate(validCreate()).error).toBeUndefined();
  });

  describe("idNumber", () => {
    it.each([
      ["a 9-digit string that fails the checksum", "123456789"],
      ["fewer than 9 digits", "12345678"],
      ["more than 9 digits", "0000000180"],
      ["non-digit characters", "00000001a"],
      ["an empty string", ""],
    ])("rejects %s", (_label, idNumber) => {
      const { error } = createContactSchema.validate({ ...validCreate(), idNumber });
      expect(errorFields(error)).toEqual(["idNumber"]);
    });

    it("rejects a missing idNumber", () => {
      const rest = without(validCreate(), "idNumber");
      const { error } = createContactSchema.validate(rest);
      expect(errorFields(error)).toEqual(["idNumber"]);
    });

    it("trims surrounding whitespace before validating", () => {
      const { error, value } = createContactSchema.validate({ ...validCreate(), idNumber: ` ${VALID_ID} ` });
      expect(error).toBeUndefined();
      expect(value.idNumber).toBe(VALID_ID);
    });
  });

  describe("phone", () => {
    it("rejects a phone shorter than 9 characters", () => {
      const { error } = createContactSchema.validate({ ...validCreate(), phone: "12345678" });
      expect(errorFields(error)).toEqual(["phone"]);
    });

    it("rejects a missing phone", () => {
      const rest = without(validCreate(), "phone");
      expect(errorFields(createContactSchema.validate(rest).error)).toEqual(["phone"]);
    });

    it("rejects a phone longer than 50 characters", () => {
      const { error } = createContactSchema.validate({ ...validCreate(), phone: "1".repeat(51) });
      expect(errorFields(error)).toEqual(["phone"]);
    });
  });

  describe("emails", () => {
    it("rejects an empty list", () => {
      expect(errorFields(createContactSchema.validate({ ...validCreate(), emails: [] }).error)).toEqual(["emails"]);
    });

    it("rejects a malformed address", () => {
      const { error } = createContactSchema.validate({ ...validCreate(), emails: ["not-an-email"] });
      expect(errorFields(error)).toEqual(["emails"]);
    });
  });

  describe("domainIds", () => {
    it("rejects an empty list with the Hebrew message", () => {
      const { error } = createContactSchema.validate({ ...validCreate(), domainIds: [] });
      expect(error?.details[0]?.message).toBe("יש לבחור לפחות תחום אחד");
    });

    it("rejects a missing domainIds", () => {
      const rest = without(validCreate(), "domainIds");
      expect(errorFields(createContactSchema.validate(rest).error)).toEqual(["domainIds"]);
    });
  });

  describe("required string fields", () => {
    it.each(["firstName", "lastName", "role"])("rejects a blank %s", (field) => {
      const { error } = createContactSchema.validate({ ...validCreate(), [field]: "   " });
      expect(errorFields(error)).toEqual([field]);
    });
  });

  describe("notes", () => {
    it("allows an empty string (the 'clear it' signal) and an omitted value", () => {
      expect(createContactSchema.validate({ ...validCreate(), notes: "" }).error).toBeUndefined();
      expect(createContactSchema.validate(validCreate()).error).toBeUndefined();
    });

    it("rejects notes longer than 2000 characters", () => {
      const { error } = createContactSchema.validate({ ...validCreate(), notes: "x".repeat(2001) });
      expect(errorFields(error)).toEqual(["notes"]);
    });
  });

  it("requires both opt-in flags to be sent explicitly", () => {
    const rest = without(validCreate(), "emailOptIn", "smsOptIn");
    expect(errorFields(createContactSchema.validate(rest, { abortEarly: false }).error)).toEqual([
      "emailOptIn",
      "smsOptIn",
    ]);
  });
});

describe("updateContactSchema", () => {
  it("rejects an empty body", () => {
    expect(updateContactSchema.validate({}).error).toBeDefined();
  });

  it("accepts a partial update", () => {
    expect(updateContactSchema.validate({ smsOptIn: true }).error).toBeUndefined();
  });

  it.each(["role", "phone"])("does not let %s be blanked to an empty string", (field) => {
    expect(updateContactSchema.validate({ [field]: "" }).error).toBeDefined();
  });

  it("lets notes be cleared with an empty string", () => {
    expect(updateContactSchema.validate({ notes: "" }).error).toBeUndefined();
  });

  it("does not accept fields that are not editable (idNumber, firstName)", () => {
    expect(updateContactSchema.validate({ idNumber: VALID_ID }).error).toBeDefined();
    expect(updateContactSchema.validate({ firstName: "x" }).error).toBeDefined();
  });
});

describe("listContactsQuerySchema", () => {
  it("applies page=1 and pageSize=20 defaults", () => {
    const { value } = listContactsQuerySchema.validate({});
    expect(value).toEqual({ page: 1, pageSize: 20 });
  });

  it("coerces query-string values to their real types", () => {
    const { value, error } = listContactsQuerySchema.validate({
      includeInactive: "true",
      page: "2",
      pageSize: "50",
      updatedYear: "2026",
    });
    expect(error).toBeUndefined();
    expect(value).toMatchObject({ includeInactive: true, page: 2, pageSize: 50, updatedYear: 2026 });
  });

  it("treats an empty search string as no search", () => {
    const { value } = listContactsQuerySchema.validate({ search: "" });
    expect(value.search).toBeUndefined();
  });

  it.each([
    ["page below 1", { page: 0 }],
    ["pageSize above 100", { pageSize: 101 }],
    ["updatedYear below 2000", { updatedYear: 1999 }],
    ["updatedYear above 2100", { updatedYear: 2101 }],
    ["a non-integer page", { page: 1.5 }],
  ])("rejects %s", (_label, query) => {
    expect(listContactsQuerySchema.validate(query).error).toBeDefined();
  });
});

describe("addSupportedBodySchema / updateSupportedBodyDomainsSchema", () => {
  it("requires supportedBodyId and at least one domain when adding a link", () => {
    expect(addSupportedBodySchema.validate({ supportedBodyId: "b", domainIds: ["d"] }).error).toBeUndefined();
    expect(addSupportedBodySchema.validate({ domainIds: ["d"] }).error).toBeDefined();
    expect(addSupportedBodySchema.validate({ supportedBodyId: "b", domainIds: [] }).error).toBeDefined();
  });

  it("rejects emptying a link's domain subset", () => {
    expect(updateSupportedBodyDomainsSchema.validate({ domainIds: [] }).error).toBeDefined();
    expect(updateSupportedBodyDomainsSchema.validate({ domainIds: ["d"] }).error).toBeUndefined();
  });
});

describe("deactivateContactSchema", () => {
  it("requires both source and date", () => {
    expect(deactivateContactSchema.validate({ source: "PHONE", date: "2026-10-01" }).error).toBeUndefined();
    expect(deactivateContactSchema.validate({ source: "PHONE" }).error).toBeDefined();
    expect(deactivateContactSchema.validate({ date: "2026-10-01" }).error).toBeDefined();
  });

  it("rejects an unknown source", () => {
    expect(deactivateContactSchema.validate({ source: "FAX", date: "2026-10-01" }).error).toBeDefined();
  });

  it("rejects an unparsable date", () => {
    expect(deactivateContactSchema.validate({ source: "EMAIL", date: "not-a-date" }).error).toBeDefined();
  });
});
