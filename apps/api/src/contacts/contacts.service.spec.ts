import { BadRequestException, ConflictException, Logger, NotFoundException } from "@nestjs/common";
import type { CreateContactInput, ListContactsQuery } from "@contact-management/shared-schemas/contacts";
import { ContactsService } from "./contacts.service";
import { dbMock, uniqueViolation } from "../test-utils/db-mock";

jest.mock("@contact-management/db", () => jest.requireActual("../test-utils/db-mock").mockedDbModule());

// Plain columns of a Contact row, as the service's projection returns them.
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
  ...overrides,
});

// One row of the link query: contact -> body (-> domain of the contact's subset).
const linkRow = (supportedBodyId: string, domainId: string | null, contactId = "c1") => ({
  contactId,
  supportedBodyId,
  domainId,
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

const selectFromContact = /^select .* from "Contact"/;
const updateContact = /^update "Contact"/;

describe("ContactsService", () => {
  let service: ContactsService;

  beforeEach(() => {
    dbMock.reset();
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    service = new ContactsService();
  });
  afterEach(() => jest.restoreAllMocks());

  // ---- Soft-delete: high-priority area (expertise-testing §8) -------------

  describe("list — soft-delete filtering", () => {
    beforeEach(() => dbMock.queue([row()], [{ total: 1 }], [linkRow("b1", "d1")]));

    it("returns only ACTIVE contacts by default", async () => {
      await service.list(query());
      const [page] = dbMock.matching(selectFromContact);
      expect(page?.sql).toContain('"Contact"."status" = $1');
      expect(page?.params[0]).toBe("ACTIVE");
    });

    it("drops the status filter when includeInactive is set, so inactive contacts stay retrievable", async () => {
      await service.list(query({ includeInactive: true }));
      const [page] = dbMock.matching(selectFromContact);
      expect(page?.sql).not.toContain('"Contact"."status"');
    });

    it("applies the same filter to the page query and the total count", async () => {
      await service.list(query({ search: "כהן" }));
      const [page, total] = dbMock.matching(selectFromContact);
      expect(total?.sql).toContain("count(");
      expect(page?.sql.match(/where (.*?)( order by|$)/)?.[1]).toBe(total?.sql.match(/where (.*)$/)?.[1]);
      expect(page?.params.slice(0, 3)).toEqual(total?.params.slice(0, 3));
    });
  });

  describe("list — filters and pagination", () => {
    beforeEach(() => dbMock.queue([], [{ total: 0 }]));

    it("searches first and last name case-insensitively, escaping LIKE wildcards", async () => {
      await service.list(query({ search: "50%_x" }));
      const [page] = dbMock.matching(selectFromContact);
      expect(page?.sql).toContain('"Contact"."first_name" ilike $2 or "Contact"."last_name" ilike $3');
      expect(page?.params.slice(1, 3)).toEqual(["%50\\%\\_x%", "%50\\%\\_x%"]);
    });

    it("requires supportedBodyId and domainId to match the same linked body", async () => {
      await service.list(query({ supportedBodyId: "b1", domainId: "d1" }));
      const [page] = dbMock.matching(selectFromContact);
      expect(page?.sql).toContain('from "ContactOnSupportedBody"');
      expect(page?.sql).toContain('from "ContactOnSupportedBodyDomain"');
      expect(page?.params).toEqual(expect.arrayContaining(["b1", "d1"]));
    });

    it("filters by domain alone through the contact's own domain subset, not the body's domains", async () => {
      await service.list(query({ domainId: "d1" }));
      const [page] = dbMock.matching(selectFromContact);
      expect(page?.sql).toContain('from "ContactOnSupportedBodyDomain"');
      expect(page?.sql).not.toContain('"SupportedBodyOnDomain"');
      expect(page?.params).toContain("d1");
    });

    it("bounds updatedYear to [Jan 1 of the year, Jan 1 of the next) in UTC", async () => {
      await service.list(query({ updatedYear: 2026 }));
      const [page] = dbMock.matching(selectFromContact);
      expect(page?.sql).toContain('"Contact"."updatedAt" >= $2 and "Contact"."updatedAt" < $3');
      // Drizzle serialises timestamps to ISO strings for the driver.
      expect(page?.params.slice(1, 3)).toEqual(["2026-01-01T00:00:00.000Z", "2027-01-01T00:00:00.000Z"]);
    });

    it("computes limit/offset from page and pageSize", async () => {
      await service.list(query({ page: 3, pageSize: 10 }));
      const [page] = dbMock.matching(selectFromContact);
      expect(page?.sql).toMatch(/limit \$\d+ offset \$\d+$/);
      expect(page?.params.slice(-2)).toEqual([10, 20]);
    });

    it("orders by last name then first name", async () => {
      await service.list(query());
      const [page] = dbMock.matching(selectFromContact);
      expect(page?.sql).toContain('order by "Contact"."last_name" asc, "Contact"."first_name" asc');
    });
  });

  describe("list — result mapping", () => {
    it("maps rows to DTOs with their links and echoes paging info", async () => {
      dbMock.queue([row(), row({ id: "c2" })], [{ total: 41 }], [linkRow("b1", "d1"), linkRow("b1", "d2"), linkRow("b2", null, "c2")]);

      const result = await service.list(query({ page: 2 }));

      expect(result).toMatchObject({ total: 41, page: 2, pageSize: 20 });
      expect(result.items[0]).toMatchObject({
        id: "c1",
        supportedBodyLinks: [{ supportedBodyId: "b1", domainIds: ["d1", "d2"] }],
      });
      // A link with an empty domain subset (left join found no domain row) stays a link.
      expect(result.items[1]?.supportedBodyLinks).toEqual([{ supportedBodyId: "b2", domainIds: [] }]);
    });

    it("loads the links of all contacts in a single query, not one per contact", async () => {
      dbMock.queue([row(), row({ id: "c2" })], [{ total: 2 }], []);
      await service.list(query());
      expect(dbMock.matching(/from "ContactOnSupportedBody"/)).toHaveLength(1);
    });

    it("skips the link query entirely when the page is empty", async () => {
      dbMock.queue([], [{ total: 0 }]);
      const result = await service.list(query());
      expect(result.items).toEqual([]);
      expect(dbMock.matching(/from "ContactOnSupportedBody"/)).toHaveLength(0);
    });
  });

  describe("deactivate / activate", () => {
    it("sets INACTIVE with the documentation fields instead of deleting the row", async () => {
      dbMock.queue([{ id: "c1" }], [row({ status: "INACTIVE" })], [linkRow("b1", "d1")]);
      const before = Date.now();

      const dto = await service.deactivate("c1", "PHONE", "2026-09-30");

      const [update] = dbMock.matching(updateContact);
      expect(update?.sql).toContain('"status" = $1');
      expect(update?.params).toEqual(
        expect.arrayContaining(["INACTIVE", "PHONE", "2026-09-30T00:00:00.000Z", "c1"]),
      );
      // deactivatedAt is "now", i.e. not the user-entered request date.
      const timestamps = (update?.params ?? []).filter(
        (p): p is string => typeof p === "string" && /^\d{4}-\d\d-\d\dT/.test(p),
      );
      expect(timestamps.some((t) => Date.parse(t) >= before)).toBe(true);
      expect(dto.status).toBe("INACTIVE");
    });

    it("never issues a real DELETE against the Contact table", async () => {
      dbMock.queue([{ id: "c1" }], [row()], [], [{ id: "c1" }], [row()], []);
      await service.deactivate("c1", "EMAIL", "2026-09-30");
      await service.activate("c1");
      expect(dbMock.matching(/^delete from "Contact"/)).toHaveLength(0);
    });

    it("throws NotFound when deactivating a missing contact", async () => {
      dbMock.queue([]);
      await expect(service.deactivate("nope", "EMAIL", "2026-09-30")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rethrows unexpected errors from deactivate unchanged", async () => {
      const boom = new Error("db down");
      dbMock.queue(boom);
      await expect(service.deactivate("c1", "EMAIL", "2026-09-30")).rejects.toBe(boom);
    });

    it("reactivation flips status to ACTIVE only, keeping the deactivation history", async () => {
      dbMock.queue([{ id: "c1" }], [row()], []);
      await service.activate("c1");
      const [update] = dbMock.matching(updateContact);
      expect(update?.sql).toContain('"status" = $1');
      expect(update?.sql).not.toContain("deactivated_at");
      expect(update?.sql).not.toContain("external_request");
      expect(update?.params[0]).toBe("ACTIVE");
    });

    it("throws NotFound when activating a missing contact", async () => {
      dbMock.queue([]);
      await expect(service.activate("nope")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---- Domain subset integrity -------------------------------------------

  describe("create", () => {
    const bodyDomains = [{ domainId: "d1" }, { domainId: "d2" }];

    it("rejects domains that do not belong to the chosen body, before writing anything", async () => {
      dbMock.queue(bodyDomains, bodyDomains);

      await expect(service.create(createInput({ domainIds: ["d1", "dX"] }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.create(createInput({ domainIds: ["dX"] }))).rejects.toMatchObject({
        response: { code: "VALIDATION_ERROR", details: [{ field: "domainIds" }] },
      });
      expect(dbMock.matching(/^insert/)).toHaveLength(0);
    });

    it("creates the contact, its body link and one domain row per domain", async () => {
      dbMock.queue(bodyDomains, [row()], [], []);

      const dto = await service.create(createInput());

      const [contactInsert, linkInsert, domainInsert] = dbMock.matching(/^insert/);
      expect(contactInsert?.sql).toContain('insert into "Contact"');
      expect(linkInsert?.sql).toContain('insert into "ContactOnSupportedBody"');
      expect(linkInsert?.params).toEqual(expect.arrayContaining(["c1", "b1"]));
      expect(domainInsert?.sql).toContain('insert into "ContactOnSupportedBodyDomain"');
      expect(domainInsert?.params).toEqual(["c1", "b1", "d1", "c1", "b1", "d2"]);
      expect(dto.supportedBodyLinks).toEqual([{ supportedBodyId: "b1", domainIds: ["d1", "d2"] }]);
    });

    it("stores blank notes as null and leaves notes to the column default when not sent", async () => {
      dbMock.queue(bodyDomains, [row()], [], [], bodyDomains, [row()], [], []);

      await service.create(createInput({ notes: "" }));
      await service.create(createInput());

      const [withNotes, withoutNotes] = dbMock.matching(/^insert into "Contact" /);
      expect(withNotes?.sql).toContain('"notes"');
      expect(withNotes?.params).toContain(null);
      expect(withoutNotes?.sql).toContain('"notes"'); // drizzle lists every column…
      expect(withoutNotes?.sql).toMatch(/default/); // …but uses DEFAULT for the omitted ones
    });
  });

  describe("update", () => {
    it("writes only the fields that were sent (plus updatedAt)", async () => {
      dbMock.queue([{ id: "c1" }], [row()], []);
      await service.update("c1", { smsOptIn: true });
      const [update] = dbMock.matching(updateContact);
      expect(update?.sql).toContain('"sms_opt_in"');
      expect(update?.sql).toContain('"updatedAt"');
      expect(update?.sql).not.toContain('"role"');
      expect(update?.sql).not.toContain('"email_opt_in"');
    });

    it("turns a blank notes value into null so notes can be cleared", async () => {
      dbMock.queue([{ id: "c1" }], [row()], []);
      await service.update("c1", { notes: "" });
      const [update] = dbMock.matching(updateContact);
      expect(update?.sql).toContain('"notes" = $');
      expect(update?.params).toContain(null);
      expect(update?.params).not.toContain("");
    });

    it("throws NotFound for a missing contact", async () => {
      dbMock.queue([]);
      await expect(service.update("nope", { smsOptIn: true })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---- Supported-body links ----------------------------------------------

  describe("addSupportedBody", () => {
    it("rejects domains outside the body", async () => {
      dbMock.queue([{ domainId: "d1" }]);
      await expect(service.addSupportedBody("c1", "b2", ["dX"])).rejects.toBeInstanceOf(BadRequestException);
      expect(dbMock.matching(/^insert/)).toHaveLength(0);
    });

    it("returns Conflict when the contact is already linked to that body", async () => {
      dbMock.queue([{ domainId: "d1" }], uniqueViolation());
      await expect(service.addSupportedBody("c1", "b2", ["d1"])).rejects.toBeInstanceOf(ConflictException);
    });

    it("lets unexpected errors through untranslated", async () => {
      const boom = new Error("db down");
      dbMock.queue([{ domainId: "d1" }], boom);
      await expect(service.addSupportedBody("c1", "b2", ["d1"])).rejects.toBe(boom);
    });

    it("links the body and its domain subset, then returns the refreshed contact", async () => {
      dbMock.queue([{ domainId: "d1" }], [], [], [row()], [linkRow("b2", "d1")]);
      const dto = await service.addSupportedBody("c1", "b2", ["d1"]);
      const [, domainInsert] = dbMock.matching(/^insert/);
      expect(domainInsert?.params).toEqual(["c1", "b2", "d1"]);
      expect(dto).toMatchObject({ id: "c1", supportedBodyLinks: [{ supportedBodyId: "b2", domainIds: ["d1"] }] });
    });

    it("throws NotFound when the contact does not exist after linking", async () => {
      dbMock.queue([{ domainId: "d1" }], [], [], []);
      await expect(service.addSupportedBody("ghost", "b2", ["d1"])).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("updateSupportedBodyDomains", () => {
    it("throws NotFound when the contact is not linked to that body", async () => {
      dbMock.queue([]);
      await expect(service.updateSupportedBodyDomains("c1", "b1", ["d1"])).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects domains outside the body without touching the existing subset", async () => {
      dbMock.queue([{ contactId: "c1" }], [{ domainId: "d1" }]);
      await expect(service.updateSupportedBodyDomains("c1", "b1", ["dX"])).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(dbMock.matching(/^delete/)).toHaveLength(0);
    });

    it("replaces the subset (delete then recreate) for that link only", async () => {
      dbMock.queue([{ contactId: "c1" }], [{ domainId: "d1" }, { domainId: "d2" }], [], [], [row()], []);

      await service.updateSupportedBodyDomains("c1", "b1", ["d2"]);

      const [remove] = dbMock.matching(/^delete from "ContactOnSupportedBodyDomain"/);
      expect(remove?.params).toEqual(["c1", "b1"]);
      const [insert] = dbMock.matching(/^insert into "ContactOnSupportedBodyDomain"/);
      expect(insert?.params).toEqual(["c1", "b1", "d2"]);
    });
  });

  describe("removeSupportedBody", () => {
    it("refuses to remove the last remaining link", async () => {
      dbMock.queue([{ total: 1 }]);
      await expect(service.removeSupportedBody("c1", "b1")).rejects.toBeInstanceOf(ConflictException);
      expect(dbMock.matching(/^delete/)).toHaveLength(0);
    });

    it("throws NotFound when the link does not exist", async () => {
      dbMock.queue([{ total: 2 }], []);
      await expect(service.removeSupportedBody("c1", "bX")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("deletes the link together with its domain subset", async () => {
      dbMock.queue([{ total: 2 }], [{ contactId: "c1" }], [], [], [row()], []);

      await service.removeSupportedBody("c1", "b1");

      const deletes = dbMock.matching(/^delete/);
      expect(deletes.map((d) => d.sql.match(/^delete from "(\w+)"/)?.[1])).toEqual([
        "ContactOnSupportedBodyDomain",
        "ContactOnSupportedBody",
      ]);
      expect(deletes[1]?.params).toEqual(["c1", "b1"]);
    });
  });
});
