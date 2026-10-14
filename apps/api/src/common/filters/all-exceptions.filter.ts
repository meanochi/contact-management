import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";

// The client shows error.message to the user, who reads Hebrew only. A
// deliberate error (a service or the validation pipe: it carries a `code`)
// brings its own Hebrew message; anything else — an unexpected exception, or a
// framework HttpException such as the router's English "Cannot GET /x" — gets
// a generic Hebrew message chosen by status, so no English text or internal
// detail ever reaches the client.
const GENERIC_MESSAGE = "אירעה שגיאה בלתי צפויה — נסו שוב בעוד רגע";
const MESSAGE_BY_STATUS: Record<number, string> = {
  400: "הבקשה אינה תקינה",
  404: "המשאב המבוקש לא נמצא",
  429: "בוצעו יותר מדי בקשות — נסו שוב בעוד מספר דקות",
  503: "השירות אינו זמין כרגע — נסו שוב בעוד רגע",
};

const CODE_BY_STATUS: Record<number, string> = {
  400: "BAD_REQUEST",
  404: "NOT_FOUND",
  429: "RATE_LIMITED",
  503: "SERVICE_UNAVAILABLE",
};

interface ErrorBody {
  code?: string;
  message?: string;
  details?: unknown;
}

// Error envelope, applied globally in main.ts (ARCHITECTURE-SPINE.md AD-8).
// Never lets a raw exception (stack trace, driver error string) reach the
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
      this.logger.error(
        exception instanceof Error ? `Unhandled exception: ${describeError(exception)}` : "Unhandled non-Error exception",
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      // Expected client errors (validation, not found, conflict): only the
      // stable code is logged, never the body, which can echo user input.
      this.logger.warn(`Request rejected with ${status} ${code ?? "UNKNOWN"}`);
    }

    res.status(status).json({
      error: {
        code: code ?? CODE_BY_STATUS[status] ?? "INTERNAL_ERROR",
        message: code && message ? message : (MESSAGE_BY_STATUS[status] ?? GENERIC_MESSAGE),
        ...(details ? { details } : {}),
      },
    });
  }
}

// Drizzle wraps the driver error ("Failed query: …") and keeps the real reason
// (e.g. a NOT NULL violation) in `cause`; without it the log only says "Failed query".
function describeError(error: Error): string {
  const cause = error.cause instanceof Error ? ` — caused by: ${error.cause.message}` : "";
  return error.message + cause;
}
