import { createSupportedBodySchema, listSupportedBodiesQuerySchema, updateSupportedBodySchema } from "./schema";

const validCreate = () => ({ name: "עמותת דוגמה", companyId: "580123456", domainIds: ["d1"] });

describe("createSupportedBodySchema", () => {
  it("accepts a valid body", () => {
    expect(createSupportedBodySchema.validate(validCreate()).error).toBeUndefined();
  });

  it.each(["name", "companyId"])("rejects a blank %s", (field) => {
    expect(createSupportedBodySchema.validate({ ...validCreate(), [field]: "  " }).error).toBeDefined();
  });

  it("rejects an empty domainIds list", () => {
    expect(createSupportedBodySchema.validate({ ...validCreate(), domainIds: [] }).error).toBeDefined();
  });

  it("rejects over-long name (200) and companyId (50)", () => {
    expect(createSupportedBodySchema.validate({ ...validCreate(), name: "x".repeat(201) }).error).toBeDefined();
    expect(createSupportedBodySchema.validate({ ...validCreate(), companyId: "1".repeat(51) }).error).toBeDefined();
  });
});

describe("updateSupportedBodySchema", () => {
  it("rejects an empty body", () => {
    expect(updateSupportedBodySchema.validate({}).error).toBeDefined();
  });

  it("accepts a deactivate-only patch", () => {
    expect(updateSupportedBodySchema.validate({ isActive: false }).error).toBeUndefined();
  });

  it("does not let domainIds be emptied", () => {
    expect(updateSupportedBodySchema.validate({ domainIds: [] }).error).toBeDefined();
  });
});

describe("listSupportedBodiesQuerySchema", () => {
  it("applies pagination defaults", () => {
    expect(listSupportedBodiesQuerySchema.validate({}).value).toEqual({ page: 1, pageSize: 20 });
  });

  it("coerces isActive from the query string, including 'false'", () => {
    expect(listSupportedBodiesQuerySchema.validate({ isActive: "false" }).value.isActive).toBe(false);
  });

  it("rejects pageSize above 100", () => {
    expect(listSupportedBodiesQuerySchema.validate({ pageSize: 101 }).error).toBeDefined();
  });
});
