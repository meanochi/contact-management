import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";

interface ErrorBody {
  code?: string;
  message?: string;
  details?: unknown;
}

// Error envelope, applied globally in main.ts (ARCHITECTURE-SPINE.md AD-8).
// Never lets a raw exception (stack trace, Prisma error string) reach the
// client — the real error is logged server-side only, via Logger below.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : null;

    const { code, message, details }: ErrorBody =
      body && typeof body === "object" ? (body as ErrorBody) : {};

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    res.status(status).json({
      error: {
        code: code ?? "INTERNAL_ERROR",
        message: message ?? "Something went wrong",
        ...(details ? { details } : {}),
      },
    });
  }
}
