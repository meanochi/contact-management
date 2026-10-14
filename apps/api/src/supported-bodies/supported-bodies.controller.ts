import { Controller, Get, Post, Patch, Body, Query, Param } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import {
  ApiErrorResponses,
  ApiZodBody,
  ApiZodListResponse,
  ApiZodQuery,
  ApiZodResponse,
} from "../common/swagger/zod-openapi";
import {
  createSupportedBodySchema,
  listSupportedBodiesQuerySchema,
  supportedBodySchema,
  updateSupportedBodySchema,
} from "@contact-management/shared-schemas/supported-bodies";
import type {
  CreateSupportedBodyInput,
  ListSupportedBodiesQuery,
  UpdateSupportedBodyInput,
} from "@contact-management/shared-schemas/supported-bodies";
import { SupportedBodiesService } from "./supported-bodies.service";

@ApiTags("Supported bodies")
@Controller("supported-bodies")
export class SupportedBodiesController {
  constructor(private readonly supportedBodiesService: SupportedBodiesService) {}

  @Get()
  @ApiOperation({ summary: "List supported bodies, paginated" })
  @ApiZodQuery(listSupportedBodiesQuerySchema)
  @ApiZodListResponse(supportedBodySchema, "A page of supported bodies")
  @ApiErrorResponses(400)
  async list(@Query(new ZodValidationPipe(listSupportedBodiesQuerySchema)) query: ListSupportedBodiesQuery) {
    const result = await this.supportedBodiesService.list(query);
    // Shaped explicitly as {data, meta} here — ResponseInterceptor passes
    // through anything that already has a `data` key instead of re-wrapping it.
    return { data: result.items, meta: { total: result.total, page: result.page, pageSize: result.pageSize } };
  }

  @Post()
  @ApiOperation({ summary: "Create a supported body (company id must be unique)" })
  @ApiZodBody(createSupportedBodySchema)
  @ApiZodResponse(201, supportedBodySchema, "The created supported body")
  @ApiErrorResponses(400, 409)
  create(@Body(new ZodValidationPipe(createSupportedBodySchema)) body: CreateSupportedBodyInput) {
    return this.supportedBodiesService.create(body);
  }

  // Story 1.3 — edit and deactivate both go through here (deactivate just
  // sends { isActive: false }), same as the project's Contact
  // DELETE-via-PATCH rule (expertise-api-rest).
  @Patch(":id")
  @ApiOperation({ summary: "Partially update a supported body; send { isActive: false } to deactivate" })
  @ApiZodBody(updateSupportedBodySchema)
  @ApiZodResponse(200, supportedBodySchema, "The updated supported body")
  @ApiErrorResponses(400, 404, 409)
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateSupportedBodySchema)) body: UpdateSupportedBodyInput,
  ) {
    return this.supportedBodiesService.update(id, body);
  }
}
