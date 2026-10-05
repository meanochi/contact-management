import { Injectable } from "@nestjs/common";
import { prisma } from "@contact-management/db";
import type { DomainDto } from "@contact-management/shared-schemas/domains";

@Injectable()
export class DomainsService {
  async listActive(): Promise<DomainDto[]> {
    return prisma.domain.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, isActive: true },
    });
  }
}
