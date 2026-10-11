import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { prisma } from "@contact-management/db";
import type { CreateContactInput, ListContactsQuery } from "@contact-management/shared-schemas/contacts";
import { ContactsService } from "./contacts.service";
import { knownError, type DbMock } from "../test-utils/db-mock";

jest.mock("@contact-management/db", () => jest.requireActual("../test-utils/db-mock").createDbModuleMock());

const db = prisma as unknown as DbMock;

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "c1",
  firstName: "רחל",
  lastName: "כהן",
  idNumber: "000000018",
  role: "מנהלת",
  phone: "0500000000",
  emails: ["r@example.com"],
  notes: null,
  emailOptIn: true,
  smsOptIn: false,
  status: "ACTIVE",
  supportedBodies: [{ supportedBodyId: "b1", domains: [{ domainId: "d1" }] }],
  ...overrides,
});

const query = (overrides: Partial<ListContactsQuery> = {}): ListContactsQuery => ({
  page: 1,
  pageSize: 20,
  ...overrides,
});

const createInput = (overrides: Partial<CreateContactInput> = {}): CreateContactInput => ({
  firstName: "רחל",
  lastName: "כהן",
  idNumber: "000000018",
  role: "מנהלת",
  phone: "0500000000",
  emails: ["r@example.com"],
  emailOptIn: true,
  smsOptIn: false,
  supportedBodyId: "b1",
  domainIds: ["d1", "d2"],
  ...overrides,
});

describe("ContactsService", () => {
  let service: ContactsService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ContactsService();
  });

  // ---- Soft-delete: high-priority area (expertise-testing §8) -------------

  describe("list — soft-delete filtering", () => {
    beforeEach(() => {
      db["contact"]!["findMany"]!.mockResolvedValue([row()]);
      db["contact"]!["count"]!.mockResolvedValue(1);
    });

    const lastWhere = () => db["contact"]!["findMany"]!.mock.calls[0]![0].where;

    it("returns only ACTIVE contacts by default", async () => {
      await service.list(query());
      expect(lastWhere()).toMatchObject({ status: "ACTIVE" });
    });

    it("drops the status filter when includeInactive is set, so inactive contacts stay retrievable", async () => {
      await service.list(query({ includeInactive: true }));
      expect(lastWhere()).not.toHaveProperty("status");
    });

    it("applies the same where to the page query and the total count", async () => {
      await service.list(query({ search: "כהן" }));
      expect(db["contact"]!["count"]!.mock.calls[0]![0].where).toEqual(lastWhere());
    });
  });

  describe("list — filters and pagination", () => {
    beforeEach(() => {
      db["contact"]!["findMany"]!.mockResolvedValue([]);
      db["contact"]!["count"]!.mockResolvedValue(0);
    });

    const lastWhere = () => db["contact"]!["findMany"]!.mock.calls[0]![0].where;

    it("searches first and last name case-insensitively", async () => {
      await service.list(query({ search: "cohen" }));
      expect(lastWhere().OR).toEqual([
        { firstName: { contains: "cohen", mode: "insensitive" } },
        { lastName: { contains: "cohen", mode: "insensitive" } },
      ]);
    });

    it("requires supportedBodyId and domainId to match the same linked body", async () => {
      await service.list(query({ supportedBodyId: "b1", domainId: "d1" }));
      expect(lastWhere().supportedBodies).toEqual({
        some: { supportedBodyId: "b1", domains: { some: { domainId: "d1" } } },
      });
    });

    it("filters by domain alone through the contact's own domain subset", async () => {
      await service.list(query({ domainId: "d1" }));
      expect(lastWhere().supportedBodies).toEqual({ some: { domains: { some: { domainId: "d1" } } } });
    });

    it("bounds updatedYear to [Jan 1 of the year, Jan 1 of the next) in UTC", async () => {
      await service.list(query({ updatedYear: 2026 }));
      expect(lastWhere().updatedAt).toEqual({
        gte: new Date(Date.UTC(2026, 0, 1)),
        lt: new Date(Date.UTC(2027, 0, 1)),
      });
    });

    it("computes skip/take from page and pageSize", async () => {
      await service.list(query({ page: 3, pageSize: 10 }));
      expect(db["contact"]!["findMany"]!.mock.calls[0]![0]).toMatchObject({ skip: 20, take: 10 });
    });

    it("maps rows to DTOs and echoes paging info", async () => {
      db["contact"]!["findMany"]!.mockResolvedValue([row()]);
      db["contact"]!["count"]!.mockResolvedValue(41);
      const result = await service.list(query({ page: 2 }));
      expect(result).toMatchObject({ total: 41, page: 2, pageSize: 20 });
      expect(result.items[0]).toMatchObject({
        id: "c1",
        supportedBodyLinks: [{ supportedBodyId: "b1", domainIds: ["d1"] }],
      });
    });
  });

  describe("deactivate / activate", () => {
    it("sets INACTIVE with the documentation fields instead of deleting the row", async () => {
      db["contact"]!["update"]!.mockResolvedValue(row({ status: "INACTIVE" }));
      const before = Date.now();

      const dto = await service.deactivate("c1", "PHONE", "2026-09-30");

      const args = db["contact"]!["update"]!.mock.calls[0]![0];
      expect(args.where).toEqual({ id: "c1" });
      expect(args.data).toMatchObject({
        status: "INACTIVE",
        externalRequestSource: "PHONE",
        externalRequestDate: new Date("2026-09-30"),
      });
      expect(args.data.deactivatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(dto.status).toBe("INACTIVE");
    });

    it("never issues a real delete on the contact", () => {
      expect(db["contact"]).not.toHaveProperty("delete");
    });

    it("throws NotFound when deactivating a missing contact", async () => {
      db["contact"]!["update"]!.mockRejectedValue(knownError("P2025"));
      await expect(service.deactivate("nope", "EMAIL", "2026-09-30")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rethrows unexpected errors from deactivate unchanged", async () => {
      const boom = new Error("db down");
      db["contact"]!["update"]!.mockRejectedValue(boom);
      await expect(service.deactivate("c1", "EMAIL", "2026-09-30")).rejects.toBe(boom);
    });

    it("reactivation flips status to ACTIVE only, keeping the deactivation history", async () => {
      db["contact"]!["update"]!.mockResolvedValue(row());
      await service.activate("c1");
      expect(db["contact"]!["update"]!.mock.calls[0]![0].data).toEqual({ status: "ACTIVE" });
    });

    it("throws NotFound when activating a missing contact", async () => {
      db["contact"]!["update"]!.mockRejectedValue(knownError("P2025"));
      await expect(service.activate("nope")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---- Domain subset integrity -------------------------------------------

  describe("create", () => {
    beforeEach(() => {
      db["supportedBodyOnDomain"]!["findMany"]!.mockResolvedValue([{ domainId: "d1" }, { domainId: "d2" }]);
      db["contact"]!["create"]!.mockResolvedValue(row());
    });

    it("rejects domains that do not belong to the chosen body, before writing anything", async () => {
      const attempt = service.create(createInput({ domainIds: ["d1", "dX"] }));
      await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.create(createInput({ domainIds: ["dX"] }))).rejects.toMatchObject({
        response: { code: "VALIDATION_ERROR", details: [{ field: "domainIds" }] },
      });
      expect(db["contact"]!["create"]).not.toHaveBeenCalled();
    });

    it("creates the contact, its body link and one domain row per domain together", async () => {
      const dto = await service.create(createInput());

      expect(db["contactOnSupportedBody"]!["create"]).toHaveBeenCalledWith({
        data: { contactId: "c1", supportedBodyId: "b1" },
      });
      expect(db["contactOnSupportedBodyDomain"]!["createMany"]).toHaveBeenCalledWith({
        data: [
          { contactId: "c1", supportedBodyId: "b1", domainId: "d1" },
          { contactId: "c1", supportedBodyId: "b1", domainId: "d2" },
        ],
      });
      expect(dto.supportedBodyLinks).toEqual([{ supportedBodyId: "b1", domainIds: ["d1", "d2"] }]);
    });

    it("stores blank notes as null and omits notes when not sent", async () => {
      await service.create(createInput({ notes: "" }));
      expect(db["contact"]!["create"]!.mock.calls[0]![0].data.notes).toBeNull();

      await service.create(createInput());
      expect(db["contact"]!["create"]!.mock.calls[1]![0].data).not.toHaveProperty("notes");
    });
  });

  describe("update", () => {
    it("writes only the fields that were sent", async () => {
      db["contact"]!["update"]!.mockResolvedValue(row());
      await service.update("c1", { smsOptIn: true });
      expect(db["contact"]!["update"]!.mock.calls[0]![0].data).toEqual({ smsOptIn: true });
    });

    it("turns a blank notes value into null so notes can be cleared", async () => {
      db["contact"]!["update"]!.mockResolvedValue(row());
      await service.update("c1", { notes: "" });
      expect(db["contact"]!["update"]!.mock.calls[0]![0].data).toEqual({ notes: null });
    });

    it("throws NotFound for a missing contact", async () => {
      db["contact"]!["update"]!.mockRejectedValue(knownError("P2025"));
      await expect(service.update("nope", { smsOptIn: true })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---- Supported-body links ----------------------------------------------

  describe("addSupportedBody", () => {
    beforeEach(() => {
      db["supportedBodyOnDomain"]!["findMany"]!.mockResolvedValue([{ domainId: "d1" }]);
      db["contact"]!["findUnique"]!.mockResolvedValue(row());
    });

    it("rejects domains outside the body", async () => {
      await expect(service.addSupportedBody("c1", "b2", ["dX"])).rejects.toBeInstanceOf(BadRequestException);
      expect(db["contactOnSupportedBody"]!["create"]).not.toHaveBeenCalled();
    });

    it("returns Conflict when the contact is already linked to that body", async () => {
      db["contactOnSupportedBody"]!["create"]!.mockRejectedValue(knownError("P2002"));
      await expect(service.addSupportedBody("c1", "b2", ["d1"])).rejects.toBeInstanceOf(ConflictException);
    });

    it("links the body and its domain subset, then returns the refreshed contact", async () => {
      const dto = await service.addSupportedBody("c1", "b2", ["d1"]);
      expect(db["contactOnSupportedBodyDomain"]!["createMany"]).toHaveBeenCalledWith({
        data: [{ contactId: "c1", supportedBodyId: "b2", domainId: "d1" }],
      });
      expect(dto.id).toBe("c1");
    });

    it("throws NotFound when the contact does not exist after linking", async () => {
      db["contact"]!["findUnique"]!.mockResolvedValue(null);
      await expect(service.addSupportedBody("ghost", "b2", ["d1"])).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("updateSupportedBodyDomains", () => {
    it("throws NotFound when the contact is not linked to that body", async () => {
      db["contactOnSupportedBody"]!["findUnique"]!.mockResolvedValue(null);
      await expect(service.updateSupportedBodyDomains("c1", "b1", ["d1"])).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects domains outside the body without touching the existing subset", async () => {
      db["contactOnSupportedBody"]!["findUnique"]!.mockResolvedValue({});
      db["supportedBodyOnDomain"]!["findMany"]!.mockResolvedValue([{ domainId: "d1" }]);
      await expect(service.updateSupportedBodyDomains("c1", "b1", ["dX"])).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(db["contactOnSupportedBodyDomain"]!["deleteMany"]).not.toHaveBeenCalled();
    });

    it("replaces the subset (delete then recreate) for that link only", async () => {
      db["contactOnSupportedBody"]!["findUnique"]!.mockResolvedValue({});
      db["supportedBodyOnDomain"]!["findMany"]!.mockResolvedValue([{ domainId: "d1" }, { domainId: "d2" }]);
      db["contact"]!["findUnique"]!.mockResolvedValue(row());

      await service.updateSupportedBodyDomains("c1", "b1", ["d2"]);

      expect(db["contactOnSupportedBodyDomain"]!["deleteMany"]).toHaveBeenCalledWith({
        where: { contactId: "c1", supportedBodyId: "b1" },
      });
      expect(db["contactOnSupportedBodyDomain"]!["createMany"]).toHaveBeenCalledWith({
        data: [{ contactId: "c1", supportedBodyId: "b1", domainId: "d2" }],
      });
    });
  });

  describe("removeSupportedBody", () => {
    it("refuses to remove the last remaining link", async () => {
      db["contactOnSupportedBody"]!["count"]!.mockResolvedValue(1);
      await expect(service.removeSupportedBody("c1", "b1")).rejects.toBeInstanceOf(ConflictException);
      expect(db["contactOnSupportedBody"]!["delete"]).not.toHaveBeenCalled();
    });

    it("throws NotFound when the link does not exist", async () => {
      db["contactOnSupportedBody"]!["count"]!.mockResolvedValue(2);
      db["contactOnSupportedBody"]!["findUnique"]!.mockResolvedValue(null);
      await expect(service.removeSupportedBody("c1", "bX")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("deletes the link together with its domain subset", async () => {
      db["contactOnSupportedBody"]!["count"]!.mockResolvedValue(2);
      db["contactOnSupportedBody"]!["findUnique"]!.mockResolvedValue({});
      db["contact"]!["findUnique"]!.mockResolvedValue(row());

      await service.removeSupportedBody("c1", "b1");

      expect(db["contactOnSupportedBodyDomain"]!["deleteMany"]).toHaveBeenCalledWith({
        where: { contactId: "c1", supportedBodyId: "b1" },
      });
      expect(db["contactOnSupportedBody"]!["delete"]).toHaveBeenCalledWith({
        where: { contactId_supportedBodyId: { contactId: "c1", supportedBodyId: "b1" } },
      });
    });
  });
});
