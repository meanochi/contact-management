---
name: expertise-nodejs-typescript
description: 'Node.js/TypeScript language and tooling conventions for this project: tsconfig strictness, Zod schema → TS type inference, npm workspaces monorepo mechanics, module system, async/error handling, and Node-level security hygiene. Use when writing or reviewing backend .ts/.js logic, npm workspace/turbo.json config, or Zod schema/inferred-type definitions, or when deciding a Node/TypeScript version or tooling question. Not for API route/URL/response-shape design (see expertise-api-rest), React/Next.js component or caching decisions (see expertise-react-nextjs), Drizzle schema/query modeling (see expertise-postgres-drizzle), or Jest/RTL test setup (see expertise-testing).'
---

# Node.js + TypeScript Conventions

Universal engineering principles (simplicity, naming, DRY-as-judgment-call, over-engineering, comments, error-handling philosophy) live in `expertise-code-quality` — read that first; this file only adds what's specific to Node.js/TypeScript on top of it.

**Markers used below:** *Project rule* = must follow, this is a decided convention for this codebase. *Recommendation* = good default; deviate only with a reason.

**Versions:** Node.js and TypeScript both ship majors on a fast, changing cadence. Don't assert a specific version's behavior from memory — check `package.json` (`engines`, `devDependencies`) and `.nvmrc` for what this project actually targets before relying on version-specific behavior (e.g. whether native TS execution, a specific `tsc` speedup, or a syntax feature is available here).

## Before writing new code

Read a sibling first: `packages/shared-schemas/src/contacts/` for the schema/type pairing, `apps/api/tsconfig.json` and `packages/config/tsconfig.base.json` for the tsconfig baseline, `apps/api/src/common/` for the error-handling pieces. Where the code and this skill disagree, the committed code is the source of truth — match its shape instead of re-deriving the pattern here, and flag the disagreement so one of them gets fixed.

## TypeScript: strictness baseline

*Project rule:* new or updated packages/files must compile under this `tsconfig.json` baseline (adopt now — retrofitting onto a larger codebase later is far more painful):

```jsonc
{
  "compilerOptions": {
    "strict": true,                          // umbrella: noImplicitAny, strictNullChecks, etc.
    "noUncheckedIndexedAccess": true,         // arr[i] / obj[key] is T | undefined, not T
    "exactOptionalPropertyTypes": true,       // { x?: string } forbids explicitly assigning undefined
    "noPropertyAccessFromIndexSignature": true,
    "verbatimModuleSyntax": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

`strict: true` alone is not "fully strict" — `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are not part of the `strict` umbrella and are commonly missed. Both matter concretely here: database results are often read via indexing (`rows[0]`), and Zod-validated payloads have genuinely optional fields (see the `null`/`undefined` section below).

- *Project rule:* `tsc --noEmit` is a required CI gate, separate from Jest.
- *Project rule:* use `unknown` at trust boundaries (parsed JSON, request bodies, external API responses) and narrow explicitly — never `any` as a shortcut, never a file-level `@ts-nocheck` to unblock a PR. A narrowly-scoped `@ts-expect-error` with a comment is acceptable for a genuine library gap.
- *Project rule:* don't use TS `enum` or `namespace` (both are non-erasable and complicate type-stripping/interop) — use `as const` object literals + derived unions:
  ```ts
  export const ContactStatus = { ACTIVE: "ACTIVE", INACTIVE: "INACTIVE" } as const;
  export type ContactStatus = (typeof ContactStatus)[keyof typeof ContactStatus];
  ```

## Zod schemas ⇄ TypeScript types ⇄ Drizzle rows

(Table/column design belongs to `expertise-postgres-drizzle` — this section is about the validation boundary and the types derived from it.)

This project uses **Zod 4** as the single validation library, on both sides of the wire. **The schema is the type**: DTO types are inferred from the schema, so there is no hand-written `types.ts` interface that can drift from validation.

- *Project rule:* colocate per resource at `packages/shared-schemas/src/<resource>/` — not inside `apps/web` or `apps/api` — since both `apps/web` (React Hook Form via `zodResolver`) and `apps/api` (`ZodValidationPipe`) import the same schema (`expertise-code-quality`, Project Structure). Each resource folder has:
  - `schema.ts` — the Zod schemas: one per operation (`createContactSchema`, `updateContactSchema`, `listContactsQuerySchema`, …) **and one per response shape** (`contactSchema`) — the response schema also drives the Swagger docs (`expertise-api-rest`).
  - `types.ts` — **only** `z.output<typeof schema>` / `z.input<typeof schema>` aliases (plus tiny result wrappers such as `ListContactsResult`). Never write a parallel `interface` by hand.
  - `index.ts` — `export *` of both, wired into the package's `exports` map.
- *Project rule:* `z.output` is what a service receives (defaults applied, transforms run); `z.input` is what a form/client sends. Use `output` for service signatures and DTOs; use `input` where a form's field values are typed before validation.
- *Project rule:* strings from HTTP are coerced in the schema: `z.coerce.number()` for numbers and **`z.stringbool()` for booleans** (never `z.coerce.boolean()` — it turns `"false"` into `true`). Free-text fields that mean "clear this" (notes) accept `""`; the *service* turns it into `null`.
- *Project rule — every user-visible message is Hebrew* (the users do not read English), and lives in the schema, never in a component. Zod 4 uses the `error` option (`.min(1, { error: "…" })`), not Zod 3's `message`/`errorMap`. Two mechanisms, both in `packages/shared-schemas/src/fields.ts` (imported by every schema file): (1) the Hebrew locale is installed globally (`z.config(z.locales.he())`) so a rule with no explicit message is still Hebrew — technical wording, but never English; (2) user-facing rules get a plain, specific message through the helpers `requiredText(max)`, `requiredChoice(msg)`, `nonEmptyIdList(msg)`, `requiredFlag()` and the `REQUIRED` / `maxLengthMessage` constants. Use the helpers instead of bare `z.string().min(1)` for any field a person types or picks. `hebrew-messages.test.ts` feeds every request schema wrong values and fails if any message has no Hebrew letters — add each new request schema to its list. Technical identifiers in logs and the Swagger text may stay English; anything a person can read in the UI may not.
- *Project rule:* "at least one field" PATCH schemas use `.refine(...)`; unknown keys are stripped by `z.object` (don't use `.strict()` unless rejecting unknown keys is the actual requirement).
- *Project rule:* never use a Drizzle row type (`typeof contacts.$inferSelect`) as a request-body type. Row types describe what's *in the database*; schemas describe what's *acceptable as input*. Validate with the schema first, then use its narrower inferred type. Conversely, don't leak a whole row as a response — map to the response DTO (`toDto`).
- *Project rule — the most common bug here:* SQL "no value" is `null`; idiomatic optional input fields are `undefined`. With `exactOptionalPropertyTypes` on, `{ notes: null }`, `{ notes: undefined }` and `{}` are three distinct states:
  - Drizzle → API response: DTO fields for nullable columns are `.nullable()` (`notes: string | null`); keep that 1:1 with the column, and say so in the schema.
  - API input → Drizzle write: in `.set({...})` an omitted key means "leave unchanged" and `null` means "set NULL". Build `.set()` with conditional spreads (`...(input.role !== undefined ? { role: blankToNull(input.role) } : {})`); never assign `undefined`, and don't coerce an absent field to `null`.
- *Recommendation:* when a rule can't be expressed by the schema (a value must belong to a set only the database knows), keep the schema purely structural and enforce the rest in the service, throwing the same `{ code, message, details }` shape the pipe uses.
- *Recommendation:* when a form's value type differs from a partial PATCH schema's input type, cast the resolver at the one call site (`zodResolver(schema) as Resolver<FormValues>`) with a comment, instead of weakening the schema.

## Module system: ESM, with one explicit, bounded exception for `apps/api`

- *Project rule:* `"type": "module"` at the root and in every workspace package's `package.json` — never mix `module`/`commonjs` between internal packages. **Except `apps/api` — see below.**
- **Exception — `apps/api` (NestJS) is CommonJS (`"type": "commonjs"`, or the field omitted, which defaults to the same thing), not ESM.** This is a deliberate, scoped carve-out, not an oversight: NestJS's Dependency Injection relies on `reflect-metadata`-based decorator reflection, which is battle-tested under CommonJS (it's what `nest new` itself scaffolds by default) and a meaningfully less-proven combination under full ESM — the risk is a pure-tooling failure (DI can't resolve a provider) unrelated to any feature code, not a style preference. Nothing else in the monorepo is affected: `apps/web` and every `packages/*` stay ESM exactly as below. If NestJS's own ESM support matures into the clearly-recommended default later, revisit this — don't carry the exception forward out of inertia once the reason for it is gone.
- *Recommendation (applies to the ESM side of the monorepo — `apps/web`, `packages/*`):* use `NodeNext` resolution; relative imports in raw `.ts` sources need explicit `.js` extensions in compiled output (`import { x } from "./util.js"` even though the source is `util.ts`). Next.js's own bundler is more lenient than plain `tsc`/`node` — but any package meant to run standalone (scripts, shared packages consumed outside Next's bundler) should follow the strict rule.
- *Recommendation:* watch for CJS-only dependencies inside a shared workspace package consumed by `apps/web` — mixing a CJS internal package with the ESM-first app is a known source of silent load failures or stale rebuilds in npm-workspace setups. Prefer ESM throughout internal packages; for a CJS-only third-party dependency, use default-import interop (`import pkg from "cjs-package"`) rather than forcing a named-export shape.
- **Direct consequence of the `apps/api` exception — `packages/db` is CommonJS too, not ESM.** A CommonJS file's `require()` **cannot** load an ESM-only package synchronously (Node throws `ERR_REQUIRE_ESM`) — this isn't a "special case to design around," it's a hard failure. Since `packages/db` is reachable only from `apps/api` (`ARCHITECTURE-SPINE.md` AD-1 — `apps/web` never touches it), there's no ESM consumer to accommodate, so it's simplest and safest for `packages/db` to match `apps/api` and be CommonJS outright.
- **`packages/shared-schemas` is CommonJS too, for the same reason — it has two consumers on two different module systems.** `apps/web` (ESM) can `import` a CommonJS package without issue (ESM→CJS interop is always supported, just not the reverse) — so making `shared-schemas` CommonJS satisfies `apps/api`'s hard requirement without breaking `apps/web`. Making it ESM instead would satisfy `apps/web` but break `apps/api` outright. `packages/ui` and `packages/config` have no CJS consumer, so they stay ESM as originally stated.
- *Recommendation:* avoid `require()` in new code — outside `apps/api`, where it's the native idiom under CommonJS.

## npm workspaces (this project uses npm, not pnpm — don't introduce pnpm/yarn tooling or `workspace:` syntax)

- *Project rule:* every workspace package must explicitly list every package it directly imports in its own `package.json`, even if it would resolve anyway via npm's root hoisting. This is the main npm-workspaces footgun: a package can import something only because a sibling workspace's dependency got hoisted to the root, and it breaks the moment install order changes or that package is built/installed in isolation (a Docker build stage, extraction as a standalone package).
- *Recommendation:* periodically sanity-check with `depcheck` per workspace, or a clean install of one workspace in isolation, to catch anything that only worked by hoisting accident.
- **Structure:**
  - Root `package.json`: `"workspaces": [...]` glob, shared devDependencies used repo-wide (TypeScript, ESLint, Jest config, Prettier), Turborepo scripts fanned out via `turbo run <script>`.
  - Each package: its own `name`/`version` (`"private": true` if internal-only), its own explicit `dependencies` (per the rule above), its own `build`/`test`/`lint` scripts so Turborepo can target and cache it individually.
  - Internal cross-package imports use the package's `name` (e.g. `@contact-management/shared-schemas`) pinned with a plain semver range, `*`, or `file:` — npm workspaces has no `workspace:` protocol; keep internal versions in sync manually.
- *Project rule:* run installs from the repo root (`npm install`), never inside a workspace folder; add a dependency with `npm install <pkg> --workspace=<name>` so it lands in the right `package.json`/lockfile — never hand-edit `node_modules` or assume hoisting will cover an undeclared import.
- *Recommendation:* use `npm run <script> --workspace=<name>` (or `-w`) to target one package, `turbo run <script>` for cached/orchestrated multi-package runs — and keep each package's actual file reads within its declared Turborepo inputs (reaching into a sibling's `src/` directly instead of its built/exported entry point can produce stale cache hits).

## Async & error handling

- *Recommendation:* `async`/`await` as the baseline; no raw callback-style code, no dangling `.then()` where `await` reads more clearly.
- *Project rule:* never swallow an error silently (`catch (e) { console.log(e) }` and carry on). Either handle it meaningfully or re-throw, chaining context with `Error.cause` so the original stack isn't lost:
  ```ts
  throw new Error("Failed to create contact", { cause: err });
  ```
- *Recommendation:* distinguish operational errors (a Zod validation failure, a "not found" — expected, handle it and return a proper status) from programmer errors (a `TypeError` from a real bug — let it surface as a logged failure, don't paper over it with a catch-all that returns success).
- *Recommendation:* `Promise.allSettled` and `Promise.all` answer different questions — pick by whether a partial failure is acceptable, not by habit. Use `allSettled` when the operations are independent and one failing shouldn't stop the others (e.g. notifying several contacts — some emails bouncing shouldn't block the rest). Use `Promise.all` when the operations form one unit of work and any single failure must abort the whole thing (e.g. a multi-step write where a partial result would be invalid data) — `Promise.all`'s fail-fast behavior is the correct choice there, not a legacy option `allSettled` has superseded.
- Log through Nest's `Logger`, never `console.log` (the lint rule allows only `console.warn`/`console.error`, for the few places outside Nest such as `packages/db`'s pool error handler and `seed.ts`) — see `expertise-observability`.
- The actual HTTP error-response envelope for route handlers is defined in `expertise-api-rest` — this section is about error-handling discipline in plain TS/Node logic, not the wire format.

## Security basics (Node/TS-scoped only — there is no dedicated security skill in this project, but keep this section limited to what's genuinely language/runtime-level)

- *Project rule:* Zod validation (the `unknown`-until-validated rule is in the Zod section above; the shared Pipe itself lives in `expertise-api-rest`) is a required security boundary for untrusted input, not just a type-safety nicety — never skip it because a value "looks fine" coming from an internal caller. It is **one layer, not the whole defense**: it doesn't replace authorization checks (the global Guard in `apps/api`, `ARCHITECTURE-SPINE.md` AD-4), DB-level constraints (a `UNIQUE` constraint still matters even though Zod checked shape — see `expertise-postgres-drizzle`), or rate limiting on public endpoints (`expertise-api-rest`). A value can be perfectly valid Zod-wise and still be a request from someone who isn't allowed to make it.
- *Project rule:* secrets (DB connection string, auth secrets, API keys) live only in git-ignored env files — never hard-coded, never logged. The same goes for personal data (names, ID numbers, phones, emails, free text): log ids and counts only (`expertise-observability`). Validate required env vars at startup and fail fast rather than discovering a missing secret mid-request.
- *Recommendation:* run `npm audit` in CI, keep dependencies current, double-check package names before installing (typosquatting risk). This matters more in an npm workspace monorepo, since a compromised dependency hoisted to the root can be reachable from a sibling workspace that never declared it.
- *Recommendation:* never build queries via string concatenation — Drizzle's query builder and the `sql` tagged template parameterise values; don't bypass them with `sql.raw()` or a hand-built string on user input.
- *If a file-upload feature is added later* (none planned as of this writing): verify type from magic bytes, not client-supplied MIME/extension; cap size before buffering; store outside the served-static path; never trust a user-supplied filename for the storage path.

## Code quality for Node.js/TypeScript

- *Recommendation:* keep business logic in pure functions and push I/O (database calls, network requests, `Date.now()`/`process.env` reads) to the edges of a module — a function that both computes and fetches is hard to unit-test without mocking half the runtime. This project's schema / service / controller split is the natural seam: keep the controller thin (parse → call the service), put rules and data access in the service, and pull pure helpers (`blankToNull`, `containsPattern`, `toDto`) out of the I/O.
- *Recommendation:* prefer guard clauses/early returns over nested `if`/`else` or callback pyramids, especially in schema-validated handlers with several sequential checks (auth → validation → domain rule → not-found) — each check should exit early, not add another nesting level.
- *Recommendation:* avoid unexplained string/number literals (a magic `"ADMIN"`, a retry count `3`, a length `200`) scattered across logic — name them as a constant or an `as const` object (per the enum convention above) once a value is checked more than once or its meaning isn't obvious from context alone.
- *Recommendation:* prefer a small number of narrow, explicit parameters over a single "options bag" with many optional fields — under this project's `exactOptionalPropertyTypes` baseline, an options object multiplies the `null`/`undefined`/absent-key ambiguity described above across every optional field instead of confining it to one documented DTO boundary.

## Before marking work done

- [ ] `tsc --noEmit` passes under the strict baseline above (no new `any`/`@ts-nocheck` added to get there).
- [ ] Any new/changed resource has its Zod schema in `packages/shared-schemas`, and the service and form use the type inferred from it — no hand-written parallel interface.
- [ ] `null` vs `undefined` handling at the Drizzle boundary is deliberate, not accidental, for any field touched.
- [ ] Any new dependency is declared in the *specific* workspace package's own `package.json`, not left to hoisting.
- [ ] No secret is hard-coded or logged; config still comes from env vars.
- [ ] No error is silently swallowed — every `catch` handles or re-throws (with `cause` where context matters).
