---
name: expertise-api-rest
description: 'REST API design conventions for the Next.js Route Handlers in this project (app/api/**/route.ts): URL and method design, action-endpoint decisions, the Joi validation wrapper, the success/error response envelope, OpenAPI docs, versioning, and rate limiting. Use when creating or reviewing any API route under app/api, or discussing URL/method/status-code design for a CRUD or action endpoint, error/response envelope shape, OpenAPI/Swagger documentation, API versioning, or rate limiting the public registration endpoint. Not for Server Actions or React/component code (see expertise-react-nextjs) and not for Prisma query/audit-trail/soft-delete mechanics (see expertise-postgres-prisma).'
---

# REST API Design Conventions (Next.js App Router Route Handlers)

> Verified September 2026 against Next.js 16.x. Two facts below are concrete enough to act on now but worth re-checking if this file is read months later: (1) Next.js 16 renamed `middleware.ts` to `proxy.ts` and moved it to the Node.js runtime; (2) `next-openapi-gen` is currently the better-maintained OpenAPI generator for App Router (see OpenAPI section). Everything else — resource-oriented URLs, HTTP semantics, one validation choke point, one response envelope — is a stable project convention, not a trend to re-verify.

## Scope

For universal code-quality principles (simplicity, naming, comments, error-handling philosophy, DRY judgment) that apply here as everywhere else in the repo, see `expertise-code-quality` — this file only adds what's specific to the API-route layer.

This skill governs everything under `app/api/**/route.ts` — the actual REST surface (what RTK Query calls, what the public registration form submits to, what Swagger UI documents). It does **not** cover:
- Server Actions vs. Route Handlers tradeoffs, or React/component code — see `expertise-react-nextjs`.
- Prisma queries, the audit-trail extension, or soft-delete mechanics at the DB layer — see `expertise-postgres-prisma`.
- Node/TypeScript conventions (error handling, ESM, Joi↔TS type-sync) — see `expertise-nodejs-typescript`.

**This project is greenfield — no routes exist under `app/api/` yet.** The patterns below (the action-endpoint decision rule, the validation wrapper, the response envelope) are the canonical shape the *first* routes should establish, not a description of code that's already there. Once 2-3 real routes exist under `app/api/`, skim them before adding another — if they've evolved past what's written here, the actual code is the source of truth, not this file.

**Two things every route already gets "for free" — don't reimplement them:**
- Domain-scoped authorization runs centrally in `proxy.ts` (Next.js 16's renamed `middleware.ts`, Node.js runtime — verify this hasn't shifted again). Never duplicate an authorization check inside a route handler. If a route needs a check the central layer can't express (e.g. "only the assigned coordinator may approve this specific request"), add that one resource-level check explicitly and comment why.
- Every Prisma `create`/`update`/`delete` a route triggers is audit-logged automatically via the Client Extension described in `expertise-postgres-prisma`. Don't hand-write audit-log calls in a route handler.

## Route Handler basics — project rules

- File layout: `app/api/<resource>/route.ts` (collection `GET`/`POST`), `app/api/<resource>/[id]/route.ts` (item `GET`/`PATCH`/`DELETE`), `app/api/<resource>/[id]/<action>/route.ts` (action endpoints, see below).
- `params` is a `Promise` — always `await ctx.params` before reading route segments:
  ```ts
  export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
  }
  ```
  An un-awaited `params.id` is a silent runtime bug, not a type error, if a route file predates this.
- Standardize on the shared `dataResponse`/`errorResponse` helpers (below) for every response — never a hand-rolled `NextResponse.json({...})` shape.
- Route Handlers are dynamic (uncached) by default in Next.js 16 — every route here is authorization- or mutation-sensitive, so don't opt one into `force-static`.
- Keep Prisma calls and business logic in `lib/`/`features/<resource>/` modules; the route handler itself should just parse → validate → call → respond.

## URL + HTTP method conventions

### Plain CRUD resources

| Resource | Collection | Item |
|---|---|---|
| Domain | `GET/POST /api/domains` | `GET/PATCH /api/domains/:id` |
| SupportedBody | `GET/POST /api/supported-bodies` | `GET/PATCH /api/supported-bodies/:id` |
| Contact | `GET /api/contacts?supportedBodyId=&status=`, `POST /api/contacts` | `GET/PATCH /api/contacts/:id`, `DELETE /api/contacts/:id` (soft-delete — see rule below) |
| RegistrationRequest | `GET /api/registration-requests` (internal, auth'd), `POST /api/registration-requests` (**public, unauthenticated** — see Rate limiting) | `GET /api/registration-requests/:id` |

**Project rule — Contact `DELETE` is never a hard delete.** `DELETE /api/contacts/:id` routes through the exact same service function a `PATCH .../status` would use (sets `status: 'INACTIVE'`; no row deletion — mechanism owned by `expertise-postgres-prisma`). Respond `200` with the updated (now-inactive) resource, not `204` — the client needs to see the resulting state.

### Action endpoints (non-CRUD business actions) — the decision rule

Ask: **does this action have its own lifecycle, side effects, or a rejection reason beyond simple validation?**

- **Yes → verb-shaped `POST` sub-route.** Example — approve/reject a registration request has side effects (creates Contact/SupportedBody records, is a one-way state transition, guarded by business rules like "can't approve twice"):
  - `POST /api/registration-requests/:id/approve` → `200` + updated request (and/or created Contact); `409 Conflict` if not currently `PENDING`.
  - `POST /api/registration-requests/:id/reject` with `{ reason: string }` → same status-code rules.
  - `POST /api/registration-requests/:id/request-info` (FR-16's third action, "request completion") → `200` + updated request; sets `infoRequestedAt` and re-notifies the submitter (FR-18) — status stays `PENDING`, this isn't a terminal transition.
  - `POST /api/registration-requests/:id/assign-body` with `{ supportedBodyId }` → `200` + updated request; covers the unmatched-ח"פ edge case (FR-14/FR-15), where a coordinator/admin either picks an existing `SupportedBody` or first `POST`s a new one via the plain CRUD route and then calls this with its id.
  - `POST`, not `PUT`, because a second call is a conflict, not an idempotent no-op.
- **No → it's really just a field or relationship change** → `PATCH` on the resource, or `PUT`/`DELETE` on a small sub-resource. Example — assigning a coordinator to a domain is relationship-setting (validate the coordinator exists and has the right role, nothing more) and idempotent. A domain can have more than one coordinator (FR-2), so this is a sub-collection, not a single field:
  - `PUT /api/domains/:id/coordinators/:coordinatorId` → assign, `200` + updated domain. Calling it again with the same id is a no-op returning the same result.
  - `DELETE /api/domains/:id/coordinators/:coordinatorId` → unassign that one coordinator, `200` + updated domain (not `204`).
  - Don't fold this into `PATCH /api/domains/:id { coordinatorId }` — that forces the generic domain `PATCH` to special-case authorization for one field ("only an admin may reassign a coordinator" vs. "a coordinator may edit their own domain's name"), and can't express more than one coordinator anyway. A dedicated sub-resource route keeps that explicit instead of hidden inside a conditional.

Apply this same test before inventing any new action-endpoint pattern — don't add a third shape without a reason.

## Joi validation: one shared wrapper

**Project rule: every mutating handler (`POST`/`PATCH`/`PUT`) goes through a shared validation HOF — never a hand-called `schema.validate(...)` inside a route.** Per-route validation is exactly how one route ends up returning `422` and another `400` for the same kind of failure.

The wrapper below is the canonical shape to create at `lib/api/with-validation.ts` when the first mutating route is built. If that file already exists by the time you read this, use its actual implementation instead of reintroducing a second wrapper that happens to resemble this one.

```ts
// lib/api/with-validation.ts
import { NextRequest } from "next/server";
import type Joi from "joi";
import { errorResponse } from "./response";

type ParamsCtx = { params: Promise<Record<string, string>> };

export function withBodyValidation<T>(
  schema: Joi.ObjectSchema<T>,
  handler: (req: NextRequest, ctx: { params: Record<string, string>; body: T }) => Promise<Response>
) {
  return async (req: NextRequest, routeCtx: ParamsCtx) => {
    const params = await routeCtx.params;

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    const { value, error } = schema.validate(raw, { abortEarly: false, stripUnknown: true });
    if (error) {
      return errorResponse(400, "VALIDATION_ERROR", "Request failed validation",
        error.details.map((d) => ({ field: d.path.join("."), message: d.message })));
    }

    return handler(req, { params, body: value });
  };
}
```

```ts
// app/api/contacts/route.ts
export const POST = withBodyValidation(createContactSchema, async (_req, { body }) => {
  const contact = await prisma.contact.create({ data: body });
  return dataResponse(contact, 201);
});
```

- `abortEarly: false` — surfaces every field's error in one pass, which is what React Hook Form's `setError` needs to paint all invalid fields at once instead of one-per-resubmit.
- Validate `GET` query filters the same way (a `withQueryValidation` variant reading `req.nextUrl.searchParams` into a plain object first) — don't leave query-string filtering unvalidated just because it "looks like" simple filtering.
- Reuse the same Joi schema the Server Action / RHF client-side validation uses for that resource (`@contact-mgmt/shared-schemas`, per `expertise-react-nextjs`) — a route handler and a Server Action must never silently diverge on what counts as valid input.

## One response envelope, success and error

**Project rule: every route returns through `dataResponse`/`errorResponse` — never an ad hoc `NextResponse.json({...})`, and never `200` with `{ success: false }`.**

The helpers below are the canonical shape to create at `lib/api/response.ts`. If that file already exists, use it as written — don't hand-roll a second response shape that happens to match this example.

```ts
// lib/api/response.ts
import { NextResponse } from "next/server";

export function dataResponse<T>(data: T, status = 200, meta?: Record<string, unknown>) {
  return NextResponse.json({ data, ...(meta ? { meta } : {}) }, { status });
}

export function errorResponse(
  status: number, code: string, message: string,
  details?: { field: string; message: string }[]
) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}
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
- Wrap handler bodies (or add a `withErrorBoundary` HOF alongside the validation one) so an uncaught exception never reaches the client as a raw 500 HTML page — it should always come back as `errorResponse(500, "INTERNAL_ERROR", "Something went wrong")`, with the real error logged server-side only.
- **Recommendation, not adopted now:** RFC 9457 Problem Details is the current IETF-standard error shape. This app's custom envelope is purpose-built for RHF/RTK Query instead, which Problem Details doesn't give you for free. If this API ever needs to interoperate with external Problem-Details-aware tooling, that's a thin mapping layer (`code`→`type`, `message`→`title`/`detail`), not a redesign — don't adopt it speculatively now.

## OpenAPI/Swagger from JSDoc

**Project rule: annotate every route with an `@openapi` JSDoc block as you write it**, not as a separate documentation pass — annotation and code drift apart fast when written separately.

```ts
// app/api/contacts/route.ts
/**
 * @openapi
 * /api/contacts:
 *   get:
 *     summary: List contacts
 *     tags: [Contacts]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, INACTIVE] }
 *     responses:
 *       200:
 *         description: Paginated list of contacts
 */
export async function GET(req: NextRequest) { /* ... */ }
```

Because Joi (not Zod) is this project's validator, there's no automatic schema→OpenAPI derivation — write `components.schemas` by hand, matching the same manual-sync discipline `expertise-nodejs-typescript` documents for Joi↔TS type drift.

**Recommendation — verify before locking in at architecture time:** `next-swagger-doc` (the common App-Router-aware wrapper most guides point to) had no release in the prior 12 months as of this writing — a maintenance risk for a long-lived project. `next-openapi-gen` is the actively-maintained 2026-era alternative: JSDoc-driven, scans App Router route handlers directly, outputs OpenAPI 3.0/3.1/3.2. Prototype with `next-openapi-gen` first, but re-check both packages' maintenance status before committing — either way, the `@openapi` JSDoc annotation format above is the load-bearing convention, not the generator.

## Versioning: no `/v1` prefix yet

**Recommendation.** This API's only consumers today are this team's own UI (RTK Query, Server Actions) plus one public, fixed-contract form endpoint — no external consumer an in-place change could break. Evolve in place (add optional fields, add endpoints, deprecate fields with a grep-able TODO) rather than maintaining parallel version trees for no current benefit.

**Add `/api/v1/...` when any one of these becomes true** (check against this list rather than re-deciding from scratch each time):
1. A consumer outside this team starts calling the API directly.
2. A breaking change is needed while a client that can't update same-day still depends on the old shape.
3. The API itself becomes an intentionally supported product surface, not just this app's own plumbing.

When that day comes: prefix new routes `/api/v1/` and migrate the small, self-controlled set of existing consumers directly — don't maintain a long-lived unprefixed alias.

## Rate limiting the public registration endpoint

**Project rule:** `POST /api/registration-requests` is the one genuinely public, unauthenticated route and needs abuse protection regardless of hosting. Never build the counter on in-process memory — it silently stops working the moment there's more than one running instance (multiple serverless invocations, or multiple replicas behind a load balancer).

**Recommendation:** `@upstash/ratelimit` + `@upstash/redis` — HTTP-based, works identically from a serverless function or a self-hosted Node process, so the choice survives the hosting decision either way.

```ts
// lib/api/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(), // UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
  limiter: Ratelimit.slidingWindow(5, "10 m"), // tune once real spam patterns are observed
  prefix: "registration-request",
});

export async function checkRateLimit(identifier: string) {
  return ratelimit.limit(identifier); // { success, remaining, reset }
}
```

```ts
// app/api/registration-requests/route.ts
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = await checkRateLimit(ip);
  if (!success) {
    return errorResponse(429, "RATE_LIMITED", "Too many registration attempts — please try again later.");
  }
  // ...Joi validation + create, same as any other route
}
```

- Check the rate limit **before** running Joi validation — fail fast on abuse without spending validation/DB work on it.
- Keep this check in the route handler, not `proxy.ts` — it's specific to this one public route, not the cross-cutting authorization concern the proxy exists for.
- If the registration form later needs bot/email-quality checks too, Arcjet bundles rate limiting with bot detection and email validation in one SDK — worth a look before stacking separate abuse-protection libraries. A Postgres-table counter is a reasonable no-new-infra fallback if Redis becomes unwanted later; don't build that speculatively now.

## Code quality for API routes

- **If a method claims idempotency, prove it, don't assume it from the verb.** `PUT`/`DELETE` handlers must genuinely return the same result on a retried call with the same input (e.g. `PUT .../coordinator` with the same `coordinatorId` twice, or `DELETE /api/contacts/:id` on an already-inactive contact) — no duplicate side effect, no error on the second call. If a handler named `PUT`/`DELETE` can't actually satisfy that, it's mismodeled as an action endpoint (see the decision rule above), not a case to special-case around.
- **Translate ORM/DB errors at the boundary — never forward them.** A Prisma unique-constraint violation (`P2002`) or similar must be caught in the route/service layer and mapped to `errorResponse(409, "CONFLICT", "<human message>")`, not left to surface as a raw Prisma error string or stack fragment in `error.message`. This is a concrete translation step per constraint a schema defines, not a generic try/catch — easy to skip because the unhandled path still "works" until the exact constraint is hit.
- **Don't over-fetch in the response.** `dataResponse` should carry what the calling screen/consumer actually needs, not the full Prisma object graph with every relation included by default — an unused nested include is extra payload and an accidental data exposure both at once.

## Pre-completion checklist

- [ ] URL follows the resource/action rules above (ran the action-endpoint decision test for anything non-CRUD).
- [ ] Correct HTTP method and status code for the operation, including `409` for illegal state transitions and `200` (not `204`) wherever the client needs the resulting state.
- [ ] Mutating handler wrapped in `withBodyValidation` (or the query equivalent), using the resource's shared Joi schema.
- [ ] Every response — success and error — goes through `dataResponse`/`errorResponse`.
- [ ] Uncaught exceptions can't escape as a raw 500 — they return `errorResponse(500, "INTERNAL_ERROR", ...)`.
- [ ] `@openapi` JSDoc block added or updated for this route.
- [ ] Contact `DELETE` (if touched) still routes through the soft-delete path — never `prisma.contact.delete()`.
- [ ] No authorization logic duplicated from `proxy.ts` — only resource-level checks the central layer genuinely can't express.
- [ ] Shape matches at least one existing sibling route under `app/api/` — or, if this is the first route in the project, matches the canonical shape established in this file.
