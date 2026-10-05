import { Injectable, ConflictException, NotFoundException, BadRequestException } from "@nestjs/common";
import { prisma, Prisma } from "@contact-management/db";
import type {
  CreateContactInput,
  ContactDto,
  ListContactsQuery,
  ListContactsResult,
  UpdateContactInput,
  ExternalRequestSource,
} from "@contact-management/shared-schemas/contacts";

// Shared shape returned by every query below — keeps the DTO mapping in one
// place instead of repeated per method.
const CONTACT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  idNumber: true,
  role: true,
  phone: true,
  emails: true,
  notes: true,
  emailOptIn: true,
  smsOptIn: true,
  status: true,
  supportedBodies: {
    select: {
      supportedBodyId: true,
      domains: { select: { domainId: true } },
    },
  },
} satisfies Prisma.ContactSelect;

type ContactRow = Prisma.ContactGetPayload<{ select: typeof CONTACT_SELECT }>;

// A field left blank in the form arrives here as "" (Joi .allow('') — see
// schema.ts), which means "clear it" — stored as `null`, not literally "".
function blankToNull(value: string): string | null {
  return value === "" ? null : value;
}

function toDto(row: ContactRow): ContactDto {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    idNumber: row.idNumber,
    role: row.role,
    phone: row.phone,
    emails: row.emails,
    notes: row.notes,
    emailOptIn: row.emailOptIn,
    smsOptIn: row.smsOptIn,
    status: row.status,
    supportedBodyLinks: row.supportedBodies.map((s) => ({
      supportedBodyId: s.supportedBodyId,
      domainIds: s.domains.map((d) => d.domainId),
    })),
  };
}

@Injectable()
export class ContactsService {
  // Post-1.6 revision: domainIds must be a subset of supportedBodyId's own
  // domains — Joi can't check this (it doesn't know which domains belong to
  // which body), so it's enforced here before any write.
  private async assertDomainsBelongToBody(supportedBodyId: string, domainIds: string[]): Promise<void> {
    const bodyDomains = await prisma.supportedBodyOnDomain.findMany({
      where: { supportedBodyId },
      select: { domainId: true },
    });
    const validIds = new Set(bodyDomains.map((d) => d.domainId));
    const invalid = domainIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "חלק מהתחומים שנבחרו אינם שייכים לגוף הנתמך שנבחר",
        details: [{ field: "domainIds", message: `Not domains of this SupportedBody: ${invalid.join(", ")}` }],
      });
    }
  }

  // Story 1.8 — search (name) + supportedBodyId/domainId/updatedYear filters
  // + includeInactive, paginated. `status: 'ACTIVE'` by default is mandatory
  // per expertise-postgres-prisma unless includeInactive is set.
  async list(query: ListContactsQuery): Promise<ListContactsResult> {
    const where: Prisma.ContactWhereInput = {
      ...(query.includeInactive ? {} : { status: "ACTIVE" }),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
      // supportedBodyId and domainId both reach the model through the same
      // `supportedBodies` relation — they're merged into one `some` clause
      // (not two separate `supportedBodies` keys, which would just silently
      // overwrite each other in the object literal) so that, when both are
      // set, they must be satisfied by the *same* linked SupportedBody.
      // domainId filters through this Contact's own domain *subset* for that
      // link (ContactOnSupportedBodyDomain), not the body's full domain set —
      // post-1.6 revision, consistent with what the subset actually means.
      ...(query.supportedBodyId || query.domainId
        ? {
            supportedBodies: {
              some: {
                ...(query.supportedBodyId ? { supportedBodyId: query.supportedBodyId } : {}),
                ...(query.domainId ? { domains: { some: { domainId: query.domainId } } } : {}),
              },
            },
          }
        : {}),
      ...(query.updatedYear
        ? {
            updatedAt: {
              gte: new Date(Date.UTC(query.updatedYear, 0, 1)),
              lt: new Date(Date.UTC(query.updatedYear + 1, 0, 1)),
            },
          }
        : {}),
    };

    const [rows, total] = await prisma.$transaction([
      prisma.contact.findMany({
        where,
        select: CONTACT_SELECT,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.contact.count({ where }),
    ]);

    return {
      items: rows.map(toDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async create(input: CreateContactInput): Promise<ContactDto> {
    await this.assertDomainsBelongToBody(input.supportedBodyId, input.domainIds);

    // Multi-model write (Contact + its ContactOnSupportedBody +
    // ContactOnSupportedBodyDomain rows) — wrapped so it's all-or-nothing,
    // per expertise-postgres-prisma "Making it atomic".
    const created = await prisma.$transaction(async (tx) => {
      const contact = await tx.contact.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          ...(input.idNumber !== undefined ? { idNumber: blankToNull(input.idNumber) } : {}),
          ...(input.role !== undefined ? { role: blankToNull(input.role) } : {}),
          ...(input.phone !== undefined ? { phone: blankToNull(input.phone) } : {}),
          emails: input.emails,
          ...(input.notes !== undefined ? { notes: blankToNull(input.notes) } : {}),
          emailOptIn: input.emailOptIn,
          smsOptIn: input.smsOptIn,
        },
      });
      await tx.contactOnSupportedBody.create({
        data: { contactId: contact.id, supportedBodyId: input.supportedBodyId },
      });
      await tx.contactOnSupportedBodyDomain.createMany({
        data: input.domainIds.map((domainId) => ({
          contactId: contact.id,
          supportedBodyId: input.supportedBodyId,
          domainId,
        })),
      });
      return contact;
    });

    return toDto({
      ...created,
      supportedBodies: [
        { supportedBodyId: input.supportedBodyId, domains: input.domainIds.map((domainId) => ({ domainId })) },
      ],
    });
  }

  // Story 1.6 — role/phone/emails/notes/channel prefs only (per this story's
  // AC — firstName/lastName/idNumber/supportedBodyId are out of scope here).
  async update(id: string, input: UpdateContactInput): Promise<ContactDto> {
    try {
      const updated = await prisma.contact.update({
        where: { id },
        data: {
          ...(input.role !== undefined ? { role: blankToNull(input.role) } : {}),
          ...(input.phone !== undefined ? { phone: blankToNull(input.phone) } : {}),
          ...(input.emails !== undefined ? { emails: input.emails } : {}),
          ...(input.notes !== undefined ? { notes: blankToNull(input.notes) } : {}),
          ...(input.emailOptIn !== undefined ? { emailOptIn: input.emailOptIn } : {}),
          ...(input.smsOptIn !== undefined ? { smsOptIn: input.smsOptIn } : {}),
        },
        select: CONTACT_SELECT,
      });
      return toDto(updated);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new NotFoundException({ code: "NOT_FOUND", message: "איש קשר לא נמצא" });
      }
      throw err;
    }
  }

  // Story 1.6 — link an additional SupportedBody (many-to-many: a contact
  // can represent more than one body, FR-7), with its own domain subset
  // (post-1.6 revision — see ContactOnSupportedBodyDomain).
  async addSupportedBody(contactId: string, supportedBodyId: string, domainIds: string[]): Promise<ContactDto> {
    await this.assertDomainsBelongToBody(supportedBodyId, domainIds);

    try {
      await prisma.$transaction(async (tx) => {
        await tx.contactOnSupportedBody.create({ data: { contactId, supportedBodyId } });
        await tx.contactOnSupportedBodyDomain.createMany({
          data: domainIds.map((domainId) => ({ contactId, supportedBodyId, domainId })),
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException({
          code: "CONFLICT",
          message: "איש הקשר כבר משויך לגוף הנתמך הזה",
        });
      }
      throw err;
    }

    const updated = await prisma.contact.findUnique({ where: { id: contactId }, select: CONTACT_SELECT });
    if (!updated) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "איש קשר לא נמצא" });
    }
    return toDto(updated);
  }

  // Requested by Rachel after noticing the gap: an existing link's domain
  // subset was only ever chosen once, at creation/add time, with no way to
  // add/remove domains afterward. Full replace (delete + recreate), same
  // pattern as SupportedBody's own domainIds sync (expertise-postgres-prisma).
  async updateSupportedBodyDomains(
    contactId: string,
    supportedBodyId: string,
    domainIds: string[],
  ): Promise<ContactDto> {
    const link = await prisma.contactOnSupportedBody.findUnique({
      where: { contactId_supportedBodyId: { contactId, supportedBodyId } },
    });
    if (!link) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "השיוך לגוף הנתמך לא נמצא" });
    }

    await this.assertDomainsBelongToBody(supportedBodyId, domainIds);

    await prisma.$transaction(async (tx) => {
      await tx.contactOnSupportedBodyDomain.deleteMany({ where: { contactId, supportedBodyId } });
      await tx.contactOnSupportedBodyDomain.createMany({
        data: domainIds.map((domainId) => ({ contactId, supportedBodyId, domainId })),
      });
    });

    const updated = await prisma.contact.findUnique({ where: { id: contactId }, select: CONTACT_SELECT });
    if (!updated) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "איש קשר לא נמצא" });
    }
    return toDto(updated);
  }

  // Story 1.7 — soft "delete". Never a real row deletion — status + the
  // three documentation fields, per expertise-postgres-prisma's Contact
  // soft-delete rule. deactivatedAt is "now" (when the action was taken in
  // the app); externalRequestDate is whatever the user entered (when the
  // outside request actually came in — can be in the past).
  async deactivate(id: string, source: ExternalRequestSource, date: string): Promise<ContactDto> {
    try {
      const updated = await prisma.contact.update({
        where: { id },
        data: {
          status: "INACTIVE",
          deactivatedAt: new Date(),
          externalRequestSource: source,
          externalRequestDate: new Date(date),
        },
        select: CONTACT_SELECT,
      });
      return toDto(updated);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new NotFoundException({ code: "NOT_FOUND", message: "איש קשר לא נמצא" });
      }
      throw err;
    }
  }

  // Reactivation — not in any story's AC, added per Rachel's request after
  // noticing the same gap already fixed for SupportedBody. Flips status back
  // to ACTIVE only; deactivatedAt/externalRequestSource/externalRequestDate
  // are left as-is (the historical record of the deactivation that happened —
  // consistent with FR-8/CM-3's "preserve history", not an undo/erase).
  async activate(id: string): Promise<ContactDto> {
    try {
      const updated = await prisma.contact.update({
        where: { id },
        data: { status: "ACTIVE" },
        select: CONTACT_SELECT,
      });
      return toDto(updated);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new NotFoundException({ code: "NOT_FOUND", message: "איש קשר לא נמצא" });
      }
      throw err;
    }
  }
}
