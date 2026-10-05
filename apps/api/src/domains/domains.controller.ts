import { Controller, Get } from "@nestjs/common";
import { DomainsService } from "./domains.service";

@Controller("domains")
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  // GET /domains — read-only lookup for pickers (Story 1.2), active domains
  // only. No create/edit/delete — no domain management screen in Epic 1.
  @Get()
  list() {
    return this.domainsService.listActive();
  }
}
