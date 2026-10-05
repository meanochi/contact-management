import { Injectable, ConflictException } from "@nestjs/common";
import { prisma, Prisma } from "@contact-management/db";
import type {
  CreateSupportedBodyInput,
  SupportedBodyDto,
} from "@contact-management/shared-schemas/supported-bodies";

@Injectable()
export class SupportedBodiesService {
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
}
