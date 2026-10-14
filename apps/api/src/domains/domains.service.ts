import { Injectable } from "@nestjs/common";
import { asc, db, domains, eq } from "@contact-management/db";
import type { DomainDto } from "@contact-management/shared-schemas/domains";

@Injectable()
export class DomainsService {
  async listActive(): Promise<DomainDto[]> {
    return db
      .select({ id: domains.id, name: domains.name, isActive: domains.isActive })
      .from(domains)
      .where(eq(domains.isActive, true))
      .orderBy(asc(domains.name));
  }
}
