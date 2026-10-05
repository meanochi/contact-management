import { Controller, Post, Body } from "@nestjs/common";
import { JoiValidationPipe } from "../common/pipes/joi-validation.pipe";
import { createSupportedBodySchema } from "@contact-management/shared-schemas/supported-bodies";
import type { CreateSupportedBodyInput } from "@contact-management/shared-schemas/supported-bodies";
import { SupportedBodiesService } from "./supported-bodies.service";

@Controller("supported-bodies")
export class SupportedBodiesController {
  constructor(private readonly supportedBodiesService: SupportedBodiesService) {}

  @Post()
  create(@Body(new JoiValidationPipe(createSupportedBodySchema)) body: CreateSupportedBodyInput) {
    return this.supportedBodiesService.create(body);
  }
}
