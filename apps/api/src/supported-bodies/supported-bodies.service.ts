import { Injectable, ConflictException, NotFoundException } from "@nestjs/common";
import { prisma, Prisma } from "@contact-management/db";
import type {
  CreateSupportedBodyInput,
  ListSupportedBodiesQuery,
  ListSupportedBodiesResult,
  SupportedBodyDto,
  UpdateSupportedBodyInput,
} from "@contact-management/shared-schemas/supported-bodies";

@Injectable()
export class SupportedBodiesService {
  // Story 1.4 — search (name/companyId) + domain filter + isActive filter,
  // paginated (UX-DR24, no infinite scroll). `select` stays focused per
  // expertise-postgres-prisma — not the full record with every relation.
  async list(query: ListSupportedBodiesQuery): Promise<ListSupportedBodiesResult> {
    const where: Prisma.SupportedBodyWhereInput = {
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { companyId: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(query.domainId ? { domains: { some: { domainId: query.domainId } } } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [rows, total] = await prisma.$transaction([
      prisma.supportedBody.findMany({
        where,
        select: {
          id: true,
          name: true,
          companyId: true,
          isActive: true,
          domains: { select: { domainId: true } },
        },
        orderBy: { name: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.supportedBody.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        companyId: r.companyId,
        isActive: r.isActive,
        domainIds: r.domains.map((d) => d.domainId),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async create(input: CreateSupportedBodyInput): Promise<SupportedBodyDto> {
    try {
      // Multi-model write (SupportedBody + N SupportedBodyOnDomain rows) —
      // wrapped explicitly so it's all-or-nothing, per expertise-postgres-prisma
      // "Making it atomic". Using `tx` (not the outer `prisma`) is what makes
      // each write's own audit row share this same transaction automatically.
      const created = await prisma.$transaction(async (tx) => {
        const body = await tx.supportedBody.create({
          data: { name: input.name, companyId: input.companyId },
        });
        await tx.supportedBodyOnDomain.createMany({
          data: input.domainIds.map((domainId: string) => ({ supportedBodyId: body.id, domainId })),
        });
        return body;
      });

      return { ...created, domainIds: input.domainIds };
    } catch (err) {
      // Translate the DB-level uniqueness violation (companyId @unique) into
      // the documented 409 envelope — never let a raw Prisma error surface
      // (expertise-api-rest "translate ORM errors at the Service layer").
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const existing = await prisma.supportedBody.findUnique({
          where: { companyId: input.companyId },
          select: { id: true, name: true },
        });
        throw new ConflictException({
          code: "CONFLICT",
          message: 'גוף נתמך עם ח"פ זה כבר קיים במערכת', // UX-DR18
          details: existing,
        });
      }
      throw err;
    }
  }

  // Story 1.3 — edit (name/companyId/domainIds) and deactivate (isActive:
  // false) both go through this one PATCH-backed method, same as the
  // project's Contact DELETE-via-PATCH rule (expertise-api-rest). Body +
  // its domain rows are updated together in one transaction so a failure
  // partway through can't leave domainIds out of sync with the body.
  async update(id: string, input: UpdateSupportedBodyInput): Promise<SupportedBodyDto> {
    try {
      return await prisma.$transaction(async (tx) => {
        const body = await tx.supportedBody.update({
          where: { id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.companyId !== undefined ? { companyId: input.companyId } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          },
        });

        if (input.domainIds !== undefined) {
          // Full replace, not an add/remove diff — the join table only ever
          // holds a handful of rows per SupportedBody, so this stays simple
          // and atomic instead of computing a delta.
          await tx.supportedBodyOnDomain.deleteMany({ where: { supportedBodyId: id } });
          await tx.supportedBodyOnDomain.createMany({
            data: input.domainIds.map((domainId: string) => ({ supportedBodyId: id, domainId })),
          });

          // Bug found by Rachel: ContactOnSupportedBodyDomain (a Contact's
          // domain *subset* for this body — post-1.6 revision) is a separate
          // table with no FK/cascade back to SupportedBodyOnDomain. Removing
          // a domain here left every Contact's subset still referencing it —
          // orphaned, and still matched by domainId search filters even
          // though the body itself no longer has that domain. Clean it up in
          // the same transaction, for every Contact linked to this body.
          await tx.contactOnSupportedBodyDomain.deleteMany({
            where: { supportedBodyId: id, domainId: { notIn: input.domainIds } },
          });
        }

        const domains = await tx.supportedBodyOnDomain.findMany({
          where: { supportedBodyId: id },
          select: { domainId: true },
        });

        return { ...body, domainIds: domains.map((d) => d.domainId) };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && input.companyId) {
        const existing = await prisma.supportedBody.findUnique({
          where: { companyId: input.companyId },
          select: { id: true, name: true },
        });
        throw new ConflictException({
          code: "CONFLICT",
          message: 'גוף נתמך עם ח"פ זה כבר קיים במערכת', // UX-DR18
          details: existing,
        });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new NotFoundException({ code: "NOT_FOUND", message: "גוף נתמך לא נמצא" });
      }
      throw err;
    }
  }
}
