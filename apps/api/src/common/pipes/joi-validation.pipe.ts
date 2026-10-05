import { PipeTransform, Injectable, BadRequestException } from "@nestjs/common";
import type Joi from "joi";

// Shared across every mutating endpoint (expertise-api-rest) — wraps the same
// Joi schema apps/web's React Hook Form validates with. Never a hand-called
// schema.validate(...) inside a controller/service.
@Injectable()
export class JoiValidationPipe implements PipeTransform {
  constructor(private readonly schema: Joi.ObjectSchema) {}

  transform(value: unknown) {
    const { value: validated, error } = this.schema.validate(value, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Request failed validation",
        details: error.details.map((d) => ({ field: d.path.join("."), message: d.message })),
      });
    }
    return validated;
  }
}
