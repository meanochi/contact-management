import { ConflictException, Logger, NotFoundException } from "@nestjs/common";
import { SupportedBodiesService } from "./supported-bodies.service";
import { dbMock, uniqueViolation } from "../test-utils/db-mock";

jest.mock("@contact-management/db", () => jest.requireActual("../test-utils/db-mock").mockedDbModule());

const bodyRow = { id: "b1", name: "עמותה", companyId: "580", isActive: true };
const selectFromBody = /^select .* from "SupportedBody"/;

describe("SupportedBodiesService", () => {
  let service: SupportedBodiesService;

  beforeEach(() => {
    dbMock.reset();
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    service = new SupportedBodiesService();
  });
  afterEach(() => jest.restoreAllMocks());

  describe("list", () => {
    beforeEach(() =>
      dbMock.queue([bodyRow], [{ total: 1 }], [{ supportedBodyId: "b1", domainId: "d1" }]),
    );

    it("applies no filter when the query has none", async () => {
      await service.list({ page: 1, pageSize: 20 });
      const [page] = dbMock.matching(selectFromBody);
      expect(page?.sql).not.toContain(" where ");
    });

    it("searches name and companyId case-insensitively, escaping LIKE wildcards", async () => {
      await service.list({ page: 1, pageSize: 20, search: "58_" });
      const [page] = dbMock.matching(selectFromBody);
      expect(page?.sql).toContain('"SupportedBody"."name" ilike $1 or "SupportedBody"."company_id" ilike $2');
      expect(page?.params.slice(0, 2)).toEqual(["%58\\_%", "%58\\_%"]);
    });

    it("keeps isActive=false as a real filter instead of treating it as unset", async () => {
      await service.list({ page: 1, pageSize: 20, isActive: false });
      const [page] = dbMock.matching(selectFromBody);
      expect(page?.sql).toContain('"SupportedBody"."isActive" = $1');
      expect(page?.params[0]).toBe(false);
    });

    it("filters by domain through the join table", async () => {
      await service.list({ page: 1, pageSize: 20, domainId: "d1" });
      const [page] = dbMock.matching(selectFromBody);
      expect(page?.sql).toContain('from "SupportedBodyOnDomain"');
      expect(page?.params).toContain("d1");
    });

    it("maps rows to DTOs with domainIds, loading all domains in one query", async () => {
      const result = await service.list({ page: 1, pageSize: 20 });
      expect(result.items).toEqual([{ ...bodyRow, domainIds: ["d1"] }]);
      expect(dbMock.matching(/from "SupportedBodyOnDomain"/)).toHaveLength(1);
    });
  });

  describe("create", () => {
    const input = { name: "עמותה", companyId: "580", domainIds: ["d1", "d2"] };

    it("creates the body and its domain rows together", async () => {
      dbMock.queue([bodyRow], []);

      const dto = await service.create(input);

      const [, domainInsert] = dbMock.matching(/^insert/);
      expect(domainInsert?.sql).toContain('insert into "SupportedBodyOnDomain"');
      expect(domainInsert?.params.filter((p) => typeof p === "string")).toEqual(["b1", "d1", "b1", "d2"]);
      expect(dto.domainIds).toEqual(["d1", "d2"]);
    });

    it("translates a duplicate companyId into Conflict that names the existing body", async () => {
      dbMock.queue(uniqueViolation(), [{ id: "old", name: "קיים" }], uniqueViolation(), [{ id: "old", name: "קיים" }]);

      await expect(service.create(input)).rejects.toBeInstanceOf(ConflictException);
      await expect(service.create(input)).rejects.toMatchObject({
        response: { code: "CONFLICT", details: { id: "old", name: "קיים" } },
      });
    });

    it("recognises the violation even when the driver error is wrapped in a query error", async () => {
      const wrapped = Object.assign(new Error("Failed query"), { cause: uniqueViolation() });
      dbMock.queue(wrapped, []);
      await expect(service.create(input)).rejects.toBeInstanceOf(ConflictException);
    });

    it("lets unexpected errors through untranslated", async () => {
      const boom = new Error("db down");
      dbMock.queue(boom);
      await expect(service.create(input)).rejects.toBe(boom);
    });
  });

  describe("update", () => {
    it("updates only the fields sent and leaves domains alone when domainIds is omitted", async () => {
      dbMock.queue([bodyRow], [{ supportedBodyId: "b1", domainId: "d1" }]);

      await service.update("b1", { isActive: false });

      const [update] = dbMock.matching(/^update "SupportedBody"/);
      expect(update?.sql).toContain('"isActive" = $');
      expect(update?.sql).not.toContain('"name" = ');
      expect(dbMock.matching(/^delete/)).toHaveLength(0);
    });

    it("still works for a domainIds-only patch, where there is no scalar field to set", async () => {
      dbMock.queue([bodyRow], [], [], [], [{ supportedBodyId: "b1", domainId: "d1" }]);
      await expect(service.update("b1", { domainIds: ["d1"] })).resolves.toMatchObject({ domainIds: ["d1"] });
    });

    it("replaces the body's domains and removes contacts' subset entries for dropped domains", async () => {
      dbMock.queue([bodyRow], [], [], [], [{ supportedBodyId: "b1", domainId: "d1" }]);

      await service.update("b1", { domainIds: ["d1"] });

      const [domainDelete, subsetDelete] = dbMock.matching(/^delete/);
      expect(domainDelete?.sql).toContain('delete from "SupportedBodyOnDomain"');
      expect(domainDelete?.params).toEqual(["b1"]);
      // Regression: removing a domain used to leave contacts' subsets orphaned.
      expect(subsetDelete?.sql).toContain('delete from "ContactOnSupportedBodyDomain"');
      expect(subsetDelete?.sql).toContain("not in");
      expect(subsetDelete?.params).toEqual(["b1", "d1"]);
    });

    it("translates a companyId collision into Conflict", async () => {
      dbMock.queue(uniqueViolation(), [{ id: "other", name: "אחר" }]);
      await expect(service.update("b1", { companyId: "999" })).rejects.toBeInstanceOf(ConflictException);
    });

    it("throws NotFound for a missing body", async () => {
      dbMock.queue([]);
      await expect(service.update("nope", { name: "x" })).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
