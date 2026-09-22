---
name: expertise-postgres-prisma
description: 'PostgreSQL/Prisma schema and query conventions for this project: schema design for Domain/SupportedBody/Contact/RegistrationRequest, migrations, the mandatory audit-trail Client Extension, and domain-scoped query filtering. Use when writing or reviewing schema.prisma changes, migrations, Prisma queries or Client Extensions, or soft-delete/audit-trail/domain-filtering implementation. Not for generic TypeScript/Node conventions (expertise-nodejs-typescript), API route/response shape (expertise-api-rest), or Jest test setup (expertise-testing).'
---

# PostgreSQL + Prisma Conventions for This Project

> Universal code-quality principles (simplicity, naming, DRY, error handling) live in `expertise-code-quality` and apply here too — this file only covers what's specific to Prisma/Postgres.

> **Versions go stale, this doc shouldn't lie about them.** Before relying on any version-specific detail below (driver adapters, config file location, CLI flag behavior), check the actually-installed version in this repo (`package.json`, `prisma.config.ts`) rather than trusting a number written here. The one exception: **Prisma 7 permanently removed `prisma.$use()`.** That's not a style preference that might change back — it's a compatibility cliff. If the installed major is 7 or later, `$use` does not exist; Client Extensions (`$extends`) are the only interception mechanism.

**This project is greenfield: no `schema.prisma` and no `packages/db` exist yet.** The schema and extension code in this file (including the audit-trail extension below) are the canonical patterns the first implementation should establish — write them, don't wait for a repo example that doesn't exist. Once `schema.prisma` and `packages/db/src/**` are real, **check them first** before any later schema change, query, or extension: match their actual naming/id/timestamp/extension conventions, and if the real code has diverged from an example here, the real code wins over this doc.

---

## Mandatory rules vs. recommendations

**Mandatory — enforced project conventions, not style choices:**

1. **Contact is soft-delete only.** Never call `prisma.contact.delete()`. See "Soft delete rules" below.
2. **Audit trail is automatic via Client Extensions (`$extends`), one extended client, applied once, writing through `Prisma.getExtensionContext(this)` so each audit row shares its mutation's transaction.** A mutation spanning more than one model (e.g. approving a registration) still needs an explicit `prisma.$transaction(async (tx) => ...)` at the call site — the extension makes each write's *own* audit row atomic with it, it doesn't group unrelated writes together. `$use` isn't available on this project's Prisma version. See "Audit trail" below.
3. **Domain-scoped queries go through that model's own named `scopeX` helper** (`scopeContact`, `scopeSupportedBody`, …) — never an ad hoc inline `where: { domainId }` copy-pasted between models that don't reach their domain the same way. This is the Prisma-layer implication of the project's centralized-middleware permission architecture (`proxy.ts`); that architectural choice itself is decided elsewhere (see `expertise-api-rest` §1) and is not re-argued here.

**Recommendations — current best practice, apply judgment:**

- Exact Prisma/Postgres version behavior (driver adapters, config file, migrate workflow) — verify against the installed version.
- Connection pooling strategy — revisit if/when hosting becomes serverless.
- Test tiering for Prisma-backed code (unit vs. integration) — see `expertise-testing` for Jest/RTL mechanics, this file only covers what's Prisma-specific.

---

## Schema design for this project's entities

### Domain (תחום) — admin-managed lookup table

Model as a real table, not a Prisma `enum` — admins add/rename/deactivate domains at runtime without a migration.

```prisma
model Domain {
  id        String   @id @default(cuid())
  name      String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  supportedBodies SupportedBody[]
  contacts        Contact[]
}
```

Use `isActive` to soft-disable. Never delete a `Domain` referenced by historical `Contact`/`SupportedBody` rows — same reasoning as the Contact soft-delete rule below.

### SupportedBody (גוף נתמך) — unique company id

```prisma
model SupportedBody {
  id        String   @id @default(cuid())
  companyId String   @unique @map("company_id") // ח"פ
  name      String
  domainId  String   @map("domain_id")
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  domain               Domain                   @relation(fields: [domainId], references: [id])
  contacts             ContactOnSupportedBody[]
  registrationRequests RegistrationRequest[]

  @@index([domainId])
}
```

`companyId` (ח"פ) is the natural business key — enforce uniqueness with `@unique` at the DB level, not only in application code. A bulk import or a second entry point can race past an app-level check; a DB constraint can't be raced past.

### Contact — soft delete, many-to-many with SupportedBody

Use an explicit status enum, not a boolean, so the model can grow (e.g. a future `PENDING` state) without another migration:

```prisma
enum ContactStatus {
  ACTIVE
  INACTIVE
}

// FR-9: which channel an out-of-system update/removal request came in on.
enum ExternalRequestSource {
  PHONE
  EMAIL
  OTHER
}

model Contact {
  id         String        @id @default(cuid())
  fullName   String        @map("full_name")
  role       String?
  emails     String[]      @default([]) // FR-10: more than one address is supported per contact
  phone      String?
  notes      String?
  emailOptIn Boolean       @default(false) @map("email_opt_in")
  smsOptIn   Boolean       @default(false) @map("sms_opt_in")
  domainId   String?       @map("domain_id") // FR-7: direct domain/department assignment, independent of any linked SupportedBody's own domain
  status     ContactStatus @default(ACTIVE)
  deactivatedAt DateTime?  @map("deactivated_at")
  // FR-9: required together whenever the status change came from outside the app (phone/email) rather than the UI itself.
  externalRequestSource ExternalRequestSource? @map("external_request_source")
  externalRequestDate   DateTime?              @map("external_request_date")
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt

  domain          Domain?                   @relation(fields: [domainId], references: [id])
  supportedBodies ContactOnSupportedBody[]

  @@index([status])
  @@index([domainId])
}

// Explicit join model, not an implicit m2m: this project will want columns on
// the relation itself (role at that body, assignedAt), and it makes the
// relation auditable like any other model.
model ContactOnSupportedBody {
  contactId       String   @map("contact_id")
  supportedBodyId String   @map("supported_body_id")
  createdAt       DateTime @default(now())

  contact       Contact       @relation(fields: [contactId], references: [id])
  supportedBody SupportedBody @relation(fields: [supportedBodyId], references: [id])

  @@id([contactId, supportedBodyId])
  @@index([supportedBodyId])
}
```

**Soft delete rules (mandatory):**
- Never call `prisma.contact.delete()` in application code. Enforce in code review; for a hard backstop, `REVOKE DELETE` on the `Contact` table for the app's DB role, or make the audit extension (below) throw on a real `delete` unless an explicit internal escape-hatch flag is set.
- "Delete" from the UI means `status: INACTIVE, deactivatedAt: now()`. All list/lookup queries default to `where: { status: 'ACTIVE' }` — put this behind one repository-layer helper so it's not reimplemented (and forgotten) per call site.
- Keep `status` indexed since it's filtered on almost everywhere; consider a partial index (`WHERE status = 'ACTIVE'`) via a raw-SQL migration if active-row lookups become a hot path.

### RegistrationRequest — approval workflow

```prisma
enum RegistrationRequestStatus {
  PENDING
  APPROVED
  REJECTED
}

model RegistrationRequest {
  id              String                    @id @default(cuid())
  payload         Json                      // the submitted form, kept verbatim for audit
  status          RegistrationRequestStatus @default(PENDING)
  supportedBodyId String?                   @map("supported_body_id") // nullable until FR-14's ח"פ match resolves it (or a coordinator assigns/creates one)
  reason          String?                   // set on reject, FR-16
  infoRequestedAt DateTime?                 @map("info_requested_at") // FR-16's "request completion" action — status stays PENDING, submitter is re-notified per FR-18
  reviewedById    String?                   @map("reviewed_by_id")
  reviewedAt      DateTime?                 @map("reviewed_at")
  createdAt       DateTime                  @default(now())

  supportedBody SupportedBody? @relation(fields: [supportedBodyId], references: [id])

  @@index([status])
  @@index([supportedBodyId])
}
```

Keep the raw `payload` even after approval/rejection — it's the record of what was actually submitted, independent of the `AuditLog` rows written for the `Contact`/`SupportedBody` records later created from it.

---

## Audit trail: Client Extensions (mandatory)

`prisma.$use()` does not exist on this project's Prisma version — do not write it, and don't trust an online example that uses it without checking its date. **Client Extensions (`$extends`) are the only supported way to intercept queries**, and this project requires audit logging to be automatic (applied once, globally), not something each endpoint remembers to call.

### Shape of the solution

1. An `AuditLog` table.
2. One Client Extension, applied once where `PrismaClient` is constructed in `packages/db`, so every consumer in the monorepo gets diff/logging *logic* for free.
3. The extension intercepts `create`/`update`/`delete`/`updateMany`/`deleteMany` on every model and diffs before/after where possible.
4. "Who" comes from **AsyncLocalStorage**-backed request context (set once per request), not passed manually into every call.
5. **Atomicity is a separate concern from the extension itself — see "Making it atomic" below before treating the snippet as production-ready.** A generic `$allOperations` hook calling the top-level `prisma.auditLog.create(...)` runs as a *second, independent* write, not inside the same transaction as the mutation it's logging — a crash between the two leaves one without the other. Don't ship the extension alone and assume it's atomic because it "runs automatically."

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  tableName   String   @map("table_name")
  recordId    String   @map("record_id")
  action      String   // "CREATE" | "UPDATE" | "DELETE"
  before      Json?
  after       Json?
  changedById String?  @map("changed_by_id")
  changedAt   DateTime @default(now())

  @@index([tableName, recordId])
  @@index([changedById])
}
```

```ts
// packages/db/src/audit-context.ts
import { AsyncLocalStorage } from "node:async_hooks";

export const auditContext = new AsyncLocalStorage<{ userId: string }>();

// call once per incoming request, wrapping the handler. `currentUser` comes from
// the Auth.js (AD-9) session resolved in proxy.ts — this file only consumes it,
// it doesn't establish the session itself:
// auditContext.run({ userId: currentUser.id }, () => handler(req, res));
```

```ts
// packages/db/src/client.ts
import { Prisma, PrismaClient } from "./generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { auditContext } from "./audit-context";

const AUDITED_WRITE_OPS = new Set(["create", "update", "delete", "updateMany", "deleteMany"]);

// Prisma's $allOperations spans every model generically — there is no static type
// linking the string `model` name to its specific delegate. This is a documented
// limitation of $allModels/$allOperations, not a shortcut, and it's the one place
// in this codebase where `expertise-nodejs-typescript`'s "no `any`" rule doesn't
// apply cleanly. Kept isolated to this single structural type instead of `any`:
type DelegateWithFindUnique = { findUnique: (args: { where: unknown }) => Promise<unknown> };

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter }).$extends({
  name: "auditLog",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (model === "AuditLog" || !AUDITED_WRITE_OPS.has(operation)) {
          return query(args);
        }

        const userId = auditContext.getStore()?.userId ?? null;

        // Prisma.getExtensionContext(this) resolves to whichever client instance
        // is actually running this operation: the module-level `prisma` for a
        // standalone call, or the `tx` client when this was invoked as
        // `tx.contact.update(...)` inside `prisma.$transaction(async (tx) => ...)`.
        // Using it (not the outer `prisma` closure) for both the "before" read and
        // the audit insert is what makes the audit row participate in the SAME
        // Postgres transaction as the mutation, automatically, whenever the caller
        // issued the mutation via `tx` — this is the atomicity fix, not an add-on.
        const ctx = Prisma.getExtensionContext(this);
        const delegate = (ctx as unknown as Record<string, DelegateWithFindUnique>)[uncapitalize(model)];

        const before =
          operation === "update" || operation === "delete"
            ? await delegate.findUnique({ where: (args as { where: unknown }).where })
            : null;

        const result = await query(args);

        await (ctx as unknown as { auditLog: { create: (a: unknown) => Promise<unknown> } }).auditLog.create({
          data: {
            tableName: model,
            recordId: (result as { id?: string } | null)?.id ?? (args as { where?: { id?: string } })?.where?.id ?? "unknown",
            action: operation.toUpperCase(),
            before: before ?? undefined,
            after: operation === "delete" ? undefined : (result as Record<string, unknown>),
            changedById: userId,
          },
        });

        return result;
      },
    },
  },
});

function uncapitalize(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
```

**Making it atomic:** a single-model mutation (`prisma.contact.update(...)`) is already atomic with its own audit row — `Prisma.getExtensionContext(this)` above guarantees that. **What still needs an explicit `$transaction` is grouping *multiple* mutations into one all-or-nothing unit** — e.g. approving a `RegistrationRequest` writes both a `Contact` and the request's `status`:

```ts
// service layer — the caller decides the transaction boundary, not the extension
await prisma.$transaction(async (tx) => {
  await tx.contact.upsert({ /* ... */ });
  await tx.registrationRequest.update({ where: { id }, data: { status: "APPROVED" } });
});
// Both writes AND both their audit rows share this one transaction — if the
// second write fails, the first (and its audit row) rolls back too.
```

If a bulk (`updateMany`/`deleteMany`) call ever needs true row-level audit despite Prisma not returning affected rows for those operations, loop single `update`s inside a `$transaction` instead of calling the bulk method on an audited model — don't silently accept unaudited bulk writes.

**If this project ever needs audit integrity that survives even a raw `psql` write bypassing the app entirely** (a stronger guarantee than anything above, and stronger than this MVP's actual requirement — NFR-B is an accountability log for actions taken *through* the app): a PostgreSQL `AFTER INSERT/UPDATE/DELETE` trigger is atomic by construction at the DB layer, with "who" carried via a session variable (`SET LOCAL app.current_user_id = '...'`) read through `current_setting(...)` in the trigger. That's a heavier, PL/pgSQL-based alternative to the extension above, not a default — don't build it speculatively now.

Other caveats to preserve:
- `updateMany`/`deleteMany` don't return affected rows, so `$allOperations` can't give a clean per-row before/after for them. Per model, either (a) forbid bulk ops on audited models and require callers to loop single `update`s inside an explicit `$transaction`, or (b) `findMany` with the same `where` immediately before the bulk op to snapshot affected rows. Never silently skip audit rows for bulk operations — decide explicitly.
- The `model === "AuditLog"` guard is required to avoid infinite recursion — the extension would otherwise intercept its own audit-row writes.
- Apply the extension exactly once, in `packages/db`, and export only the extended client. **Never construct a second, unextended `PrismaClient` anywhere else** — that silently bypasses auditing, which is the exact failure mode this design exists to prevent.

---

## Domain-scoped filtering (mandatory — Prisma-layer implication only)

The architecture decision — centralized permission enforcement in `proxy.ts`, not per-endpoint checks and not Postgres RLS — is made elsewhere (see the architecture doc and `expertise-api-rest` §1); this skill doesn't re-argue it, only implements its data-layer consequence.

**Rule:** every read/write against a domain-scoped model must go through one shared, **named-per-model** helper that injects the domain filter from the authenticated request's context — never a hand-rolled inline filter in a repository function. Wire it as a sibling to the audit extension, sharing the same `AsyncLocalStorage` context (extend it with `domainId` alongside `userId`).

**There is no single generic filter shape — `domainId` isn't the same kind of field on every scoped model, per the schema above:**

```ts
// packages/db/src/domain-scope.ts
import type { Prisma } from "./generated/prisma";

// SupportedBody has domainId directly — a flat filter.
export function scopeSupportedBody<T extends { where?: Prisma.SupportedBodyWhereInput }>(
  args: T,
  domainId: string,
): T {
  return { ...args, where: { ...(args.where ?? {}), domainId } };
}

// Contact reaches a domain two ways: its own direct `domainId` (FR-7) and,
// indirectly, via ContactOnSupportedBody -> SupportedBody.domainId. Scope on
// either path — a flat `where: { domainId }` alone would miss contacts that
// are only reachable through a SupportedBody, so don't copy the
// SupportedBody shape here.
export function scopeContact<T extends { where?: Prisma.ContactWhereInput }>(
  args: T,
  domainId: string,
): T {
  return {
    ...args,
    where: {
      ...(args.where ?? {}),
      OR: [{ domainId }, { supportedBodies: { some: { supportedBody: { domainId } } } }],
    },
  };
}
```

Add one `scopeX` function per domain-scoped model as it's introduced — each is type-checked against that model's actual `WhereInput`, so a schema change that moves how a model reaches its domain (e.g. Contact's relation path) breaks the helper at compile time instead of silently scoping nothing. This is more typing than one generic function, but a generic one is exactly what produced the bug this section is now written to avoid — don't re-introduce a one-size-fits-all helper for the sake of looking simpler.

Revisit the RLS-vs-middleware decision only if a second direct DB consumer appears (a reporting tool, another service) — that's an architecture-level call, not something to change unilaterally from inside a Prisma query.

---

## Query-level code quality (Prisma-specific)

Universal principles (simplicity, naming, DRY) are in `expertise-code-quality` — this only covers what's specific to writing Prisma queries well.

- **Avoid N+1 queries.** Never loop over a list calling `prisma.x.findUnique`/`findFirst` once per item (e.g. resolving each contact's supported bodies one at a time when rendering the contacts list). Use a nested `include`/`select` on the parent query, or one batched `findMany({ where: { id: { in: [...] } } })`. This is the single most common real-world Prisma performance mistake, and it hits directly on this app's list screens (contacts, supported bodies).
- **Select only the fields the screen needs.** Default to an explicit `select` (or `include` with a nested `select`) instead of always fetching full records — a list view rendering three columns shouldn't pull every column of `Contact`/`SupportedBody`. Fetch the full record only where the caller actually needs it (e.g. an edit form).
- **Wrap genuinely multi-step writes in `$transaction`.** Anything that changes more than one row and must not partially succeed belongs in `prisma.$transaction([...])` (or the interactive callback form) — not two independent `await`s. Concrete case in this app: approving a `RegistrationRequest` both creates/updates a `Contact` and sets the request's `status` to `APPROVED`; if the second write fails after the first succeeds, the app is left with a live `Contact` and a request permanently stuck at `PENDING`.
- **Index check (verified against the schema above):** `SupportedBody.domainId` (`@@index`), `SupportedBody.companyId` (`@unique`), `Contact.status` (`@@index`), `Contact.domainId` (`@@index`), and `RegistrationRequest.supportedBodyId` (`@@index`) are already covered — no missing index found. Re-run this check whenever a new column gets filtered or sorted on frequently; a query that scans a growing table without an index is a bug that only shows up after the data grows.

---

## Migration workflow

- **Local dev:** each developer runs `prisma migrate dev` against their own Postgres. Commit the generated migration files — `prisma/migrations/**` is source of truth, reviewed in the same PR as the schema change.
- **Shadow database** is needed for `migrate dev`'s drift detection, not for `migrate deploy`. If the dev DB user lacks CREATEDB rights, point `shadowDatabaseUrl` at a separate database explicitly.
- **CI:** run `prisma migrate deploy` against a clean, ephemeral Postgres as a check — this catches migrations that only "worked" locally, and ordering conflicts from two branches adding migrations independently.
- **Production/staging:** only `prisma migrate deploy` ever touches these. Never run `migrate dev` against a shared environment.
- **Migration history conflicts** (two branches with sibling migrations sharing a parent): resolve by rebasing onto `main` and regenerating (`migrate dev` again) rather than hand-editing timestamps.
- Check whether the installed Prisma version auto-runs `generate`/seed after `migrate dev` — recent majors have stopped doing this by default, so confirm the npm script actually chains what you need (`"db:dev": "prisma migrate dev && prisma generate"`).

## Connection pooling — revisit only if hosting becomes serverless

Not urgent while self-hosting with long-lived Node processes (one `PrismaClient`, one adapter-managed pool). If the production target ever becomes serverless (Vercel, etc.), flag these for follow-up rather than solving speculatively now:

- Put a pooler in front (PgBouncer transaction mode, or a managed equivalent) — serverless invocations can each open a new connection against Postgres's hard connection ceiling.
- Transaction-mode pooling breaks named prepared statements and session-scoped `SET`; use the pooled connection string for runtime, the direct connection string for migrations, and reconfirm this if the domain-scoping design ever moves toward session-based RLS (it currently doesn't — see above).

## Testing Prisma-backed code

Mechanics (Jest config, mocking conventions, coverage priorities) live in `expertise-testing` — don't duplicate them here. What's specific to Prisma:

- **Unit tests** of business logic that happens to call Prisma: mock the client with `jest-mock-extended`'s `mockDeep<PrismaClient>()`.
- **Integration tests** of the audit extension, the domain-scope extension, and DB-level constraints (`SupportedBody.companyId` uniqueness, cascade behavior): run against a real Postgres, migrated with `prisma migrate deploy` before the suite. A mock never executes real query interception — never test either extension against a mocked client.
- Reset strategy between integration tests: prefer truncating relevant tables between tests over per-test transaction rollback — multi-model operations already run inside their own `$transaction` (see "Making it atomic" above), so wrapping the whole test in a second, outer transaction too is more likely to cause nested-transaction surprises than to save cleanup work.

---

## Before you finish: verification checklist

- No new/changed code path calls `prisma.contact.delete()` — soft-delete (`status`/`deactivatedAt`) used instead.
- Every mutation on an audited model still flows through the single extended `prisma` client from `packages/db` — no second, unextended `PrismaClient` introduced anywhere.
- Any operation touching more than one model that must succeed or fail together is wrapped in an explicit `prisma.$transaction(async (tx) => ...)` — the extension only makes a single write atomic with its own audit row, not multiple writes atomic with each other.
- Any new bulk (`updateMany`/`deleteMany`) usage on an audited model has an explicit audit-coverage decision (looped single `update`s inside a transaction, since bulk methods don't return affected rows to diff) — not silently unaudited.
- Queries against domain-scoped models go through that model's own `scopeX` helper (e.g. `scopeContact`, `scopeSupportedBody`) — never a copy-pasted `where: { domainId }` that assumes every model reaches its domain the same way.
- New business-key/uniqueness invariants (like `companyId`) are enforced with a DB-level `@unique`/`@@unique`, not only in application code.
- Schema changes ship with a committed migration in the same PR; `generate` is re-run if the installed Prisma version doesn't chain it automatically.
