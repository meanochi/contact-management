import { PipeTransform, Injectable, BadRequestException } from "@nestjs/common";
import type { ZodType } from "zod";

// Shared across every endpoint that takes a body or query (expertise-api-rest)
// — wraps the same Zod schema apps/web's React Hook Form validates with.
// Never a hand-called schema.parse(...) inside a controller/service. Zod
// object schemas strip unknown keys by default, so they never reach a service.
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "הנתונים שהוזנו אינם תקינים",
        details: result.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
      });
    }
    return result.data;
  }
}
