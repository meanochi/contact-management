import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { domainSchema } from "@contact-management/shared-schemas/domains";
import { z } from "zod";
import { ApiZodResponse } from "../common/swagger/zod-openapi";
import { DomainsService } from "./domains.service";

@ApiTags("Domains")
@Controller("domains")
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  // GET /domains — read-only lookup for pickers (Story 1.2), active domains
  // only. No create/edit/delete — no domain management screen in Epic 1.
  @Get()
  @ApiOperation({ summary: "List active domains (read-only lookup for pickers)" })
  @ApiZodResponse(200, z.array(domainSchema), "Active domains, ordered by name")
  list() {
    return this.domainsService.listActive();
  }
}
