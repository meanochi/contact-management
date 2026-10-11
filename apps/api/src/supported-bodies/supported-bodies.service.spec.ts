import { ConflictException, NotFoundException } from "@nestjs/common";
import { prisma } from "@contact-management/db";
import { SupportedBodiesService } from "./supported-bodies.service";
import { knownError, type DbMock } from "../test-utils/db-mock";

jest.mock("@contact-management/db", () => jest.requireActual("../test-utils/db-mock").createDbModuleMock());

const db = prisma as unknown as DbMock;

describe("SupportedBodiesService", () => {
  let service: SupportedBodiesService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new SupportedBodiesService();
  });

  describe("list", () => {
    beforeEach(() => {
      db["supportedBody"]!["findMany"]!.mockResolvedValue([
        { id: "b1", name: "עמותה", companyId: "580", isActive: true, domains: [{ domainId: "d1" }] },
      ]);
      db["supportedBody"]!["count"]!.mockResolvedValue(1);
    });

    const lastWhere = () => db["supportedBody"]!["findMany"]!.mock.calls[0]![0].where;

    it("applies no filter when the query has none", async () => {
      await service.list({ page: 1, pageSize: 20 });
      expect(lastWhere()).toEqual({});
    });

    it("searches name and companyId case-insensitively", async () => {
      await service.list({ page: 1, pageSize: 20, search: "58" });
      expect(lastWhere().OR).toEqual([
        { name: { contains: "58", mode: "insensitive" } },
        { companyId: { contains: "58", mode: "insensitive" } },
      ]);
    });

    it("keeps isActive=false as a real filter instead of treating it as unset", async () => {
      await service.list({ page: 1, pageSize: 20, isActive: false });
      expect(lastWhere()).toEqual({ isActive: false });
    });

    it("maps rows to DTOs with domainIds", async () => {
      const result = await service.list({ page: 1, pageSize: 20 });
      expect(result.items).toEqual([{ id: "b1", name: "עמותה", companyId: "580", isActive: true, domainIds: ["d1"] }]);
    });
  });

  describe("create", () => {
    const input = { name: "עמותה", companyId: "580", domainIds: ["d1", "d2"] };

    it("creates the body and its domain rows together", async () => {
      db["supportedBody"]!["create"]!.mockResolvedValue({ id: "b1", name: "עמותה", companyId: "580", isActive: true });

      const dto = await service.create(input);

      expect(db["supportedBodyOnDomain"]!["createMany"]).toHaveBeenCalledWith({
        data: [
          { supportedBodyId: "b1", domainId: "d1" },
          { supportedBodyId: "b1", domainId: "d2" },
        ],
      });
      expect(dto.domainIds).toEqual(["d1", "d2"]);
    });

    it("translates a duplicate companyId into Conflict that names the existing body", async () => {
      db["supportedBody"]!["create"]!.mockRejectedValue(knownError("P2002"));
      db["supportedBody"]!["findUnique"]!.mockResolvedValue({ id: "old", name: "קיים" });

      const attempt = service.create(input);

      await expect(attempt).rejects.toBeInstanceOf(ConflictException);
      await expect(service.create(input)).rejects.toMatchObject({
        response: { code: "CONFLICT", details: { id: "old", name: "קיים" } },
      });
    });

    it("lets unexpected errors through untranslated", async () => {
      const boom = new Error("db down");
      db["supportedBody"]!["create"]!.mockRejectedValue(boom);
      await expect(service.create(input)).rejects.toBe(boom);
    });
  });

  describe("update", () => {
    beforeEach(() => {
      db["supportedBody"]!["update"]!.mockResolvedValue({ id: "b1", name: "עמותה", companyId: "580", isActive: true });
      db["supportedBodyOnDomain"]!["findMany"]!.mockResolvedValue([{ domainId: "d1" }]);
    });

    it("updates only the fields sent and leaves domains alone when domainIds is omitted", async () => {
      await service.update("b1", { isActive: false });

      expect(db["supportedBody"]!["update"]!.mock.calls[0]![0].data).toEqual({ isActive: false });
      expect(db["supportedBodyOnDomain"]!["deleteMany"]).not.toHaveBeenCalled();
      expect(db["contactOnSupportedBodyDomain"]!["deleteMany"]).not.toHaveBeenCalled();
    });

    it("replaces the body's domains and removes contacts' subset entries for dropped domains", async () => {
      await service.update("b1", { domainIds: ["d1"] });

      expect(db["supportedBodyOnDomain"]!["deleteMany"]).toHaveBeenCalledWith({ where: { supportedBodyId: "b1" } });
      expect(db["supportedBodyOnDomain"]!["createMany"]).toHaveBeenCalledWith({
        data: [{ supportedBodyId: "b1", domainId: "d1" }],
      });
      // Regression: removing a domain used to leave contacts' subsets orphaned.
      expect(db["contactOnSupportedBodyDomain"]!["deleteMany"]).toHaveBeenCalledWith({
        where: { supportedBodyId: "b1", domainId: { notIn: ["d1"] } },
      });
    });

    it("translates a companyId collision into Conflict", async () => {
      db["supportedBody"]!["update"]!.mockRejectedValue(knownError("P2002"));
      db["supportedBody"]!["findUnique"]!.mockResolvedValue({ id: "other", name: "אחר" });
      await expect(service.update("b1", { companyId: "999" })).rejects.toBeInstanceOf(ConflictException);
    });

    it("throws NotFound for a missing body", async () => {
      db["supportedBody"]!["update"]!.mockRejectedValue(knownError("P2025"));
      await expect(service.update("nope", { name: "x" })).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
