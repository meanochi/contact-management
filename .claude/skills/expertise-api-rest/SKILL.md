---
name: expertise-api-rest
description: 'REST API design conventions for the NestJS backend in this project (apps/api/src/**): URL and method design, action-endpoint decisions, Zod validation via a shared Pipe, the success/error response envelope via Interceptors/Filters, OpenAPI/Swagger generated from the Zod schemas, health/readiness probes, versioning, and rate limiting. Use when creating or reviewing any controller/service/module under apps/api, or discussing URL/method/status-code design for a CRUD or action endpoint, error/response envelope shape, Swagger documentation, health checks, API versioning, or rate limiting the public registration endpoint. Not for apps/web/React code (see expertise-react-nextjs), not for Drizzle query/transaction/soft-delete mechanics (see expertise-postgres-drizzle), and not for logging/tracing setup (see expertise-observability).'
---

# REST API Design Conventions (NestJS — `apps/api`)

> `apps/web` (Next.js) and `apps/api` (NestJS) are separate applications (`ARCHITECTURE-SPINE.md` AD-1). This file covers everything under `apps/api/src/**`: the REST surface that `apps/web`'s RTK Query calls, that the public registration form will submit to, and that Swagger UI documents. Resource-oriented URLs, HTTP semantics, one validation choke point and one response envelope are stable project conventions; exact package versions (`@nestjs/swagger`, `@nestjs/throttler`, `zod`) are worth re-checking in `apps/api/package.json`.

## Scope

Universal code-quality principles live in `expertise-code-quality`. This skill governs controllers, services, modules, pipes, filters, interceptors, Swagger setup and health probes. It does **not** cover:
- `apps/web`/React code or how `apps/web` calls this API — `expertise-react-nextjs`.
- Drizzle queries, transactions, soft delete, migrations — `expertise-postgres-drizzle`.
- Node/TypeScript conventions and the Zod schema/type pairing — `expertise-nodejs-typescript`.
- Logging, tracing and OpenTelemetry — `expertise-observability`.

The code under `apps/api/src/` (`contacts/`, `supported-bodies/`, `domains/`, `health/`, `common/`) is the reference implementation; **read a sibling resource before adding another.** If it has evolved past what is written here, the code wins — say so and update this file.

**Things every endpoint already gets "for free" — don't reimplement them:**
- Request entry/exit logging with trace id (`LoggingInterceptor`, global) and error logging (`AllExceptionsFilter`). Add *business-event* logs in the service (see `expertise-observability`), not a second request log.
- Success envelope (`ResponseInterceptor`) and error envelope (`AllExceptionsFilter`).
- CORS, enabled once in `main.ts` (AD-12).
- Domain-scoped authorization via a global NestJS Guard (`APP_GUARD`, AD-4) — **not built yet** (no auth in Epic 1). When it lands, never duplicate its check inside a controller; add only resource-level checks it can't express, with a comment saying why.
- **Not free:** automatic audit logging. It is currently inactive (see `expertise-postgres-drizzle` → Audit trail); don't write "audited automatically" in code or docs.

## File layout and the module/controller/service trio

Every resource is its own NestJS module directly under `apps/api/src/<resource>/`, not wrapped in a `routes/` folder:

```
apps/api/src/contacts/
  contacts.module.ts       # registers controller + service with Nest DI — required
  contacts.controller.ts   # API layer — thin: parse, validate (Pipe), call the service, respond
  contacts.service.ts      # Service/Domain layer — the only code allowed to call packages/db
  contacts.service.spec.ts # co-located tests (expertise-testing)
```

- Import the module in `app.module.ts`; a resource whose files exist but whose module isn't imported is invisible to the running app.
- Routes are declared with decorators (`@Controller('contacts')`, `@Get()`, `@Patch(':id')`); there is no separate routes registry.
- Controller method body = parse → validate (Pipe) → one service call → return. Business rules and DB access belong in the service.

```ts
// apps/api/src/supported-bodies/supported-bodies.controller.ts (shape to copy)
@ApiTags("Supported bodies")
@Controller("supported-bodies")
export class SupportedBodiesController {
  constructor(private readonly supportedBodiesService: SupportedBodiesService) {}

  @Post()
  @ApiOperation({ summary: "Create a supported body (company id must be unique)" })
  @ApiZodBody(createSupportedBodySchema)
  @ApiZodResponse(201, supportedBodySchema, "The created supported body")
  @ApiErrorResponses(400, 409)
  create(@Body(new ZodValidationPipe(createSupportedBodySchema)) body: CreateSupportedBodyInput) {
    return this.supportedBodiesService.create(body);
  }
}
```

Services import `db` and the table objects from `@contact-management/db` (see `expertise-postgres-drizzle`).

## URL + HTTP method conventions

### Plain CRUD resources

| Resource | Collection | Item |
|---|---|---|
| Domain | `GET /domains` (read-only lookup today) | — |
| SupportedBody | `GET/POST /supported-bodies` | `PATCH /supported-bodies/:id` |
| Contact | `GET /contacts?supportedBodyId=&domainId=&includeInactive=`, `POST /contacts` | `PATCH /contacts/:id` |
| RegistrationRequest (future, Epic 2) | `GET /registration-requests` (internal), `POST /registration-requests` (**public, unauthenticated** — see Rate limiting) | `GET /registration-requests/:id` |

(No `/api` prefix and no `/v1` — see Versioning.)

**Contact is never hard-deleted.** There is no `DELETE /contacts/:id`; deactivation is the action endpoint `POST /contacts/:id/deactivate` (requires the documented external-request source + date) and `POST /contacts/:id/activate` undoes it. Both respond with the updated contact, not `204`, because the client needs the resulting state.

### Action endpoints (non-CRUD business actions) — the decision rule

Ask: **does this action have its own lifecycle, side effects, or a rejection reason beyond simple validation?**

- **Yes → verb-shaped `POST` sub-route.** Already built: `POST /contacts/:id/deactivate` (a deliberate state transition with mandatory documentation). Planned for Epic 2 — approving/rejecting a registration request has side effects (creates Contact/SupportedBody records, is a one-way state transition, guarded by rules like "can't approve twice"):
  - `POST /registration-requests/:id/approve` → `200` + updated request (and/or created Contact); `409 Conflict` if not currently `PENDING`.
  - `POST /registration-requests/:id/reject` with `{ reason: string }` → same status-code rules.
  - `POST /registration-requests/:id/request-info` (FR-16's third action, "request completion") → `200` + updated request; sets `infoRequestedAt` and re-notifies the submitter (FR-18) — status stays `PENDING`, this isn't a terminal transition.
  - `POST /registration-requests/:id/assign-body` with `{ supportedBodyId }` → `200` + updated request; covers the unmatched-ח"פ edge case (FR-14/FR-15), where a coordinator/admin either picks an existing `SupportedBody` or first `POST`s a new one via the plain CRUD route and then calls this with its id.
  - `POST`, not `PUT`, because a second call is a conflict, not an idempotent no-op.
- **No → a field or relationship change** → `PATCH` on the resource, or `POST`/`PATCH`/`PUT`/`DELETE` on a sub-collection of an owned relation. Already built: `POST /contacts/:id/supported-bodies` (add a link; re-adding is `409`), `PATCH /contacts/:id/supported-bodies/:supportedBodyId` (replace that link's domain subset), `DELETE /contacts/:id/supported-bodies/:supportedBodyId` (remove; the last remaining link is `409`). Planned example — assigning a coordinator to a domain is relationship-setting (validate the coordinator exists and has the right role, nothing more) and idempotent. A domain can have more than one coordinator (FR-2), so this is a sub-collection, not a single field:
  - `PUT /domains/:id/coordinators/:coordinatorId` → assign, `200` + updated domain. Calling it again with the same id is a no-op returning the same result.
  - `DELETE /domains/:id/coordinators/:coordinatorId` → unassign that one coordinator, `200` + updated domain (not `204`).
  - Don't fold this into `PATCH /domains/:id { coordinatorId }` — that forces the generic domain `PATCH` to special-case authorization for one field ("only an admin may reassign a coordinator" vs. "a coordinator may edit their own domain's name"), and can't express more than one coordinator anyway. A dedicated sub-resource route keeps that explicit instead of hidden inside a conditional.

Apply this test before inventing a new action-endpoint shape — don't add a third shape without a reason. **If a method claims idempotency, prove it, don't assume it from the verb:** `PUT`/`DELETE` handlers must genuinely return the same result on a retried call with the same input (e.g. `PUT .../coordinators/:id` twice, or `DELETE` on something already removed) — no duplicate side effect, no error on the second call. If a handler named `PUT`/`DELETE` can't satisfy that, it's mismodeled as an action endpoint, not a case to special-case around.

## Validation: one shared Zod Pipe

**Project rule: every endpoint that takes a body or query validates it through the shared `ZodValidationPipe` — never a hand-called `schema.parse(...)` in a controller or service.** The schema is the one in `packages/shared-schemas` that `apps/web`'s React Hook Form uses (`zodResolver`); never a second API-only copy.

```ts
// apps/api/src/common/pipes/zod-validation.pipe.ts (the real implementation)
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}
  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Request failed validation",
        details: result.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      });
    }
    return result.data;
  }
}
```

- `safeParse` reports every failing field in one pass (what RHF's `setError` needs). Unknown keys are stripped by `z.object` by default, so a stray `isAdmin: true` never reaches a service.
- Validate query strings the same way (`@Query(new ZodValidationPipe(listXQuerySchema))`). Query values arrive as strings: use `z.coerce.number()` for numbers and **`z.stringbool()` for booleans** — `z.coerce.boolean()` turns `"false"` into `true`.
- Defaults live in the schema (`page` → 1, `pageSize` → 20), so the service always receives a complete object. Use `z.output<typeof schema>` types in services, `z.input` for what a form sends.
- Rules the schema cannot know (a domain subset must belong to the chosen body, a uniqueness check) are enforced in the service and thrown as `BadRequestException`/`ConflictException` with the same `{ code, message, details }` shape.
- A "patch" schema that requires at least one field uses `.refine(...)`; the error then has `field: ""`.

## One response envelope, success and error

**Project rule: every response goes through the global `ResponseInterceptor` (success) and `AllExceptionsFilter` (error) registered once in `main.ts` — never an ad hoc shape from a controller, never `200` with `{ success: false }`.**

Success: `{ "data": … }`; list endpoints return `{ data, meta: { total, page, pageSize } }` themselves (the interceptor passes anything that already has a `data` key through). Error:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Request failed validation",
             "details": [{ "field": "emails.0", "message": "Invalid email address" }] } }
```

- **`error.message` is shown to the user, so it is always Hebrew** (the users do not read English). Deliberate errors (a service's `NotFoundException`/`ConflictException`/`BadRequestException`, the validation pipe) carry a `code` and their own Hebrew message — write the message for a person, not a developer. Anything without a `code` — an unexpected exception or a framework `HttpException` such as the router's "Cannot GET /x" — is replaced by `AllExceptionsFilter` with a generic Hebrew message chosen by status (and a `code` derived from the status), so no English or internal text can leak. Per-field `details[].message` come from the shared Zod schemas (Hebrew, see `expertise-nodejs-typescript`). Health-probe bodies are for machines, not people, and may stay English. Log lines are for developers and stay English.
- `error.code` is a stable discriminant (`VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`, later `FORBIDDEN`, `RATE_LIMITED`); `error.details[].field/message` maps onto RHF's `setError`.
- Status codes: `200` read/update, `201` create (Nest's `POST` default — the deactivate/activate actions return `201` too), `400` validation, `401/403` auth (future), `404` not found — including, once scoping exists, a record outside the caller's domain (never `403`, so existence isn't revealed), `409` conflict/illegal transition, `429` rate-limited, `503` not ready, `500` unexpected.
- **Translate DB errors in the service**: `isUniqueViolation(err)` → `ConflictException({ code: "CONFLICT", message, details? })`; an empty `returning`/`select` → `NotFoundException({ code: "NOT_FOUND", … })`. Anything else is rethrown; the filter turns it into a generic `500 INTERNAL_ERROR`, logs the real error + stack server-side, and sends nothing internal to the client. User-facing messages are Hebrew.
- **Recommendation, not adopted now:** RFC 9457 Problem Details is the current IETF-standard error shape. This app's custom envelope is purpose-built for RHF/RTK Query instead, which Problem Details doesn't give you for free. If this API ever needs to interoperate with external Problem-Details-aware tooling, that's a thin mapping layer (`code`→`type`, `message`→`title`/`detail`), not a redesign — don't adopt it speculatively now.

## OpenAPI / Swagger — generated from the Zod schemas

**Project rule: annotate every controller method as you write it, using the helpers in `apps/api/src/common/swagger/zod-openapi.ts` — never hand-written `@ApiProperty` DTO classes.** The docs are produced from the very Zod schemas that validate and type the data, so they cannot drift.

| Helper | Use |
|---|---|
| `@ApiTags("…")`, `@ApiOperation({ summary })` | on the controller / each method (from `@nestjs/swagger`) |
| `@ApiZodBody(schema)` | request body, from the *input* side of the schema |
| `@ApiZodQuery(schema)` | expands a flat query schema into one documented parameter per field (types from the output side, `required` from the input side) |
| `@ApiZodResponse(status, schema, description)` | success response wrapped in `{ data }` |
| `@ApiZodListResponse(itemSchema, description)` | `{ data: [...], meta: { total, page, pageSize } }` |
| `@ApiErrorResponses(400, 404, 409, …)` | documents the shared error envelope for those statuses |

- **Response schemas** (`contactSchema`, `supportedBodySchema`, `domainSchema`) live next to the input schemas in `packages/shared-schemas`, and the DTO type is `z.output` of them — one definition for type, validation and docs. A service's declared return type should be that DTO.
- Path params (`@Param("id")`) are picked up automatically; `refine`/`transform` can't be expressed in JSON Schema and document as open — describe the rule in `@ApiOperation({ description })` when it matters (e.g. "the last link cannot be removed").
- Setup lives in `common/swagger/setup-swagger.ts`, called from `main.ts`: UI at **`/docs`**, raw OpenAPI at **`/docs/json`**. On by default; off when `NODE_ENV=production` unless `SWAGGER_ENABLED=true`.
- After adding an endpoint, open `/docs/json` (or `/docs`) and confirm the route, parameters and responses appear.

## Health and readiness probes

`GET /health/live` and `GET /health/ready` (`apps/api/src/health/`, tag **Health**):

- **`live`** — the process answers; touches no dependency (a database outage must not get the process killed/restarted). Returns `200 { data: { status: "ok", uptimeSeconds } }`.
- **`ready`** — the service can serve traffic: runs `pingDatabase()` (`select 1`) with a 2 s timeout. `200` with `checks: { database: "up" }`, or `503 { error: { code: "SERVICE_UNAVAILABLE", details: { database: "down" } } }` — the underlying driver error is logged, never returned.
- Both are public (exempt from the future auth Guard — add that exemption when the Guard is written), quiet in the logs (debug level), and not traced. Point orchestrator liveness/readiness probes and load balancers at them.
- A new hard dependency (cache, queue, external API) adds its own check to `ready` only if the service genuinely cannot work without it — keep each check cheap and time-bounded.

## Versioning: no `/v1` prefix yet

*Recommendation.* This API's only consumers today are `apps/web` plus one public, fixed-contract form endpoint — no external consumer an in-place change could break. Evolve in place (add optional fields, add endpoints, deprecate fields with a grep-able TODO) rather than maintaining parallel version trees for no current benefit. (NestJS has built-in URI/header/media-type versioning via `app.enableVersioning(...)` whenever this is actually needed — don't wire it up speculatively.)

**Add versioning when any one of these becomes true** (check against this list rather than re-deciding from scratch each time):
1. A consumer outside this team starts calling the API directly.
2. A breaking change is needed while a client that can't update same-day still depends on the old shape.
3. The API itself becomes an intentionally supported product surface, not just `apps/web`'s own plumbing.

## Rate limiting the public registration endpoint

*Project rule:* `POST /registration-requests` is the one genuinely public, unauthenticated route and needs abuse protection regardless of hosting. Not built yet — Epic 2.

*Recommendation:* `@nestjs/throttler` — NestJS-native, Guard-based rate limiting, storage-backed so it survives multiple instances/replicas (configure a shared store, e.g. Redis, once more than one `apps/api` instance runs — don't rely on the in-memory default past a single instance).

```ts
// apps/api/src/registration-requests/registration-requests.module.ts
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 600_000, limit: 5 }])], // 5 requests / 10 min — tune once real spam patterns are observed
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class RegistrationRequestsModule {}
```

- Scope the Throttler Guard to this module/route, not globally alongside the AD-4 authorization Guard — it's specific to this one public endpoint, not the cross-cutting authorization concern.
- If the registration form later needs bot/email-quality checks too, evaluate a dedicated abuse-protection SDK before stacking separate libraries. A Postgres-table counter is a reasonable no-new-infra fallback if a shared store is unwanted; don't build that speculatively now.
- A throttled request must come back in the standard error envelope with code `RATE_LIMITED` and status `429`, and is logged at `warn` like any other rejection.

## Code quality for API endpoints

- **Keep controllers thin.** A controller method's body should read as parse → validate (via Pipe/decorator) → call one service method → return. Business logic (a state-machine transition, a domain-scope calculation) belongs in the service, per the layer separation `expertise-code-quality` defines.
- **Don't over-fetch in the response.** A service's return value should carry what the calling screen actually needs (explicit column projections), not the full object graph with every relation included by default — an unused nested include is extra payload and an accidental data exposure both at once.
- **Idempotency claims must hold** (see the action-endpoint section): a retried `PUT`/`DELETE` returns the same result with no duplicate side effect.
- Log meaningful business events in the service at `log` level (ids only — never names, ID numbers, phones, emails or free text) and refusals at `warn`; see `expertise-observability`.
- Shape matches at least one sibling resource under `apps/api/src/`.

## Pre-completion checklist

- [ ] URL, method and status code follow the rules above (action-endpoint decision test run for anything non-CRUD).
- [ ] Body/query validated via `ZodValidationPipe` with the shared schema from `packages/shared-schemas`.
- [ ] Every message a person can see (service exceptions, schema messages) is Hebrew and understandable without technical knowledge;
- [ ] Response and error shapes go through the global Interceptor/Filter; DB errors translated in the service; uncaught exceptions can't escape as a raw 500 with internals exposed — the Filter returns `{ error: { code: "INTERNAL_ERROR", … } }` and logs the real error server-side only.
- [ ] No authorization logic duplicated from the global Guard (once it exists) — only resource-level checks it genuinely can't express, with a comment saying why.
- [ ] A method that claims idempotency (`PUT`/`DELETE`) really is: same result on retry, no duplicate side effect.
- [ ] Swagger helpers added; the route appears correctly in `/docs/json`.
- [ ] Contact deletion (if touched) still goes through the soft-delete path.
- [ ] Module registered in `app.module.ts`.
- [ ] Service logs the business event and refusals (no personal data); no duplicate request log added.
- [ ] Tests: service spec (SQL/behaviour) and, for new validation rules, schema tests; HTTP-level controller spec for the pipe/interceptor/filter pipeline (`expertise-testing`).
