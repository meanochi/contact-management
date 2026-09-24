---
name: expertise-api-rest
description: 'REST API design conventions for the NestJS backend in this project (apps/api/src/**): URL and method design, action-endpoint decisions, Joi validation via Pipes, the success/error response envelope via Interceptors/Filters, OpenAPI docs, versioning, and rate limiting. Use when creating or reviewing any controller/service/module under apps/api, or discussing URL/method/status-code design for a CRUD or action endpoint, error/response envelope shape, OpenAPI/Swagger documentation, API versioning, or rate limiting the public registration endpoint. Not for apps/web/React/component code (see expertise-react-nextjs) and not for Prisma query/audit-trail/soft-delete mechanics (see expertise-postgres-prisma).'
---

# REST API Design Conventions (NestJS — `apps/api`)

> Verified September 2026. `apps/web` (Next.js) and `apps/api` (NestJS) are separate applications (`ARCHITECTURE-SPINE.md` AD-1) — this file covers everything under `apps/api/src/**`, the actual REST surface (what `apps/web`'s RTK Query calls, what the public registration form submits to, what Swagger UI documents). Resource-oriented URLs, HTTP semantics, one validation choke point, one response envelope are stable project conventions; the exact NestJS package versions (`@nestjs/swagger`, `@nestjs/throttler`) are worth re-checking if this file is read months later.

## Scope

For universal code-quality principles (simplicity, naming, comments, error-handling philosophy, DRY judgment) that apply here as everywhere else in the repo, see `expertise-code-quality` — this file only adds what's specific to the API layer.

This skill governs everything under `apps/api/src/**` — controllers, services, modules, pipes, filters, interceptors. It does **not** cover:
- `apps/web`/React/component code, or how `apps/web` calls this API (`lib/api-client.ts`, RTK Query) — see `expertise-react-nextjs`.
- Prisma queries, the audit-trail extension, or soft-delete mechanics at the DB layer — see `expertise-postgres-prisma`.
- Node/TypeScript conventions (error handling, ESM, Joi↔TS type-sync) — see `expertise-nodejs-typescript`.

**This project is greenfield — no code exists under `apps/api/` yet.** The patterns below (the action-endpoint decision rule, the validation Pipe, the response envelope) are the canonical shape the *first* endpoints should establish, not a description of code that's already there. Once 2-3 real resources exist under `apps/api/src/`, skim them before adding another — if they've evolved past what's written here, the actual code is the source of truth, not this file.

**Two things every endpoint already gets "for free" — don't reimplement them:**
- Domain-scoped authorization runs centrally via a global NestJS Guard (`ARCHITECTURE-SPINE.md` AD-4), registered once via `APP_GUARD` in `app.module.ts`. Never duplicate an authorization check inside a controller. If an endpoint needs a check the central Guard can't express (e.g. "only the assigned coordinator may approve this specific request"), add that one resource-level check explicitly and comment why.
- Every Prisma `create`/`update`/`delete` a service triggers is audit-logged automatically via the Client Extension described in `expertise-postgres-prisma`. Don't hand-write audit-log calls in a service.
- CORS is enabled once, globally, in `apps/api/src/main.ts` (AD-12) — don't add a per-route CORS header.

## File layout and the module/controller/service trio

Every resource is its own NestJS module, generated (conceptually — by hand or `nest generate`) as a trio directly under `apps/api/src/<resource>/`, **not** wrapped in an extra `routes/` folder:

```
apps/api/src/contacts/
  contacts.module.ts       # registers the controller + service with Nest's DI — required, not optional
  contacts.controller.ts   # API layer — thin: parses, validates (via Pipe), calls the service, responds
  contacts.service.ts      # Service/Domain layer — the only code allowed to call packages/db
```

- `contacts.module.ts` must be imported into `apps/api/src/app.module.ts` (the root module) — a resource that exists as files but isn't registered in a module Nest imports is invisible to the running app, not a partial feature.
- Route paths are declared on the controller with `@Controller('contacts')` (collection root) and `@Get()`/`@Post()`/`@Patch()`/`@Param('id')` per method — there is no separate "routes registry" file the way Express-style layouts use; the decorator *is* the routing declaration.
- Keep Prisma calls and business logic in `<resource>.service.ts`; the controller method itself should just parse → validate (Pipe) → call the service → return (the Interceptor below shapes the response).

```ts
// apps/api/src/contacts/contacts.controller.ts
import { Controller, Get, Post, Body, Param, Query } from "@nestjs/common";
import { JoiValidationPipe } from "../common/pipes/joi-validation.pipe";
import { createContactSchema } from "@contact-management/shared-schemas/contacts";
import { ContactsService } from "./contacts.service";

@Controller("contacts")
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  list(@Query() query: Record<string, string>) {
    return this.contactsService.list(query);
  }

  @Post()
  create(@Body(new JoiValidationPipe(createContactSchema)) body: CreateContactInput) {
    return this.contactsService.create(body);
  }
}
```

```ts
// apps/api/src/contacts/contacts.service.ts
import { Injectable } from "@nestjs/common";
import { prisma } from "@contact-management/db";

@Injectable()
export class ContactsService {
  async create(data: CreateContactInput) {
    return prisma.contact.create({ data }); // the only place allowed to call packages/db
  }
  // ...
}
```

## URL + HTTP method conventions

### Plain CRUD resources

| Resource | Collection | Item |
|---|---|---|
| Domain | `GET/POST /domains` | `GET/PATCH /domains/:id` |
| SupportedBody | `GET/POST /supported-bodies` | `GET/PATCH /supported-bodies/:id` |
| Contact | `GET /contacts?supportedBodyId=&status=`, `POST /contacts` | `GET/PATCH /contacts/:id`, `DELETE /contacts/:id` (soft-delete — see rule below) |
| RegistrationRequest | `GET /registration-requests` (internal, auth'd), `POST /registration-requests` (**public, unauthenticated** — see Rate limiting) | `GET /registration-requests/:id` |

(Paths shown without `/api` prefix — see Versioning below for whether/when a prefix is added; `apps/api`'s own base path, if any, is a deployment concern, not a per-resource one.)

**Project rule — Contact `DELETE` is never a hard delete.** The controller's `DELETE` method routes through the exact same service function a `PATCH .../status` would use (sets `status: 'INACTIVE'`; no row deletion — mechanism owned by `expertise-postgres-prisma`). Respond `200` with the updated (now-inactive) resource, not `204` — the client needs to see the resulting state.

### Action endpoints (non-CRUD business actions) — the decision rule

Ask: **does this action have its own lifecycle, side effects, or a rejection reason beyond simple validation?**

- **Yes → verb-shaped `POST` sub-route.** Example — approve/reject a registration request has side effects (creates Contact/SupportedBody records, is a one-way state transition, guarded by business rules like "can't approve twice"):
  - `POST /registration-requests/:id/approve` → `200` + updated request (and/or created Contact); `409 Conflict` if not currently `PENDING`.
  - `POST /registration-requests/:id/reject` with `{ reason: string }` → same status-code rules.
  - `POST /registration-requests/:id/request-info` (FR-16's third action, "request completion") → `200` + updated request; sets `infoRequestedAt` and re-notifies the submitter (FR-18) — status stays `PENDING`, this isn't a terminal transition.
  - `POST /registration-requests/:id/assign-body` with `{ supportedBodyId }` → `200` + updated request; covers the unmatched-ח"פ edge case (FR-14/FR-15), where a coordinator/admin either picks an existing `SupportedBody` or first `POST`s a new one via the plain CRUD route and then calls this with its id.
  - `POST`, not `PUT`, because a second call is a conflict, not an idempotent no-op.
- **No → it's really just a field or relationship change** → `PATCH` on the resource, or `PUT`/`DELETE` on a small sub-resource. Example — assigning a coordinator to a domain is relationship-setting (validate the coordinator exists and has the right role, nothing more) and idempotent. A domain can have more than one coordinator (FR-2), so this is a sub-collection, not a single field:
  - `PUT /domains/:id/coordinators/:coordinatorId` → assign, `200` + updated domain. Calling it again with the same id is a no-op returning the same result.
  - `DELETE /domains/:id/coordinators/:coordinatorId` → unassign that one coordinator, `200` + updated domain (not `204`).
  - Don't fold this into `PATCH /domains/:id { coordinatorId }` — that forces the generic domain `PATCH` to special-case authorization for one field ("only an admin may reassign a coordinator" vs. "a coordinator may edit their own domain's name"), and can't express more than one coordinator anyway. A dedicated sub-resource route keeps that explicit instead of hidden inside a conditional.

Apply this same test before inventing any new action-endpoint pattern — don't add a third shape without a reason.

## Joi validation: one shared Pipe

**Project rule: every mutating endpoint (`POST`/`PATCH`/`PUT`) validates its body through the shared `JoiValidationPipe` — never a hand-called `schema.validate(...)` inside a controller or service.** Per-endpoint validation is exactly how one endpoint ends up returning `422` and another `400` for the same kind of failure.

The Pipe below is the canonical shape to create at `apps/api/src/common/pipes/joi-validation.pipe.ts` when the first mutating endpoint is built. If that file already exists by the time you read this, use its actual implementation instead of reintroducing a second one. It wraps the **same** Joi schema `apps/web`'s React Hook Form uses — never a second, API-only copy.

```ts
// apps/api/src/common/pipes/joi-validation.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from "@nestjs/common";
import type Joi from "joi";

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
```

```ts
// apps/api/src/contacts/contacts.controller.ts
@Post()
create(@Body(new JoiValidationPipe(createContactSchema)) body: CreateContactInput) {
  return this.contactsService.create(body);
}
```

- `abortEarly: false` — surfaces every field's error in one pass, which is what React Hook Form's `setError` needs to paint all invalid fields at once instead of one-per-resubmit.
- Validate query filters the same way — a `JoiValidationPipe` instance wrapping a query schema, applied to `@Query()` — don't leave query-string filtering unvalidated just because it "looks like" simple filtering.
- The thrown `BadRequestException`'s object body is picked up by the global Exception Filter below and reshaped into the standard error envelope — the Pipe doesn't format the HTTP response itself.
- Reuse the same Joi schema the client-side RHF validation uses for that resource (`packages/shared-schemas`, per `expertise-react-nextjs`) — a controller and a form must never silently diverge on what counts as valid input.

## One response envelope, success and error

**Project rule: every endpoint's response goes through a shared global Interceptor (success) and Exception Filter (error) registered once in `main.ts` — never an ad hoc shape returned from an individual controller method, and never `200` with `{ success: false }`.**

The wire shape is unchanged from a single-app design — only the mechanism is NestJS-native instead of a Next.js HOF.

```ts
// apps/api/src/common/interceptors/response.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => ({ data })));
    // a controller method that needs `meta` (pagination totals, etc.) returns
    // { data, meta } itself; the interceptor only wraps the bare-data case.
  }
}
```

```ts
// apps/api/src/common/filters/all-exceptions.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : null;

    const { code, message, details } =
      body && typeof body === "object"
        ? (body as { code?: string; message?: string; details?: unknown })
        : { code: undefined, message: undefined, details: undefined };

    res.status(status).json({
      error: {
        code: code ?? "INTERNAL_ERROR",
        message: message ?? "Something went wrong",
        ...(details ? { details } : {}),
      },
    });
    // The real error (including a raw Prisma/unexpected exception) is logged
    // server-side here, before this generic message is sent to the client —
    // never let exception.stack or exception.message reach the response body
    // for anything that isn't already a deliberate HttpException.
  }
}
```

```ts
// apps/api/src/main.ts
app.useGlobalInterceptors(new ResponseInterceptor());
app.useGlobalFilters(new AllExceptionsFilter());
```

Success:
```json
{ "data": { "id": "c_123", "fullName": "..." }, "meta": { "total": 42, "page": 1, "pageSize": 20 } }
```

Error:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request failed validation",
    "details": [{ "field": "email", "message": "\"email\" must be a valid email" }]
  }
}
```

- `error.details[].field`/`.message` maps directly onto RHF's `setError(field, { message })`. `error.code` is a stable discriminant for RTK Query (`VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`, …) without parsing free-text messages.
- Status codes: `200` read/update success, `201` create, `400` validation failure, `401` unauthenticated, `403` authenticated-but-forbidden (role-based, e.g. a non-admin calling an admin-only action), `404` not found — including a record that exists but is outside the caller's domain (EXPERIENCE.md: domain-scoped denial is always `404`, never `403`, so it doesn't reveal whether the record exists), `409` conflict (e.g. approving an already-approved request), `429` rate-limited, `500` unhandled/internal.
- **Translate ORM/DB errors at the Service layer, before they reach the Filter as generic exceptions.** A Prisma unique-constraint violation (`P2002`) must be caught in the service and re-thrown as a NestJS `ConflictException({ code: "CONFLICT", message: "<human message>" })` — not left to fall through to `AllExceptionsFilter`'s generic 500 path.
- **Recommendation, not adopted now:** RFC 9457 Problem Details is the current IETF-standard error shape. This app's custom envelope is purpose-built for RHF/RTK Query instead, which Problem Details doesn't give you for free. If this API ever needs to interoperate with external Problem-Details-aware tooling, that's a thin mapping layer (`code`→`type`, `message`→`title`/`detail`), not a redesign — don't adopt it speculatively now.

## OpenAPI/Swagger via `@nestjs/swagger`

**Project rule: annotate every controller/DTO with `@nestjs/swagger` decorators as you write it**, not as a separate documentation pass — annotation and code drift apart fast when written separately. This is NestJS's native, decorator-based approach — not JSDoc `@openapi` blocks (that was the Next.js Route Handler approach in the single-app design; it doesn't apply to a NestJS controller).

```ts
// apps/api/src/contacts/contacts.controller.ts
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

@ApiTags("Contacts")
@Controller("contacts")
export class ContactsController {
  @Get()
  @ApiOperation({ summary: "List contacts" })
  @ApiResponse({ status: 200, description: "Paginated list of contacts" })
  list(@Query() query: Record<string, string>) {
    return this.contactsService.list(query);
  }
}
```

Because Joi (not `class-validator`) is this project's validator, there's no automatic DTO→OpenAPI schema derivation the way `class-validator`+`@nestjs/swagger` gets for free — write `@ApiProperty()` on hand-maintained DTO classes (or `components.schemas` via `SwaggerModule`'s document builder) matching the same manual-sync discipline `expertise-nodejs-typescript` documents for Joi↔TS type drift. Bootstrap once in `main.ts`:

```ts
// apps/api/src/main.ts
const config = new DocumentBuilder().setTitle("Contact Management API").build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup("docs", app, document);
```

## Versioning: no `/v1` prefix yet

**Recommendation.** This API's only consumers today are `apps/web` plus one public, fixed-contract form endpoint — no external consumer an in-place change could break. Evolve in place (add optional fields, add endpoints, deprecate fields with a grep-able TODO) rather than maintaining parallel version trees for no current benefit. (NestJS has built-in URI/header/media-type versioning via `app.enableVersioning(...)` whenever this is actually needed — don't wire it up speculatively.)

**Add versioning when any one of these becomes true** (check against this list rather than re-deciding from scratch each time):
1. A consumer outside this team starts calling the API directly.
2. A breaking change is needed while a client that can't update same-day still depends on the old shape.
3. The API itself becomes an intentionally supported product surface, not just `apps/web`'s own plumbing.

## Rate limiting the public registration endpoint

**Project rule:** `POST /registration-requests` is the one genuinely public, unauthenticated route and needs abuse protection regardless of hosting.

**Recommendation:** `@nestjs/throttler` — NestJS-native, Guard-based rate limiting, storage-backed so it survives multiple instances/replicas (configure a shared store, e.g. Redis, once more than one `apps/api` instance runs — don't rely on the in-memory default past a single instance).

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

## Code quality for API endpoints

- **If a method claims idempotency, prove it, don't assume it from the verb.** `PUT`/`DELETE` handlers must genuinely return the same result on a retried call with the same input (e.g. `PUT .../coordinator` with the same `coordinatorId` twice, or `DELETE /contacts/:id` on an already-inactive contact) — no duplicate side effect, no error on the second call. If a handler named `PUT`/`DELETE` can't actually satisfy that, it's mismodeled as an action endpoint (see the decision rule above), not a case to special-case around.
- **Translate ORM/DB errors at the Service layer — never forward them.** See "One response envelope" above.
- **Don't over-fetch in the response.** A service's return value should carry what the calling screen actually needs, not the full Prisma object graph with every relation included by default — an unused nested include is extra payload and an accidental data exposure both at once.
- **Keep controllers thin.** A controller method's body should read as parse → validate (via Pipe/decorator) → call one service method → return. Business logic (a state-machine transition, a domain-scope calculation) belongs in the service, per the layer separation `expertise-code-quality` defines.

## Pre-completion checklist

- [ ] URL follows the resource/action rules above (ran the action-endpoint decision test for anything non-CRUD).
- [ ] Correct HTTP method and status code for the operation, including `409` for illegal state transitions and `200` (not `204`) wherever the client needs the resulting state.
- [ ] Mutating endpoint's body validated via `JoiValidationPipe`, using the resource's shared Joi schema from `packages/shared-schemas`.
- [ ] Every response — success and error — goes through the global `ResponseInterceptor`/`AllExceptionsFilter`, not an ad hoc shape.
- [ ] Uncaught exceptions can't escape as a raw 500 with internals exposed — the Filter always returns `{ error: { code: "INTERNAL_ERROR", ... } }` with the real error logged server-side only.
- [ ] `@nestjs/swagger` decorators added or updated for this endpoint.
- [ ] Contact `DELETE` (if touched) still routes through the soft-delete path in the service — never `prisma.contact.delete()`.
- [ ] The resource has a `.module.ts` registered in `app.module.ts` — not just controller/service files sitting unregistered.
- [ ] No authorization logic duplicated from the global Guard — only resource-level checks it genuinely can't express.
- [ ] Shape matches at least one existing sibling resource under `apps/api/src/` — or, if this is the first resource in the project, matches the canonical shape established in this file.
