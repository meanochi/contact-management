import { Injectable, ConflictException, NotFoundException, Logger } from "@nestjs/common";
import {
  and,
  asc,
  contactSupportedBodyDomains,
  count,
  db,
  eq,
  exists,
  ilike,
  inArray,
  isUniqueViolation,
  notInArray,
  or,
  sql,
  supportedBodies,
  supportedBodyDomains,
  type Database,
  type Transaction,
} from "@contact-management/db";
import type {
  CreateSupportedBodyInput,
  ListSupportedBodiesQuery,
  ListSupportedBodiesResult,
  SupportedBodyDto,
  UpdateSupportedBodyInput,
} from "@contact-management/shared-schemas/supported-bodies";

type Executor = Database | Transaction;

const SUPPORTED_BODY_COLUMNS = {
  id: supportedBodies.id,
  name: supportedBodies.name,
  companyId: supportedBodies.companyId,
  isActive: supportedBodies.isActive,
};

// ILIKE treats % and _ as wildcards; a search for "50%" must match the
// literal text, not everything.
function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, "\\$&")}%`;
}

@Injectable()
export class SupportedBodiesService {
  private readonly logger = new Logger(SupportedBodiesService.name);

  // Loads the domain ids of all given bodies in one query, not one per body.
  private async loadDomainIds(executor: Executor, bodyIds: string[]): Promise<Map<string, string[]>> {
    const byBody = new Map<string, string[]>();
    if (bodyIds.length === 0) return byBody;

    const rows = await executor
      .select({ supportedBodyId: supportedBodyDomains.supportedBodyId, domainId: supportedBodyDomains.domainId })
      .from(supportedBodyDomains)
      .where(inArray(supportedBodyDomains.supportedBodyId, bodyIds))
      .orderBy(asc(supportedBodyDomains.createdAt), asc(supportedBodyDomains.domainId));

    for (const { supportedBodyId, domainId } of rows) {
      byBody.set(supportedBodyId, [...(byBody.get(supportedBodyId) ?? []), domainId]);
    }
    return byBody;
  }

  // Translates the DB-level uniqueness violation (companyId UNIQUE) into the
  // documented 409 envelope — never let a raw driver error surface
  // (expertise-api-rest "translate ORM errors at the Service layer").
  private async companyIdConflict(companyId: string): Promise<ConflictException> {
    const [existing] = await db
      .select({ id: supportedBodies.id, name: supportedBodies.name })
      .from(supportedBodies)
      .where(eq(supportedBodies.companyId, companyId));
    this.logger.warn(`Supported body with company id ${companyId} already exists`);
    return new ConflictException({
      code: "CONFLICT",
      message: 'גוף נתמך עם ח"פ זה כבר קיים במערכת', // UX-DR18
      details: existing ?? null,
    });
  }

  // Story 1.4 — search (name/companyId) + domain filter + isActive filter,
  // paginated (UX-DR24, no infinite scroll). Only the columns the list needs.
  async list(query: ListSupportedBodiesQuery): Promise<ListSupportedBodiesResult> {
    const where = and(
      query.search
        ? or(
            ilike(supportedBodies.name, containsPattern(query.search)),
            ilike(supportedBodies.companyId, containsPattern(query.search)),
          )
        : undefined,
      query.domainId
        ? exists(
            db
              .select({ one: sql`1` })
              .from(supportedBodyDomains)
              .where(
                and(
                  eq(supportedBodyDomains.supportedBodyId, supportedBodies.id),
                  eq(supportedBodyDomains.domainId, query.domainId),
                ),
              ),
          )
        : undefined,
      query.isActive !== undefined ? eq(supportedBodies.isActive, query.isActive) : undefined,
    );

    const [rows, [totalRow]] = await Promise.all([
      db
        .select(SUPPORTED_BODY_COLUMNS)
        .from(supportedBodies)
        .where(where)
        .orderBy(asc(supportedBodies.name))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      db.select({ total: count() }).from(supportedBodies).where(where),
    ]);

    const domainIds = await this.loadDomainIds(
      db,
      rows.map((r) => r.id),
    );

    return {
      items: rows.map((row) => ({ ...row, domainIds: domainIds.get(row.id) ?? [] })),
      total: totalRow?.total ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async create(input: CreateSupportedBodyInput): Promise<SupportedBodyDto> {
    try {
      // Multi-table write (SupportedBody + N SupportedBodyOnDomain rows) —
      // wrapped so it's all-or-nothing.
      const created = await db.transaction(async (tx) => {
        const [body] = await tx
          .insert(supportedBodies)
          .values({ name: input.name, companyId: input.companyId })
          .returning(SUPPORTED_BODY_COLUMNS);
        if (!body) throw new Error("SupportedBody insert returned no row");

        await tx
          .insert(supportedBodyDomains)
          .values(input.domainIds.map((domainId) => ({ supportedBodyId: body.id, domainId })));
        return body;
      });

      this.logger.log(`Created supported body ${created.id}`);
      return { ...created, domainIds: input.domainIds };
    } catch (err) {
      if (isUniqueViolation(err)) throw await this.companyIdConflict(input.companyId);
      throw err;
    }
  }

  // Story 1.3 — edit (name/companyId/domainIds) and deactivate (isActive:
  // false) both go through this one PATCH-backed method, same as the
  // project's Contact DELETE-via-PATCH rule (expertise-api-rest). The body and
  // its domain rows are updated together in one transaction so a failure
  // partway through can't leave domainIds out of sync with the body.
  async update(id: string, input: UpdateSupportedBodyInput): Promise<SupportedBodyDto> {
    try {
      const updated = await db.transaction(async (tx) => {
        const [body] = await tx
          .update(supportedBodies)
          .set({
            // Always set so the statement is never empty (a domainIds-only
            // patch has no scalar field) and updatedAt is bumped.
            updatedAt: new Date(),
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.companyId !== undefined ? { companyId: input.companyId } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          })
          .where(eq(supportedBodies.id, id))
          .returning(SUPPORTED_BODY_COLUMNS);
        if (!body) return undefined;

        if (input.domainIds !== undefined) {
          // Full replace, not an add/remove diff — the join table only ever
          // holds a handful of rows per SupportedBody, so this stays simple
          // and atomic instead of computing a delta.
          await tx.delete(supportedBodyDomains).where(eq(supportedBodyDomains.supportedBodyId, id));
          await tx
            .insert(supportedBodyDomains)
            .values(input.domainIds.map((domainId) => ({ supportedBodyId: id, domainId })));

          // ContactOnSupportedBodyDomain (a Contact's domain *subset* for this
          // body) is a separate table with no FK back to
          // SupportedBodyOnDomain. Removing a domain here would otherwise
          // leave every linked Contact's subset referencing it — orphaned, and
          // still matched by domain search filters. Clean it up in the same
          // transaction.
          await tx
            .delete(contactSupportedBodyDomains)
            .where(
              and(
                eq(contactSupportedBodyDomains.supportedBodyId, id),
                notInArray(contactSupportedBodyDomains.domainId, input.domainIds),
              ),
            );
        }

        const domainIds = await this.loadDomainIds(tx, [id]);
        return { ...body, domainIds: domainIds.get(id) ?? [] };
      });

      if (!updated) {
        throw new NotFoundException({ code: "NOT_FOUND", message: "גוף נתמך לא נמצא" });
      }
      this.logger.log(`Updated supported body ${id}`);
      return updated;
    } catch (err) {
      if (isUniqueViolation(err) && input.companyId) throw await this.companyIdConflict(input.companyId);
      throw err;
    }
  }
}
