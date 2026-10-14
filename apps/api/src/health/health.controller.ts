import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { ApiErrorResponses, ApiZodResponse } from "../common/swagger/zod-openapi";
import { HealthService, type HealthReport } from "./health.service";

const healthReportSchema = z.object({
  status: z.literal("ok"),
  uptimeSeconds: z.number(),
  checks: z.record(z.string(), z.literal("up")).optional(),
});

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get("live")
  @ApiOperation({ summary: "Liveness probe — the process is running" })
  @ApiZodResponse(200, healthReportSchema, "The service is alive")
  live(): HealthReport {
    return this.healthService.live();
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness probe — the service and its database can serve traffic" })
  @ApiZodResponse(200, healthReportSchema, "The service is ready")
  @ApiErrorResponses(503)
  ready(): Promise<HealthReport> {
    return this.healthService.ready();
  }
}
