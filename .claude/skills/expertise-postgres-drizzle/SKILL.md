---
name: expertise-postgres-drizzle
description: 'PostgreSQL/Drizzle ORM schema and query conventions for this project (packages/db): schema design for Domain/SupportedBody/Contact, drizzle-kit migrations, transactions, translating driver errors, soft delete, domain-scoped query filtering, and the status of the audit trail. Use when writing or reviewing packages/db/src/schema changes, migrations, Drizzle queries in an apps/api service, or soft-delete/domain-filtering/audit-trail work. Not for generic TypeScript/Node conventions (expertise-nodejs-typescript), API route/response shape (expertise-api-rest), or Jest setup (expertise-testing).'
---

# PostgreSQL + Drizzle Conventions for This Project

> Universal code-quality principles (simplicity, naming, DRY, error handling) live in `expertise-code-quality` and apply here too — this file only covers what is specific to Drizzle/Postgres.

> **Replaces the former Prisma setup.** Prisma, its generated client, `prisma.config.ts` and `$extends` are gone. If you see a Prisma idiom in an old note, story or ADR (`prisma.contact.findMany`, `P2002`, `Prisma.PrismaClientKnownRequestError`), translate it with the table at the end rather than reintroducing it.

> **Versions go stale.** Before relying on a version-specific detail, check `packages/db/package.json` (`drizzle-orm`, `drizzle-kit`, `pg`). The schema in `packages/db/src/schema/index.ts` is the source of truth for tables — if it disagrees with an example here, the code wins.

## Where things live

```
packages/db/
  src/schema/index.ts     # every table, enum and relation — the single schema file
  src/client.ts           # the one Pool + drizzle() instance, re-exported operators, isUniqueViolation, pingDatabase, closeDatabase
  src/audit-context.ts    # AsyncLocalStorage for "who" (see Audit trail)
  drizzle.config.ts       # drizzle-kit: schema path, out dir, DATABASE_URL
  drizzle/                # generated SQL migrations + meta/ journal — COMMITTED
  seed.ts                 # one-time seed (domains), run with `npm run db:seed -w @contact-management/db`
  baseline.ts             # one-time helper for a DB created by the old Prisma migrations: `npm run db:baseline -w @contact-management/db`
```

`packages/db` is CommonJS and reachable **only from `apps/api` services** (`expertise-nodejs-typescript`, ARCHITECTURE-SPINE AD-1). `apps/web` never imports it.

## Mandatory rules

1. **One `db` handle.** `packages/db/src/client.ts` creates the only `Pool` and the only `drizzle()` instance. Never construct a second one anywhere (it would also bypass any future audit hook). Services import `db` from `@contact-management/db`.
2. **Import query operators from `@contact-management/db`, not `drizzle-orm`.** `client.ts` re-exports `and, or, eq, ilike, inArray, notInArray, exists, gte, lt, count, asc, desc, sql`. Add to that list when a service needs another one — this keeps one installed copy and one entry point.
3. **Contact is soft-delete only.** Never `db.delete(contacts)`. "Delete" is `status = 'INACTIVE'` (+ `deactivatedAt`, plus the documented external-request fields). Every contact list defaults to `eq(contacts.status, "ACTIVE")` unless `includeInactive` is set. There is a unit test asserting no `DELETE FROM "Contact"` is ever issued — keep it passing.
4. **Multi-table writes go in `db.transaction(async (tx) => …)`** and use `tx` for every statement inside. Two independent `await db.insert…` calls that must succeed together are a bug. Rolling back is automatic when the callback throws.
5. **Translate driver errors in the service, never leak them.** Use `isUniqueViolation(err)` (handles Drizzle's `DrizzleQueryError.cause` wrapping; SQLSTATE `23505`) → `ConflictException({ code: "CONFLICT", … })`. A missing row from `update … returning` / `select` (empty array) → `NotFoundException`. Anything else is rethrown untouched so `AllExceptionsFilter` logs it as a 500.
6. **Raw SQL only through the `sql` tagged template.** `` sql`select 1` `` and `` sql`${value}` `` parameterise; never build a SQL string by concatenation or `sql.raw()` with anything that traces back to user input.
7. **Uniqueness and referential rules live in the database** (`unique()`, `primaryKey()`, `references()`), not only in code. `SupportedBody.companyId` is `UNIQUE`.
8. **Domain-scoped reads/writes use one named helper per model** (`scopeContact`, `scopeSupportedBody`, …), never an ad hoc `where domainId = …` copied between models that reach their domain differently. No such helper exists yet (no auth in Epic 1); when the global Guard (AD-4) arrives, add them next to the schema as functions returning an `SQL` condition that callers pass to `and(...)`.

## Schema conventions

- **Existing database names are preserved.** Tables are PascalCase and quoted (`"Contact"`, `"SupportedBodyOnDomain"`); columns that were `@map`ped under Prisma are snake_case (`first_name`, `company_id`), the rest are camelCase (`isActive`, `createdAt`). New tables/columns: snake_case column names, and say so in the PR if they differ from a neighbour.
- **Ids** are `text` primary keys filled by `$defaultFn(() => randomUUID())` (see the `id()` helper in the schema file). Existing rows hold cuid strings; both are opaque to the app — never parse or assume a format.
- **Timestamps** are `timestamp("…", { precision: 3 })` without time zone, UTC. `createdAt` uses `defaultNow()`. `updatedAt` uses `$defaultFn(() => new Date())` **and** `$onUpdate(() => new Date())`. `$defaultFn` makes the app supply the value on insert, because tables created by the old Prisma migrations have no `DEFAULT` on `updatedAt` (Prisma filled it client-side) — relying on a database default made inserts fail with a NOT NULL violation on such databases. `$onUpdate` only fires when `.set({...})` is non-empty, so services also always include `updatedAt: new Date()` in `.set()` — a domains-only patch still works and the timestamp always moves.
- **Enums** are `pgEnum` (`ContactStatus`, `ExternalRequestSource`). **`Domain` is deliberately a table, not an enum** — admins add/rename/deactivate domains at runtime without a migration.
- **Many-to-many** are explicit join tables with a composite `primaryKey()` and an index on the non-leading column. `ContactOnSupportedBodyDomain` references the `(contactId, supportedBodyId)` pair of `ContactOnSupportedBody` with a composite `foreignKey()`; "the domain subset must be a subset of the body's own domains" cannot be expressed in the schema and is enforced in `ContactsService.assertDomainsBelongToBody`.
- **Contact has no `domainId`.** A contact reaches a domain only through the supported body (and its own subset) it is linked to.
- **Domain** uses `isActive` to soft-disable. Never delete a `Domain` referenced by historical `SupportedBody` rows — same reasoning as the Contact soft-delete rule.
- **`SupportedBody.companyId` (ח"פ) is the natural business key**, so it is `UNIQUE` in the database, not only checked in code: a bulk import or a second entry point can race past an application-level check, a DB constraint can't be raced past.
- **Contact `status` is an enum, not a boolean**, so the model can grow (e.g. a future `PENDING` state) without another column migration. `externalRequestSource` + `externalRequestDate` are set together whenever a status change came from outside the app (phone/email) — FR-9.
- **Soft-delete backstops** (beyond code review): `REVOKE DELETE` on the `Contact` table for the app's DB role, or an audit/trigger-level guard that rejects a real `DELETE` unless an explicit internal escape hatch is set. Keep `status` indexed (it is filtered on almost everywhere); consider a partial index `WHERE status = 'ACTIVE'` via a custom migration if active-row lookups become a hot path.
- **Planned (Epic 2, not in the schema yet): `RegistrationRequest`** — the approval workflow. Shape to follow when it is added: a `pgEnum` status (`PENDING | APPROVED | REJECTED`); `payload jsonb` holding the submitted form **verbatim** (kept even after approval/rejection, as the record of what was actually submitted, independent of the audit rows for the Contact/SupportedBody later created from it); `supportedBodyId` **nullable** until FR-14's ח"פ match resolves it (or a coordinator assigns/creates one); `reason` (set on reject, FR-16); `infoRequestedAt` (FR-16's "request completion" — status stays `PENDING`, the submitter is re-notified per FR-18); `reviewedById` / `reviewedAt`; `createdAt`; indexes on `status` and `supportedBodyId`.
- **Relations** (`relations()` blocks) exist for the relational query API and documentation, but the services use the core builder (`db.select().from()…`) — see Query conventions for why.
- `emails` is `text("emails").array().notNull().default([])`. Under `exactOptionalPropertyTypes`, Drizzle treats an omitted insert key as "use the default" and `undefined` in `.set()` as "leave unchanged"; `null` means SQL NULL. Be deliberate: build `.set()` with conditional spreads (`...(x !== undefined ? { col: x } : {})`), not by assigning `undefined`.
- **`DATABASE_URL`** is a plain `postgresql://user:pass@host:port/db`. `client.ts` strips a leftover `?schema=public` (a Prisma-ism) so old `.env` files keep working.

## Domain-scoped filtering (mandatory — data-layer implication only)

The architecture decision — centralized permission enforcement via a global NestJS Guard in `apps/api` (AD-4), not per-endpoint checks and not Postgres RLS — is made elsewhere (`expertise-api-rest`); this skill only implements its data-layer consequence. **Not built yet** (no auth in Epic 1), but this is the required shape when it lands.

**Rule:** every read/write against a domain-scoped model goes through one shared, **named-per-model** helper that injects the domain filter from the authenticated request's context — never a hand-rolled inline filter in a service method. Share the `AsyncLocalStorage` context with the audit context (extend it with `domainId` next to `userId`).

**There is no single generic filter shape — `domainId` isn't reached the same way on every scoped model.** Each helper returns an `SQL` condition the caller passes into `and(...)`, type-checked against that model's actual columns, so a schema change that moves how a model reaches its domain breaks the helper at compile time instead of silently scoping nothing:

```ts
// packages/db/src/domain-scope.ts (to be created with the Guard)
import { and, eq, exists, sql } from "drizzle-orm";

// SupportedBody reaches its domain(s) through the SupportedBodyOnDomain join (many-to-many).
export const scopeSupportedBody = (domainId: string) =>
  exists(
    db.select({ one: sql`1` }).from(supportedBodyDomains)
      .where(and(eq(supportedBodyDomains.supportedBodyId, supportedBodies.id), eq(supportedBodyDomains.domainId, domainId))),
  );

// Contact has no domainId — it reaches a domain only via ContactOnSupportedBody -> SupportedBodyOnDomain.
export const scopeContact = (domainId: string) =>
  exists(
    db.select({ one: sql`1` }).from(contactSupportedBodies)
      .innerJoin(supportedBodyDomains, eq(supportedBodyDomains.supportedBodyId, contactSupportedBodies.supportedBodyId))
      .where(and(eq(contactSupportedBodies.contactId, contacts.id), eq(supportedBodyDomains.domainId, domainId))),
  );
```

Add one `scopeX` per domain-scoped model as it is introduced. A generic one-size-fits-all helper is exactly what produces the cross-domain leak this rule exists to prevent — don't reintroduce it for the sake of looking simpler. Revisit RLS-vs-application-filter only if a second direct DB consumer appears (a reporting tool, another service); that is an architecture-level call, not something to change from inside a query.

## Raw SQL safety (mandatory)

Every query built with the Drizzle query builder is parameterized. This section applies only where code drops to raw SQL (`db.execute(sql…)`, a custom migration, a future trigger):

- **Tagged-template `sql` only:** `` sql`select * from "Contact" where id = ${id}` `` parameterizes interpolated values. Never `sql.raw()` or string concatenation with a value that traces back to user input (form fields, query params, request body) — that reintroduces exactly the injection risk the builder prevents.
- Input reaching a raw query has usually already passed Zod validation at the `packages/shared-schemas` boundary — that is defense at a different layer, not a substitute for parameterization here.
- A migration's raw SQL (e.g. a partial index) is static, developer-authored SQL with no runtime user input, so it isn't subject to this rule the same way — but never template a runtime value into a migration file either.

## Query conventions

- **Core builder, explicit projections.** Select only the columns a screen needs (`CONTACT_COLUMNS`, `SUPPORTED_BODY_COLUMNS` objects in the services). Don't `select()` a whole table into a list response.
- **No N+1.** Never loop calling a query per row. Fetch the page, then load children for all ids in one query (`loadLinks` / `loadDomainIds` use `inArray(…, ids)` plus a left join and fold the rows in memory). The unit tests assert "one link query per page".
- **Filters: build `and(...)` from possibly-`undefined` parts.** `and()` drops `undefined` operands, so `and(cond ? eq(…) : undefined, …)` is the idiom; if every part is undefined the result is `undefined` and `.where(undefined)` means no filter. Never spread conditions into an object like Prisma's `where`.
- **Correlated filters use `exists(subquery)`.** Example: contacts linked to a body *and* a domain in the same link row — one `exists(select 1 from ContactOnSupportedBody where contactId = Contact.id and … and exists(select 1 from …Domain …))`. Reference the outer table's column directly (`contacts.id`) inside the subquery's `where`. Don't use the relational `db.query.*.findMany({ where })` with correlated subqueries: it aliases the root table, so a raw column reference renders the wrong name.
- **Paging.** `.limit(pageSize).offset((page - 1) * pageSize)` with a deterministic `orderBy`; the total comes from a sibling `select({ total: count() })` with the **same** `where`, run in `Promise.all`.
- **Case-insensitive search.** `ilike(col, containsPattern(term))` — escape `%`, `_` and `\` in the user's term (see `containsPattern` in the services) so searching "50%" matches literally.
- **Mutations return what the caller needs.** Use `.returning({ … })`; an empty array means "no such row" (→ 404). After a multi-table change, re-read through the same DTO path (`getDto`) instead of hand-assembling the response.
- **Dates cross the driver as strings.** Drizzle serialises `Date` params to ISO strings (visible in test SQL params). Pass `Date` objects in code; compare ISO strings in tests.
- **Wrap genuinely multi-step writes in a transaction** — anything that changes more than one row and must not partially succeed. Concrete future case: approving a `RegistrationRequest` both creates/updates a `Contact` and sets the request's `status` to `APPROVED`; if the second write fails after the first succeeds, the app is left with a live Contact and a request stuck at `PENDING`.
- **Index check (against the current schema):** `SupportedBodyOnDomain.domainId`, `ContactOnSupportedBody.supportedBodyId`, `ContactOnSupportedBodyDomain.domainId` and `Contact.status` have indexes; `SupportedBody.companyId` and `Domain.name` are `UNIQUE`; the join tables' composite primary keys cover lookups by their leading column. Re-run this check whenever a new column is filtered or sorted on frequently — a query that scans a growing table without an index is a bug that only shows up after the data grows.

## Audit trail — current status (read before touching writes)

The `AuditLog` table and `auditContext` (`AsyncLocalStorage<{ userId }>`) still exist, but **nothing writes audit rows today**: the Prisma `$extends` implementation was already disabled (product decision 2026-10-04, `getExtensionContext` bug) and Drizzle has no query-interception extension API to port it to. Do not claim a write is "automatically audited". When auditing is reinstated, choose one of (a decision for the team, not an implementation detail):

1. **PostgreSQL triggers** (`AFTER INSERT/UPDATE/DELETE` writing `AuditLog`, with `SET LOCAL app.current_user_id` set at the start of each transaction from `auditContext`) — atomic by construction, also covers writes made outside the app. Recommended if the audit requirement is accountability.
2. **An explicit `withAudit(tx, …)` helper** called by services inside their transactions — simple and typed, but opt-in per call site (forgettable).

Until then keep `auditContext` and the table in place so re-enabling is a small diff. Design points that hold for either option:

- **"Who" comes from the request context, not from call arguments.** `auditContext` (`AsyncLocalStorage<{ userId }>`) is set once per request — in `apps/api`, by a global Interceptor/middleware before the controller runs — and read where the audit row is written. There is no login in Epic 1, so `userId` is `null` for now; the auth mechanism (AD-9) is still undecided, and `audit-context.ts` only *consumes* the resolved user.
- **Atomicity is the property to protect.** An audit row written as a separate, later statement can be lost if the process dies between the two; it must share the mutation's transaction (a trigger does this by construction; a helper must take the `tx`). A multi-table change still needs its own explicit `db.transaction`.
- **Bulk statements need an explicit decision.** An `UPDATE`/`DELETE` that touches many rows doesn't hand the application the affected rows to diff. With a row-level trigger every row is audited automatically; with an application helper, loop single-row updates inside a transaction rather than silently accepting unaudited bulk writes.
- **Never write to `AuditLog` from the audit mechanism itself** (guard against recursion), and apply the mechanism in exactly one place so no write path can bypass it.
- A trigger is also the only option that survives a write made outside the app entirely (a raw `psql` session). NFR-B is an accountability log for actions taken *through* the app, so that stronger guarantee is a bonus, not a requirement.

## Migrations (drizzle-kit)

- Edit `packages/db/src/schema/index.ts`, then `npm run db:generate` (root; runs `drizzle-kit generate`) to produce the next `drizzle/NNNN_*.sql` + `meta/` journal entry. **Commit the SQL and `meta/` with the schema change in the same PR.** Review the SQL — drizzle-kit may ask interactively whether a column was renamed or dropped; never answer on autopilot.
- `npm run db:migrate` (root; `drizzle-kit migrate`) applies pending migrations. It is also the root `predev` hook. It reads `DATABASE_URL` from `packages/db/.env` (git-ignored; copy `.env.example`).
- Staging/production only ever run `db:migrate`. `db:push` (schema → DB without a migration file) is for throwaway local experiments only, never a shared database.
- **CI:** run `drizzle-kit migrate` against a clean, ephemeral Postgres as a check — it catches migrations that only "worked" locally and ordering conflicts from two branches adding migrations independently.
- **Migration history conflicts** (two branches each generated the next migration from the same parent): resolve by rebasing onto `main`, deleting your generated migration (and its `meta/` journal/snapshot entries), and regenerating — never by hand-editing timestamps or merging snapshot JSON.
- Never hand-edit an already-applied migration; add a new one. Name migrations meaningfully: `npx drizzle-kit generate --name add_registration_requests` (run from `packages/db`).
- **One-time baseline note:** `0000_init.sql` recreates the schema Prisma used to own, so `drizzle-kit migrate` fails on a database created by the old Prisma migrations (the tables already exist; the failure is rolled back and prints no message). To keep that database's data, run `npm run db:baseline -w @contact-management/db` once: `packages/db/baseline.ts` records `0000_init` as applied without running it, and refuses to act if the migration history is non-empty. A throwaway database can be reset instead (`docker compose down -v`). New databases just run `db:migrate`.
- Raw SQL in a migration (e.g. a partial index `WHERE status = 'ACTIVE'`) is static developer-authored SQL — fine; never template a runtime value into it. Add custom SQL with `npx drizzle-kit generate --custom --name …`.

## Connection pooling — revisit only if hosting becomes serverless

Not urgent while self-hosting with long-lived Node processes: one `Pool` (created in `client.ts`), reused by every request, closed on shutdown (`AppLifecycle`). If the production target ever becomes serverless, flag these for follow-up rather than solving speculatively now:

- Put a pooler in front (PgBouncer transaction mode, or a managed equivalent) — serverless invocations can each open a new connection against Postgres's hard connection ceiling.
- Transaction-mode pooling breaks named prepared statements and session-scoped `SET` (including the `SET LOCAL` a future audit trigger would use outside a transaction); use the pooled connection string for runtime and the direct connection string for migrations.

## Testing Drizzle-backed code

Mechanics and coverage priorities live in `expertise-testing`. What's specific here:

- **Unit tests of services** use `apps/api/src/test-utils/db-mock.ts`: a real, driver-less Drizzle builder (`drizzle.mock()`) wrapped so that `await`ing a statement records its **real SQL and parameters** and returns the next result the test queued. Wire it with `jest.mock("@contact-management/db", () => jest.requireActual("../test-utils/db-mock").mockedDbModule())`, queue results in the order the service awaits them (`dbMock.queue(rows, [{ total: 1 }], …)`; an `Error` in the queue is thrown), then assert on `dbMock.matching(/^update "Contact"/)[0].sql / .params`. That proves soft-delete filters, escaped search patterns, "only the fields sent are written", and that no `DELETE` hits `Contact`, without a database.
- Simulate a constraint failure with `uniqueViolation()` from the same file (a pg-style error with `code: "23505"`); to prove wrapping is handled, nest it as `cause`.
- **Integration tests** of anything a mock cannot prove — real constraints (`companyId` uniqueness, the composite FK), migrations applying cleanly, a future audit trigger — run against a real Postgres migrated with `drizzle-kit migrate`. Truncate tables between tests rather than wrapping each test in an outer transaction (services open their own `db.transaction`).

## Prisma → Drizzle cheat sheet

| Prisma (old) | Drizzle (now) |
|---|---|
| `prisma.contact.findMany({ where, select, orderBy, skip, take })` | `db.select(COLUMNS).from(contacts).where(and(...)).orderBy(asc(…)).limit(n).offset(m)` |
| `prisma.$transaction([a, b])` | `Promise.all([a, b])` (reads) or `db.transaction(async (tx) => …)` (writes) |
| `prisma.$transaction(async (tx) => …)` | `db.transaction(async (tx) => …)` |
| `create({ data })` / `createMany` | `insert(table).values(row \| rows).returning(…)` |
| `update({ where: { id }, data })` → throws `P2025` | `update(table).set({…, updatedAt}).where(eq(id)).returning(…)` → empty array ⇒ NotFound |
| `deleteMany({ where })` | `delete(table).where(and(…))` |
| `where: { rel: { some: {…} } }` | `exists(select 1 from join table where fk = outer.id and …)` |
| `contains` + `mode: "insensitive"` | `ilike(col, containsPattern(term))` |
| `{ notIn: [...] }` | `notInArray(col, [...])` |
| `err.code === "P2002"` | `isUniqueViolation(err)` |
| `@updatedAt` | `$onUpdate(() => new Date())` **and** set `updatedAt` explicitly in `.set()` |
| `prisma migrate dev / deploy` | `drizzle-kit generate` / `drizzle-kit migrate` |
| `prisma db seed` | `tsx seed.ts` (`npm run db:seed -w @contact-management/db`) |
| `prisma studio` | `drizzle-kit studio` |

## Before you finish: verification checklist

- [ ] No `db.delete(contacts)`; deactivation goes through the service's soft-delete path.
- [ ] Every statement belonging to one all-or-nothing change runs on the same `tx`.
- [ ] Unique violations become `ConflictException`, empty `returning` becomes `NotFoundException`; no raw driver message can reach a response.
- [ ] No query inside a loop; children are loaded for the whole page with `inArray`.
- [ ] `.set()` includes `updatedAt: new Date()` and contains only the fields actually sent.
- [ ] Search terms are escaped (`containsPattern`) before `ilike`.
- [ ] Only the shared `db` from `@contact-management/db`; operators imported from there too.
- [ ] Queries against domain-scoped models use that model's own `scopeX` helper (once the Guard exists) — never a copy-pasted `domainId` condition that assumes every model reaches its domain the same way.
- [ ] Any bulk `UPDATE`/`DELETE` on an audited model has an explicit audit-coverage decision (see Audit trail), not silently unaudited.
- [ ] Any raw SQL uses the `sql` tagged template only — no `sql.raw()`/concatenation with user-traceable input.
- [ ] New business-key/uniqueness invariants are enforced with a DB-level `unique()`/`primaryKey()`, not only in application code.
- [ ] Schema change ships with the generated `drizzle/*.sql` + `meta/` in the same PR, and the SQL was read.
- [ ] No new claim of "automatic audit logging" (see Audit trail).
