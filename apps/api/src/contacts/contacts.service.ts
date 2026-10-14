import { Injectable, ConflictException, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import {
  and,
  asc,
  contactSupportedBodies,
  contactSupportedBodyDomains,
  contacts,
  count,
  db,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  isUniqueViolation,
  lt,
  or,
  sql,
  supportedBodyDomains,
  type Database,
  type Transaction,
} from "@contact-management/db";
import type {
  CreateContactInput,
  ContactDto,
  ContactSupportedBodyLink,
  ListContactsQuery,
  ListContactsResult,
  UpdateContactInput,
  ExternalRequestSource,
} from "@contact-management/shared-schemas/contacts";

type Executor = Database | Transaction;

// Shared projection returned by every query below — keeps the DTO mapping in
// one place instead of repeated per method, and never over-fetches columns.
const CONTACT_COLUMNS = {
  id: contacts.id,
  firstName: contacts.firstName,
  lastName: contacts.lastName,
  idNumber: contacts.idNumber,
  role: contacts.role,
  phone: contacts.phone,
  emails: contacts.emails,
  notes: contacts.notes,
  emailOptIn: contacts.emailOptIn,
  smsOptIn: contacts.smsOptIn,
  status: contacts.status,
};

type ContactRow = {
  id: string;
  firstName: string;
  lastName: string;
  idNumber: string | null;
  role: string | null;
  phone: string | null;
  emails: string[];
  notes: string | null;
  emailOptIn: boolean;
  smsOptIn: boolean;
  status: "ACTIVE" | "INACTIVE";
};

// A field left blank in the form arrives here as "" (the schema allows it),
// which means "clear it" — stored as `null`, not literally "".
function blankToNull(value: string): string | null {
  return value === "" ? null : value;
}

// ILIKE treats % and _ as wildcards; a search for "50%" must match the
// literal text, not everything.
function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, "\\$&")}%`;
}

function toDto(row: ContactRow, supportedBodyLinks: ContactSupportedBodyLink[]): ContactDto {
  return { ...row, supportedBodyLinks };
}

const notFound = () => new NotFoundException({ code: "NOT_FOUND", message: "איש קשר לא נמצא" });
const linkNotFound = () => new NotFoundException({ code: "NOT_FOUND", message: "השיוך לגוף הנתמך לא נמצא" });

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  // Loads every linked body (and the contact's domain subset for it) for all
  // given contacts in one query, instead of one query per contact (N+1).
  private async loadLinks(executor: Executor, contactIds: string[]): Promise<Map<string, ContactSupportedBodyLink[]>> {
    const linksByContact = new Map<string, ContactSupportedBodyLink[]>();
    if (contactIds.length === 0) return linksByContact;

    const rows = await executor
      .select({
        contactId: contactSupportedBodies.contactId,
        supportedBodyId: contactSupportedBodies.supportedBodyId,
        domainId: contactSupportedBodyDomains.domainId,
      })
      .from(contactSupportedBodies)
      .leftJoin(
        contactSupportedBodyDomains,
        and(
          eq(contactSupportedBodyDomains.contactId, contactSupportedBodies.contactId),
          eq(contactSupportedBodyDomains.supportedBodyId, contactSupportedBodies.supportedBodyId),
        ),
      )
      .where(inArray(contactSupportedBodies.contactId, contactIds))
      .orderBy(asc(contactSupportedBodies.createdAt), asc(contactSupportedBodies.supportedBodyId));

    for (const { contactId, supportedBodyId, domainId } of rows) {
      const links = linksByContact.get(contactId) ?? [];
      linksByContact.set(contactId, links);
      let link = links.find((l) => l.supportedBodyId === supportedBodyId);
      if (!link) {
        link = { supportedBodyId, domainIds: [] };
        links.push(link);
      }
      if (domainId) link.domainIds.push(domainId);
    }
    return linksByContact;
  }

  private async getDto(executor: Executor, contactId: string): Promise<ContactDto> {
    const [row] = await executor.select(CONTACT_COLUMNS).from(contacts).where(eq(contacts.id, contactId));
    if (!row) throw notFound();
    const links = await this.loadLinks(executor, [contactId]);
    return toDto(row, links.get(contactId) ?? []);
  }

  // Post-1.6 revision: domainIds must be a subset of supportedBodyId's own
  // domains — the schema can't check this (it doesn't know which domains
  // belong to which body), so it's enforced here before any write.
  private async assertDomainsBelongToBody(supportedBodyId: string, domainIds: string[]): Promise<void> {
    const bodyDomains = await db
      .select({ domainId: supportedBodyDomains.domainId })
      .from(supportedBodyDomains)
      .where(eq(supportedBodyDomains.supportedBodyId, supportedBodyId));
    const validIds = new Set(bodyDomains.map((d) => d.domainId));
    const invalid = domainIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      this.logger.warn(`Rejected domains outside supported body ${supportedBodyId}: ${invalid.length} invalid`);
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "חלק מהתחומים שנבחרו אינם שייכים לגוף הנתמך שנבחר",
        // Field-level message (shown directly under the domainIds field via
        // RHF's setError) — no raw domain ids in it, they're opaque strings
        // and not meaningful to the user.
        details: [{ field: "domainIds", message: "תחום שנבחר אינו שייך לגוף הנתמך שנבחר" }],
      });
    }
  }

  // Story 1.8 — search (name) + supportedBodyId/domainId/updatedYear filters
  // + includeInactive, paginated. `status = ACTIVE` by default is mandatory
  // per expertise-postgres-drizzle unless includeInactive is set.
  async list(query: ListContactsQuery): Promise<ListContactsResult> {
    // supportedBodyId and domainId both reach the contact through the same
    // link row, so they are checked in one EXISTS — when both are set they
    // must be satisfied by the *same* linked SupportedBody. domainId filters
    // through this contact's own domain *subset* for that link
    // (ContactOnSupportedBodyDomain), not the body's full domain set.
    const linkMatches =
      query.supportedBodyId || query.domainId
        ? exists(
            db
              .select({ one: sql`1` })
              .from(contactSupportedBodies)
              .where(
                and(
                  eq(contactSupportedBodies.contactId, contacts.id),
                  query.supportedBodyId ? eq(contactSupportedBodies.supportedBodyId, query.supportedBodyId) : undefined,
                  query.domainId
                    ? exists(
                        db
                          .select({ one: sql`1` })
                          .from(contactSupportedBodyDomains)
                          .where(
                            and(
                              eq(contactSupportedBodyDomains.contactId, contactSupportedBodies.contactId),
                              eq(contactSupportedBodyDomains.supportedBodyId, contactSupportedBodies.supportedBodyId),
                              eq(contactSupportedBodyDomains.domainId, query.domainId),
                            ),
                          ),
                      )
                    : undefined,
                ),
              ),
          )
        : undefined;

    const where = and(
      query.includeInactive ? undefined : eq(contacts.status, "ACTIVE"),
      query.search
        ? or(
            ilike(contacts.firstName, containsPattern(query.search)),
            ilike(contacts.lastName, containsPattern(query.search)),
          )
        : undefined,
      linkMatches,
      query.updatedYear
        ? and(
            gte(contacts.updatedAt, new Date(Date.UTC(query.updatedYear, 0, 1))),
            lt(contacts.updatedAt, new Date(Date.UTC(query.updatedYear + 1, 0, 1))),
          )
        : undefined,
    );

    const [rows, [totalRow]] = await Promise.all([
      db
        .select(CONTACT_COLUMNS)
        .from(contacts)
        .where(where)
        .orderBy(asc(contacts.lastName), asc(contacts.firstName))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      db.select({ total: count() }).from(contacts).where(where),
    ]);

    const links = await this.loadLinks(
      db,
      rows.map((r) => r.id),
    );

    return {
      items: rows.map((row) => toDto(row, links.get(row.id) ?? [])),
      total: totalRow?.total ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async create(input: CreateContactInput): Promise<ContactDto> {
    await this.assertDomainsBelongToBody(input.supportedBodyId, input.domainIds);

    // Multi-table write (Contact + its ContactOnSupportedBody +
    // ContactOnSupportedBodyDomain rows) — wrapped so it's all-or-nothing.
    const created = await db.transaction(async (tx) => {
      const [contact] = await tx
        .insert(contacts)
        .values({
          firstName: input.firstName,
          lastName: input.lastName,
          // idNumber/role/phone are required at creation (the schema enforces
          // non-empty) — no blankToNull needed here, unlike notes below.
          idNumber: input.idNumber,
          role: input.role,
          phone: input.phone,
          emails: input.emails,
          ...(input.notes !== undefined ? { notes: blankToNull(input.notes) } : {}),
          emailOptIn: input.emailOptIn,
          smsOptIn: input.smsOptIn,
        })
        .returning(CONTACT_COLUMNS);
      if (!contact) throw new Error("Contact insert returned no row");

      await tx.insert(contactSupportedBodies).values({ contactId: contact.id, supportedBodyId: input.supportedBodyId });
      await tx.insert(contactSupportedBodyDomains).values(
        input.domainIds.map((domainId) => ({
          contactId: contact.id,
          supportedBodyId: input.supportedBodyId,
          domainId,
        })),
      );
      return contact;
    });

    this.logger.log(`Created contact ${created.id} linked to supported body ${input.supportedBodyId}`);
    return toDto(created, [{ supportedBodyId: input.supportedBodyId, domainIds: input.domainIds }]);
  }

  // Story 1.6 — role/phone/emails/notes/channel prefs only (per this story's
  // AC — firstName/lastName/idNumber/supportedBodyId are out of scope here).
  async update(id: string, input: UpdateContactInput): Promise<ContactDto> {
    const [updated] = await db
      .update(contacts)
      .set({
        // Always set so the statement is never empty and updatedAt is bumped.
        updatedAt: new Date(),
        ...(input.role !== undefined ? { role: blankToNull(input.role) } : {}),
        ...(input.phone !== undefined ? { phone: blankToNull(input.phone) } : {}),
        ...(input.emails !== undefined ? { emails: input.emails } : {}),
        ...(input.notes !== undefined ? { notes: blankToNull(input.notes) } : {}),
        ...(input.emailOptIn !== undefined ? { emailOptIn: input.emailOptIn } : {}),
        ...(input.smsOptIn !== undefined ? { smsOptIn: input.smsOptIn } : {}),
      })
      .where(eq(contacts.id, id))
      .returning({ id: contacts.id });
    if (!updated) throw notFound();

    this.logger.log(`Updated contact ${id}`);
    return this.getDto(db, id);
  }

  // Story 1.6 — link an additional SupportedBody (many-to-many: a contact
  // can represent more than one body, FR-7), with its own domain subset
  // (post-1.6 revision — see ContactOnSupportedBodyDomain).
  async addSupportedBody(contactId: string, supportedBodyId: string, domainIds: string[]): Promise<ContactDto> {
    await this.assertDomainsBelongToBody(supportedBodyId, domainIds);

    try {
      await db.transaction(async (tx) => {
        await tx.insert(contactSupportedBodies).values({ contactId, supportedBodyId });
        await tx
          .insert(contactSupportedBodyDomains)
          .values(domainIds.map((domainId) => ({ contactId, supportedBodyId, domainId })));
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        this.logger.warn(`Contact ${contactId} is already linked to supported body ${supportedBodyId}`);
        throw new ConflictException({
          code: "CONFLICT",
          message: "איש הקשר כבר משויך לגוף הנתמך הזה",
        });
      }
      throw err;
    }

    this.logger.log(`Linked contact ${contactId} to supported body ${supportedBodyId}`);
    return this.getDto(db, contactId);
  }

  // An existing link's domain subset was only ever chosen once, at
  // creation/add time — this lets it be edited afterwards. Full replace
  // (delete + recreate), same pattern as SupportedBody's own domainIds sync.
  async updateSupportedBodyDomains(
    contactId: string,
    supportedBodyId: string,
    domainIds: string[],
  ): Promise<ContactDto> {
    const [link] = await db
      .select({ contactId: contactSupportedBodies.contactId })
      .from(contactSupportedBodies)
      .where(
        and(
          eq(contactSupportedBodies.contactId, contactId),
          eq(contactSupportedBodies.supportedBodyId, supportedBodyId),
        ),
      );
    if (!link) throw linkNotFound();

    await this.assertDomainsBelongToBody(supportedBodyId, domainIds);

    await db.transaction(async (tx) => {
      await tx
        .delete(contactSupportedBodyDomains)
        .where(
          and(
            eq(contactSupportedBodyDomains.contactId, contactId),
            eq(contactSupportedBodyDomains.supportedBodyId, supportedBodyId),
          ),
        );
      await tx
        .insert(contactSupportedBodyDomains)
        .values(domainIds.map((domainId) => ({ contactId, supportedBodyId, domainId })));
    });

    this.logger.log(`Replaced domain subset of contact ${contactId} for supported body ${supportedBodyId}`);
    return this.getDto(db, contactId);
  }

  // The counterpart to addSupportedBody. A Contact must always represent at
  // least one SupportedBody (same rule CreateContactInput enforces at
  // creation), so removing the *last* remaining link is rejected rather than
  // leaving an orphaned Contact.
  async removeSupportedBody(contactId: string, supportedBodyId: string): Promise<ContactDto> {
    const [linkCount] = await db
      .select({ total: count() })
      .from(contactSupportedBodies)
      .where(eq(contactSupportedBodies.contactId, contactId));
    if ((linkCount?.total ?? 0) <= 1) {
      this.logger.warn(`Refused to remove the last supported body link of contact ${contactId}`);
      throw new ConflictException({
        code: "CONFLICT",
        message: "לא ניתן להסיר שיוך יחיד — לאיש קשר חייב להיות שיוך לפחות לגוף נתמך אחד",
      });
    }

    const [link] = await db
      .select({ contactId: contactSupportedBodies.contactId })
      .from(contactSupportedBodies)
      .where(
        and(
          eq(contactSupportedBodies.contactId, contactId),
          eq(contactSupportedBodies.supportedBodyId, supportedBodyId),
        ),
      );
    if (!link) throw linkNotFound();

    await db.transaction(async (tx) => {
      await tx
        .delete(contactSupportedBodyDomains)
        .where(
          and(
            eq(contactSupportedBodyDomains.contactId, contactId),
            eq(contactSupportedBodyDomains.supportedBodyId, supportedBodyId),
          ),
        );
      await tx
        .delete(contactSupportedBodies)
        .where(
          and(
            eq(contactSupportedBodies.contactId, contactId),
            eq(contactSupportedBodies.supportedBodyId, supportedBodyId),
          ),
        );
    });

    this.logger.log(`Removed supported body ${supportedBodyId} from contact ${contactId}`);
    return this.getDto(db, contactId);
  }

  // Story 1.7 — soft "delete". Never a real row deletion — status + the
  // documentation fields. deactivatedAt is "now" (when the action was taken
  // in the app); externalRequestDate is whatever the user entered (when the
  // outside request actually came in — can be in the past).
  async deactivate(id: string, source: ExternalRequestSource, date: string): Promise<ContactDto> {
    const [updated] = await db
      .update(contacts)
      .set({
        status: "INACTIVE",
        deactivatedAt: new Date(),
        externalRequestSource: source,
        externalRequestDate: new Date(date),
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, id))
      .returning({ id: contacts.id });
    if (!updated) throw notFound();

    this.logger.log(`Deactivated contact ${id} (external request via ${source})`);
    return this.getDto(db, id);
  }

  // Reactivation — flips status back to ACTIVE only; deactivatedAt and the
  // external-request fields are left as-is (the historical record of the
  // deactivation that happened — FR-8/CM-3's "preserve history", not an undo).
  async activate(id: string): Promise<ContactDto> {
    const [updated] = await db
      .update(contacts)
      .set({ status: "ACTIVE", updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning({ id: contacts.id });
    if (!updated) throw notFound();

    this.logger.log(`Reactivated contact ${id}`);
    return this.getDto(db, id);
  }
}
