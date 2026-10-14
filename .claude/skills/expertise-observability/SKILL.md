---
name: expertise-observability
description: 'Logging, tracing and OpenTelemetry conventions for apps/api in this project: the OTel SDK bootstrap (traces + logs, OTLP export), the Nest logger bridged to the OpenTelemetry Logs API, per-request entry/exit logging with trace ids, what to log in services and what never to log (personal data), log levels and env configuration. Use when adding or reviewing log statements, touching apps/api/src/telemetry/**, LoggingInterceptor or AllExceptionsFilter logging, adding instrumentation or spans, or wiring a collector. Not for endpoint/URL design (expertise-api-rest), query/transaction mechanics (expertise-postgres-drizzle), or test setup (expertise-testing).'
---

# Observability: Logging & OpenTelemetry (`apps/api`)

> Universal principles (simplicity, errors fail loudly in dev and never leak internals in prod) live in `expertise-code-quality`. This file covers what is specific to logs, traces and OpenTelemetry. Check `apps/api/package.json` for installed `@opentelemetry/*` versions before relying on API details — the OTel JS packages version independently (API 1.x, SDK/instrumentation 0.x, resources/semconv 2.x/1.x) and change often.

## Architecture in one paragraph

`main.ts` imports `./telemetry/instrumentation` **first** (right after `dotenv/config`). It starts the OpenTelemetry **NodeSDK** with a resource (`service.name`, version, environment), instrumentations for `http`, `express`, NestJS (`@nestjs/core`) and `pg`, a span processor and a log-record processor. The Nest application logger is replaced by `OtelLogger` (`telemetry/otel-logger.ts`): every `new Logger("X").log(...)` anywhere in the app — framework internals included — prints to stdout *and* is emitted as an OpenTelemetry **LogRecord** that automatically carries the active request's `trace_id`/`span_id`. If `OTEL_EXPORTER_OTLP_ENDPOINT` is set, traces and logs are shipped to that OTLP/HTTP collector; if not, nothing leaves the process but trace ids still exist locally, so every log line of a request can be correlated.

```
request ─► HttpInstrumentation span ─► Express/Nest spans ─► LoggingInterceptor ─► controller ─► service ─► pg span
                 │                                                   │                              │
                 └────── trace_id / span_id ◄────────────────────────┴──── OtelLogger (stdout + OTLP logs)
```

## Mandatory rules

1. **`./telemetry/instrumentation` must stay the first import after `dotenv/config` in `main.ts`.** OpenTelemetry patches `http`/`express`/`pg` as they are first `require`d; importing Nest, Express or `@contact-management/db` before it silently disables tracing for them.
2. **Log through Nest's `Logger`, one instance per class: `private readonly logger = new Logger(MyService.name)`.** Never `console.log` (the lint rule allows only `warn`/`error` for the few places outside Nest, such as `packages/db`'s pool error handler and `seed.ts`). Never import the OTel logs API directly in feature code — `OtelLogger` is the single bridge.
3. **Never log personal data or secrets.** No names, ID numbers (ת"ז), phone numbers, emails, notes, search terms, request bodies, query strings, tokens or connection strings. Log **ids and counts** (`contact c-123 linked to body b-9`). The `LoggingInterceptor` logs only the route *pattern* (`/contacts/:id`) for exactly this reason. If a message needs a value you're unsure about, leave it out.
4. **Every request gets an "entering" and a "leaving" line** from the global `LoggingInterceptor` (`--> GET /contacts`, `<-- GET /contacts 200 12ms`). Controllers and services don't repeat them. The interceptor also returns the `x-trace-id` response header so a user report can be matched to the server's logs and trace.
5. **Every error path is logged exactly once, at the right level**, by whoever owns the outcome:
   - Unexpected exception → `AllExceptionsFilter` logs `error` with the stack, and returns a generic 500. Don't `catch` just to log and rethrow.
   - Expected client error (4xx) → `AllExceptionsFilter` logs `warn` with the status and `code` only (never the body — it may echo user input).
   - A service refusing something deliberately (domain not in body, last link removal, duplicate link/companyId) logs `warn` where the decision is made, in addition to throwing.
6. **Don't swallow errors to keep logs clean**, and don't log-and-throw the same error at several layers (duplicate noise in the same trace).
7. **Health probes are quiet:** requests to `/health/*` are logged at `debug` and excluded from HTTP tracing, so orchestrator polling never buries real traffic.

## When logging is required (this is not optional)

`AGENTS.md` makes this skill mandatory for any operation you add or change in `apps/api` or runtime code in `packages/db`, the same way `expertise-testing` is mandatory for tests. Concretely, a change is **not done** until each of these holds:

- **New endpoint** → covered by `LoggingInterceptor` automatically (don't duplicate it), and its service method logs the business outcome.
- **New or changed service method that writes data or makes a decision** → logs the successful change (`log`) and every deliberate refusal/conflict (`warn`) where the decision is made.
- **New error path** (a thrown `HttpException` subclass, a caught-and-translated driver error) → the refusal is logged once at the point of decision, or left to `AllExceptionsFilter`; never silently swallowed, never logged at several layers.
- **New background/scheduled job, consumer, startup or shutdown hook** → logs start, end/outcome and failure through `Logger`, inside its own span.
- **New dependency or external call** → its failure is logged at `error` with the real cause (server-side only), and it is instrumented or wrapped in a manual span.
- **Any new log line** → ids and counts only; reviewed against the personal-data rule below; covered by a test where the log is the behavior (a refusal, a privacy guarantee).

Pure reads (list/get) need no extra log line beyond the interceptor's.

## What to log in application code

| Where | Level | Example (ids only) |
|---|---|---|
| Service, successful state change | `log` | `Created contact <id> linked to supported body <id>`; `Deactivated contact <id> (external request via PHONE)`; `Updated supported body <id>` |
| Service, deliberate refusal / conflict | `warn` | `Refused to remove the last supported body link of contact <id>`; `Supported body with company id <id> already exists` |
| Reads (list/get) | none, or `debug` | the interceptor already records the request and its duration |
| Dependency failure | `error` (with stack) | the readiness check logs `database is down (<driver message>)`; the pool logs idle-client errors |
| Startup / shutdown | `log` | `Bootstrap`: port and URLs; `AppLifecycle`: `Shutting down on SIGTERM` |
| Fine-grained diagnostics | `debug` / `verbose` | off by default in production (`LOG_LEVEL`) |

Levels: `verbose` < `debug` < `log` (INFO) < `warn` < `error` < `fatal`. They map to OTel severity TRACE/DEBUG/INFO/WARN/ERROR/FATAL. A background job, scheduled task or message consumer (none yet) must open its own span and log through the same `Logger` — there is no request context to inherit.

## Spans

Auto-instrumentation already produces a span per HTTP request, Express middleware/router, Nest handler and `pg` query, which covers most needs. Add a manual span only for a unit of work that deserves its own latency/error visibility and isn't one of those (an external API call, a long batch step):

```ts
import { trace, SpanStatusCode } from "@opentelemetry/api";
const tracer = trace.getTracer("contact-management-api");

await tracer.startActiveSpan("registration.sendNotification", async (span) => {
  try {
    span.setAttribute("contact.id", contactId); // ids only — same no-personal-data rule
    await send();
  } catch (err) {
    span.recordException(err as Error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw err;
  } finally {
    span.end();
  }
});
```

Custom spans/attributes must follow the same personal-data rule as logs.

## Configuration (env vars in `apps/api/.env`)

| Variable | Default | Effect |
|---|---|---|
| `LOG_LEVEL` | `debug` | minimum level printed and emitted (`verbose`, `debug`, `info`, `warn`, `error`) — use `info` or `warn` in production |
| `LOG_FORMAT` | text | `json` → one JSON object per line on stdout (use in containers/log shippers) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | unset | e.g. `http://localhost:4318`. Set → traces + logs (+ metrics, SDK default) exported via OTLP/HTTP. Unset → no export, no network traffic |
| `OTEL_SERVICE_NAME` | `contact-management-api` | `service.name` resource attribute |
| `OTEL_SDK_DISABLED` | unset | `true` → SDK not started (no tracing, trace ids absent from logs) |
| `NODE_ENV` | — | recorded as `deployment.environment.name`; also switches Swagger off in `production` |

Standard `OTEL_*` variables (`OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_TRACES_SAMPLER`, …) are honoured by the SDK/exporters. To try it locally, run any OTLP collector on `:4318` (OpenTelemetry Collector, Jaeger all-in-one, Grafana LGTM) and set the endpoint.

## Shutdown

`app.enableShutdownHooks()` + `AppLifecycle.onApplicationShutdown` closes the DB pool and then calls `shutdownTelemetry()` so buffered spans/logs are flushed on SIGTERM/SIGINT. A hard kill (`kill -9`, `taskkill /F`) loses up to a few seconds of batched telemetry — expected.

## Testing

- `LoggingInterceptor` and `AllExceptionsFilter` are unit-tested by spying on `Logger.prototype.log|warn|error|debug` — assert on the message (route pattern, status, code) **and** that personal data (query string, body) is absent. Copy that pattern for new logging behaviour.
- In any spec that exercises code which logs, silence the noise: `jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined)` (and `warn`/`error`).
- Don't assert on exact timings; match `\d+ms`.
- To verify export for real: run a collector (or a 10-line HTTP sink on `:4318`), start the API with `OTEL_EXPORTER_OTLP_ENDPOINT` set, make a request, and expect `POST /v1/traces` and `POST /v1/logs` (batches flush within ~5 s).

## Before you finish

- [ ] New log lines use the class's `Logger` and contain only ids/counts — no personal data, no raw error from the driver in a client-facing message.
- [ ] State changes log `log`, deliberate refusals log `warn`, no log-and-rethrow duplicates.
- [ ] Nothing was imported before `./telemetry/instrumentation` in `main.ts`.
- [ ] New env var documented in `apps/api/.env.example` and in the table above.
- [ ] A new long-running or external operation has either an auto-instrumented span or a manual one.
