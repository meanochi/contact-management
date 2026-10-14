import { createSupportedBodySchema, listSupportedBodiesQuerySchema, updateSupportedBodySchema } from "./schema";

const validCreate = () => ({ name: "עמותת דוגמה", companyId: "580123456", domainIds: ["d1"] });

describe("createSupportedBodySchema", () => {
  it("accepts a valid body", () => {
    expect(createSupportedBodySchema.safeParse(validCreate()).success).toBe(true);
  });

  it.each(["name", "companyId"])("rejects a blank %s", (field) => {
    expect(createSupportedBodySchema.safeParse({ ...validCreate(), [field]: "  " }).success).toBe(false);
  });

  it("rejects an empty domainIds list", () => {
    expect(createSupportedBodySchema.safeParse({ ...validCreate(), domainIds: [] }).success).toBe(false);
  });

  it("rejects over-long name (200) and companyId (50)", () => {
    expect(createSupportedBodySchema.safeParse({ ...validCreate(), name: "x".repeat(201) }).success).toBe(false);
    expect(createSupportedBodySchema.safeParse({ ...validCreate(), companyId: "1".repeat(51) }).success).toBe(false);
  });
});

describe("updateSupportedBodySchema", () => {
  it("rejects an empty body", () => {
    expect(updateSupportedBodySchema.safeParse({}).success).toBe(false);
  });

  it("accepts a deactivate-only patch", () => {
    expect(updateSupportedBodySchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it("does not let domainIds be emptied", () => {
    expect(updateSupportedBodySchema.safeParse({ domainIds: [] }).success).toBe(false);
  });
});

describe("listSupportedBodiesQuerySchema", () => {
  it("applies pagination defaults", () => {
    const result = listSupportedBodiesQuerySchema.safeParse({});
    expect(result.success && result.data).toEqual({ page: 1, pageSize: 20 });
  });

  it("coerces isActive from the query string, including 'false'", () => {
    const result = listSupportedBodiesQuerySchema.safeParse({ isActive: "false" });
    expect(result.success && result.data.isActive).toBe(false);
  });

  it("rejects pageSize above 100", () => {
    expect(listSupportedBodiesQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });
});
