import { CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import type { Request, Response } from "express";
import { Observable, tap } from "rxjs";
import { activeTraceId } from "../../telemetry/active-trace-id";

// Route patterns that are polled constantly (probes) — logged at debug so they
// don't drown real traffic.
const QUIET_ROUTE_PREFIXES = ["/health"];

// One "entering" and one "leaving" log line per request, applied globally in
// main.ts. Logs the route *pattern* (/contacts/:id) and never the raw URL or
// body: query strings carry search terms (people's names) and bodies carry
// ID numbers, phones and emails — none of that belongs in logs.
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const route = `${req.method} ${(req.route as { path?: string } | undefined)?.path ?? req.path}`;
    const quiet = QUIET_ROUTE_PREFIXES.some((prefix) => req.path.startsWith(prefix));
    const write = (message: string, level: "log" | "warn" = "log") =>
      quiet ? this.logger.debug(message) : this.logger[level](message);

    // Lets a user or support quote one id that finds every log line and span of a request.
    const traceId = activeTraceId();
    if (traceId) res.setHeader("x-trace-id", traceId);

    const startedAt = Date.now();
    write(`--> ${route}`);

    return next.handle().pipe(
      tap({
        next: () => write(`<-- ${route} ${res.statusCode} ${Date.now() - startedAt}ms`),
        // 5xx is logged with its stack by AllExceptionsFilter; this line only
        // records that the request ended and how.
        error: (err: unknown) => {
          const status = err instanceof HttpException ? err.getStatus() : 500;
          write(`<-- ${route} ${status} ${Date.now() - startedAt}ms`, status >= 500 ? "warn" : "log");
        },
      }),
    );
  }
}
