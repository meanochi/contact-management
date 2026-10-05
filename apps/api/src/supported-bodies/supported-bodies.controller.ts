import { Controller, Get, Post, Patch, Body, Query, Param } from "@nestjs/common";
import { JoiValidationPipe } from "../common/pipes/joi-validation.pipe";
import {
  createSupportedBodySchema,
  listSupportedBodiesQuerySchema,
  updateSupportedBodySchema,
} from "@contact-management/shared-schemas/supported-bodies";
import type {
  CreateSupportedBodyInput,
  ListSupportedBodiesQuery,
  UpdateSupportedBodyInput,
} from "@contact-management/shared-schemas/supported-bodies";
import { SupportedBodiesService } from "./supported-bodies.service";

@Controller("supported-bodies")
export class SupportedBodiesController {
  constructor(private readonly supportedBodiesService: SupportedBodiesService) {}

  @Get()
  async list(@Query(new JoiValidationPipe(listSupportedBodiesQuerySchema)) query: ListSupportedBodiesQuery) {
    const result = await this.supportedBodiesService.list(query);
    // Shaped explicitly as {data, meta} here — ResponseInterceptor passes
    // through anything that already has a `data` key instead of re-wrapping it.
    return { data: result.items, meta: { total: result.total, page: result.page, pageSize: result.pageSize } };
  }

  @Post()
  create(@Body(new JoiValidationPipe(createSupportedBodySchema)) body: CreateSupportedBodyInput) {
    return this.supportedBodiesService.create(body);
  }

  // Story 1.3 — edit and deactivate both go through here (deactivate just
  // sends { isActive: false }), same as the project's Contact
  // DELETE-via-PATCH rule (expertise-api-rest).
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new JoiValidationPipe(updateSupportedBodySchema)) body: UpdateSupportedBodyInput,
  ) {
    return this.supportedBodiesService.update(id, body);
  }
}
