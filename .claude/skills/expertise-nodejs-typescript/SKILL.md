---
name: expertise-nodejs-typescript
description: 'Node.js/TypeScript language and tooling conventions for this project: tsconfig strictness, Joi-schema/TS-type drift, npm workspaces monorepo mechanics, module system, async/error handling, and Node-level security hygiene. Use when writing or reviewing backend .ts/.js logic, npm workspace/turbo.json config, or Prisma/Joi resource type definitions, or when deciding a Node/TypeScript version or tooling question. Not for API route/URL/response-shape design (see expertise-api-rest), React/Next.js component or caching decisions (see expertise-react-nextjs), Prisma schema/query modeling (see expertise-postgres-prisma), or Jest/RTL test setup (see expertise-testing).'
---

# Node.js + TypeScript Conventions

Universal engineering principles (simplicity, naming, DRY-as-judgment-call, over-engineering, comments, error-handling philosophy) live in `expertise-code-quality` — read that first; this file only adds what's specific to Node.js/TypeScript on top of it.

**Markers used below:** *Project rule* = must follow, this is a decided convention for this codebase. *Recommendation* = good default; deviate only with a reason.

**Versions:** Node.js and TypeScript both ship majors on a fast, changing cadence. Don't assert a specific version's behavior from memory — check `package.json` (`engines`, `devDependencies`) and `.nvmrc` for what this project actually targets before relying on version-specific behavior (e.g. whether native TS execution, a specific `tsc` speedup, or a syntax feature is available here).

## Before writing new code

This repo is greenfield — no `apps/`/`packages/` directories exist yet, so there's no existing backend code to check today. The patterns below (tsconfig baseline, `types.ts`/`schema.ts` pairing, workspace layout) are what the *first* implementation should establish. Once real code exists — a committed `tsconfig.json`, a first resource's `types.ts`/`schema.ts` pair, an error-handling wrapper — treat that file as the source of truth over this skill: read it and match its shape before writing a new one, rather than re-deriving the pattern here or drifting into a second convention.

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

`strict: true` alone is not "fully strict" — `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are not part of the `strict` umbrella and are commonly missed. Both matter concretely here: Prisma results are often read via indexing (`results[0]`), and Joi-validated payloads have genuinely optional fields (see the `null`/`undefined` section below).

- *Project rule:* `tsc --noEmit` is a required CI gate, separate from Jest.
- *Project rule:* use `unknown` at trust boundaries (parsed JSON, request bodies, external API responses) and narrow explicitly — never `any` as a shortcut, never a file-level `@ts-nocheck` to unblock a PR. A narrowly-scoped `@ts-expect-error` with a comment is acceptable for a genuine library gap.
- *Project rule:* don't use TS `enum` or `namespace` (both are non-erasable and complicate type-stripping/interop) — use `as const` object literals + derived unions:
  ```ts
  export const ContactStatus = { ACTIVE: "ACTIVE", INACTIVE: "INACTIVE" } as const;
  export type ContactStatus = (typeof ContactStatus)[keyof typeof ContactStatus];
  ```

## Prisma types + Joi validation: keeping them in sync

(Prisma schema/model design itself belongs to `expertise-postgres-prisma` — this section is only about the TS-type ⇄ Joi-schema boundary once Prisma models exist.)

This project deliberately uses **Joi, not Zod** — so, unlike a Zod setup where the schema *is* the type, the TS type and the Joi schema are two separate, hand-maintained artifacts that can silently drift (a field added to one and not the other). Structure this explicitly:

- *Project rule:* colocate per resource at `packages/shared-schemas/<resource>/` (e.g. `packages/shared-schemas/contacts/`) — not inside `apps/web` or `apps/api` — since both `apps/web` (React Hook Form) and `apps/api` (NestJS Pipe validation), two separate applications, must import the same pair (see `expertise-code-quality`'s Project Structure section): `types.ts` (hand-written DTOs — request/response shapes, structurally aligned with the Prisma model where they overlap) and `schema.ts` (Joi schema per operation shape: `createContactSchema`, `updateContactSchema`, …).
- *Recommendation:* force a compile-time drift check between them, e.g.:
  ```ts
  // schema.ts — Record<keyof T, Joi.Schema> fails to compile if a field is
  // added to/removed from CreateContactInput without updating the schema.
  export const createContactSchema: Record<keyof CreateContactInput, Joi.Schema> = {
    fullName: Joi.string().trim().min(1).max(200).required(),
    emails: Joi.array().items(Joi.string().trim().email()).min(1).required(), // Contact.emails is a list — see expertise-postgres-prisma
    notes: Joi.string().trim().max(2000).optional(),
  };
  ```
  Wrap it in `Joi.object({...}).required()` at the point it's actually used for runtime validation (for unknown-key stripping etc.) — the `Record` typing above exists purely for the compile-time drift check.
- *Project rule:* never use a Prisma-generated model type directly as a route handler's request-body type. Prisma types describe what's *in the database*; Joi schemas describe what's *acceptable as input*. Always validate with Joi first, then use the narrower `types.ts` DTO.
- *Project rule — the most common bug here:* Prisma represents "no value" as `null`; idiomatic optional TS/Joi fields are usually `undefined`. With `exactOptionalPropertyTypes` on, `{ notes: null }`, `{ notes: undefined }`, and `{}` (key absent) are three distinct states, not one. Be deliberate at each boundary:
  - Prisma → API response: either map `null` to `undefined` for optional DTO fields, or keep the DTO nullable (`notes: string | null`) to match Prisma 1:1 — pick one convention per resource and say so in `types.ts`.
  - API input → Prisma write: Prisma treats `undefined` as "don't touch this field" on update, and `null` as "set it to NULL" — these are not interchangeable. Joi's `.optional()` should produce "key absent" (→ `undefined`) for partial updates; don't let absent fields get coerced to `null` before calling Prisma.

## Module system: ESM

- *Project rule:* `"type": "module"` at the root and in every workspace package's `package.json` — never mix `module`/`commonjs` between internal packages.
- *Recommendation:* use `NodeNext` resolution; relative imports in raw `.ts` sources need explicit `.js` extensions in compiled output (`import { x } from "./util.js"` even though the source is `util.ts`). Next.js's own bundler is more lenient than plain `tsc`/`node` — but any package meant to run standalone (scripts, shared packages consumed outside Next's bundler) should follow the strict rule.
- *Recommendation:* watch for CJS-only dependencies inside a shared workspace package consumed by the Next.js app — mixing a CJS internal package with the ESM-first app is a known source of silent load failures or stale rebuilds in npm-workspace setups. Prefer ESM throughout internal packages; for a CJS-only third-party dependency, use default-import interop (`import pkg from "cjs-package"`) rather than forcing a named-export shape.
- *Recommendation:* avoid `require()` in new code.

## npm workspaces (this project uses npm, not pnpm — don't introduce pnpm/yarn tooling or `workspace:` syntax)

- *Project rule:* every workspace package must explicitly list every package it directly imports in its own `package.json`, even if it would resolve anyway via npm's root hoisting. This is the main npm-workspaces footgun: a package can import something only because a sibling workspace's dependency got hoisted to the root, and it breaks the moment install order changes or that package is built/installed in isolation (a Docker build stage, extraction as a standalone package).
- *Recommendation:* periodically sanity-check with `depcheck` per workspace, or a clean install of one workspace in isolation, to catch anything that only worked by hoisting accident.
- **Structure:**
  - Root `package.json`: `"workspaces": [...]` glob, shared devDependencies used repo-wide (TypeScript, ESLint, Jest config, Prettier), Turborepo scripts fanned out via `turbo run <script>`.
  - Each package: its own `name`/`version` (`"private": true` if internal-only), its own explicit `dependencies` (per the rule above), its own `build`/`test`/`lint` scripts so Turborepo can target and cache it individually.
  - Internal cross-package imports use the package's `name` (e.g. `@contact-management/shared-types`) pinned with a plain semver range, `*`, or `file:` — npm workspaces has no `workspace:` protocol; keep internal versions in sync manually.
- *Project rule:* run installs from the repo root (`npm install`), never inside a workspace folder; add a dependency with `npm install <pkg> --workspace=<name>` so it lands in the right `package.json`/lockfile — never hand-edit `node_modules` or assume hoisting will cover an undeclared import.
- *Recommendation:* use `npm run <script> --workspace=<name>` (or `-w`) to target one package, `turbo run <script>` for cached/orchestrated multi-package runs — and keep each package's actual file reads within its declared Turborepo inputs (reaching into a sibling's `src/` directly instead of its built/exported entry point can produce stale cache hits).

## Async & error handling

- *Recommendation:* `async`/`await` as the baseline; no raw callback-style code, no dangling `.then()` where `await` reads more clearly.
- *Project rule:* never swallow an error silently (`catch (e) { console.log(e) }` and carry on). Either handle it meaningfully or re-throw, chaining context with `Error.cause` so the original stack isn't lost:
  ```ts
  throw new Error("Failed to create contact", { cause: err });
  ```
- *Recommendation:* distinguish operational errors (a Joi validation failure, a "not found" — expected, handle it and return a proper status) from programmer errors (a `TypeError` from a real bug — let it surface as a logged failure, don't paper over it with a catch-all that returns success).
- *Recommendation:* `Promise.allSettled` and `Promise.all` answer different questions — pick by whether a partial failure is acceptable, not by habit. Use `allSettled` when the operations are independent and one failing shouldn't stop the others (e.g. notifying several contacts — some emails bouncing shouldn't block the rest). Use `Promise.all` when the operations form one unit of work and any single failure must abort the whole thing (e.g. a multi-step write where a partial result would be invalid data) — `Promise.all`'s fail-fast behavior is the correct choice there, not a legacy option `allSettled` has superseded.
- The actual HTTP error-response envelope for route handlers is defined in `expertise-api-rest` — this section is about error-handling discipline in plain TS/Node logic, not the wire format.

## Security basics (Node/TS-scoped only — there is no dedicated security skill in this project, but keep this section limited to what's genuinely language/runtime-level)

- *Project rule:* Joi validation (the `unknown`-until-validated rule is in the TS/Joi section above; the shared Pipe itself lives in `expertise-api-rest`) is a required security boundary for untrusted input, not just a type-safety nicety — never skip it because a value "looks fine" coming from an internal caller. It is **one layer, not the whole defense**: it doesn't replace authorization checks (the global Guard in `apps/api`, `ARCHITECTURE-SPINE.md` AD-4), DB-level constraints (a `@unique` still matters even though Joi checked shape — see `expertise-postgres-prisma`), or rate limiting on public endpoints (`expertise-api-rest`). A value can be perfectly valid Joi-wise and still be a request from someone who isn't allowed to make it.
- *Project rule:* secrets (DB connection string, auth secrets, API keys) live only in git-ignored env files — never hard-coded, never logged. Validate required env vars at startup and fail fast rather than discovering a missing secret mid-request.
- *Recommendation:* run `npm audit` in CI, keep dependencies current, double-check package names before installing (typosquatting risk). This matters more in an npm workspace monorepo, since a compromised dependency hoisted to the root can be reachable from a sibling workspace that never declared it.
- *Recommendation:* never build queries via string concatenation — Prisma's query builder already prevents this; don't bypass it with `$queryRawUnsafe` on user input.
- *If a file-upload feature is added later* (none planned as of this writing): verify type from magic bytes, not client-supplied MIME/extension; cap size before buffering; store outside the served-static path; never trust a user-supplied filename for the storage path.

## Code quality for Node.js/TypeScript

- *Recommendation:* keep business logic in pure functions and push I/O (Prisma calls, network requests, `Date.now()`/`process.env` reads) to the edges of a module — a function that both computes and fetches is hard to unit-test without mocking half the runtime. This project's `types.ts`/logic vs. route-handler split is the natural seam: keep the handler thin (parse → call pure logic → persist), not the reverse.
- *Recommendation:* prefer guard clauses/early returns over nested `if`/`else` or callback pyramids, especially in Joi-validated handlers with several sequential checks (auth → validation → domain rule → not-found) — each check should exit early, not add another nesting level.
- *Recommendation:* avoid unexplained string/number literals (a magic `"ADMIN"`, a retry count `3`, a length `200`) scattered across logic — name them as a constant or an `as const` object (per the enum convention above) once a value is checked more than once or its meaning isn't obvious from context alone.
- *Recommendation:* prefer a small number of narrow, explicit parameters over a single "options bag" with many optional fields — under this project's `exactOptionalPropertyTypes` baseline, an options object multiplies the `null`/`undefined`/absent-key ambiguity described above across every optional field instead of confining it to one documented DTO boundary.

## Before marking work done

- [ ] `tsc --noEmit` passes under the strict baseline above (no new `any`/`@ts-nocheck` added to get there).
- [ ] Any new/changed resource has matching `types.ts` fields and Joi schema keys — no silent drift between them.
- [ ] `null` vs `undefined` handling at the Prisma boundary is deliberate, not accidental, for any field touched.
- [ ] Any new dependency is declared in the *specific* workspace package's own `package.json`, not left to hoisting.
- [ ] No secret is hard-coded or logged; config still comes from env vars.
- [ ] No error is silently swallowed — every `catch` handles or re-throws (with `cause` where context matters).
