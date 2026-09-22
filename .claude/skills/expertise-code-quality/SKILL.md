---
name: expertise-code-quality
description: 'Universal engineering principles AND project-wide structural conventions for this project: simplicity, maintainability, readability, testability, avoiding over-engineering, plus the canonical folder/file map (shared vs. feature-scoped code, where services/types/schemas/utils/hooks/components live) that any plan or new feature should follow. Use when writing or reviewing ANY code in this repo, in any layer or language, or when deciding where a new file/folder/abstraction belongs. Domain-specific quality practices AND their own file-layout details (API route layout, React component/Redux structure, Prisma package layout, TypeScript resource colocation, test file layout) live in the sibling expertise-nodejs-typescript / expertise-react-nextjs / expertise-postgres-prisma / expertise-testing / expertise-api-rest skills — this file is the shared baseline AND the cross-cutting structural map they all point back to instead of repeating it. Not for stack-specific conventions (versions, library APIs, framework patterns) — those live in the domain skills.'
---

# Code Quality & Project Structure (Project-Wide)

Applies to every file in this repo, every layer, before any domain-specific skill's guidance layers on top. The goal: every agent produces production-quality code that stays simple, maintainable, readable, and testable — without over-engineering — **and** knows where in the project a given piece of code belongs without having to invent a new location per feature. This is the shared baseline; it does not repeat stack-specific rules (those live in the sibling `expertise-*` skills, which cross-reference this one instead of restating it).

## Non-negotiable for this project

- **Simplicity over cleverness.** Ship the straightforward solution that solves today's actual, stated requirement. Do not add abstraction, configuration, or indirection for a use case that doesn't exist yet.
- **No over-engineering.** This is an MVP for one organization's internal tool (see the PRD's explicit Non-Goals) — don't design for hypothetical scale, multi-tenancy, or generic reusability that was never asked for. A generic plugin/config system for something used once is a defect, not diligence.
- **Single responsibility.** A function or component owns one concern — one reason to change. Several sequential steps toward that one concern are fine in one function (validate, then save, then return is still "handle the update"); split when it mixes concerns that can change for unrelated reasons (business rule vs. HTTP formatting, data-fetching vs. presentation) — not mechanically whenever a description would use "and."
- **Meaningful names.** Names say what a thing holds or does. No `data`, `temp`, `handleStuff`, `doThing` for anything non-trivial — a reader shouldn't need to open the implementation to know what a variable is for.
- **Comments explain WHY, never WHAT.** Well-named code already says what it does. A comment earns its place only for a non-obvious constraint, a workaround for a specific bug, or an invariant a reader would otherwise miss. If deleting the comment wouldn't confuse a future reader, delete it.
- **Errors fail loudly in development, never leak internals in production.** Don't swallow exceptions silently. Don't let a stack trace, SQL fragment, or internal error message reach an end user (see `expertise-api-rest` for how this project's response envelope enforces that at the API boundary).

## Judgment calls — apply with reasoning, not by rule

- **DRY is a guideline, not a law — and not a repetition count.** Don't decide by counting occurrences (e.g. "wait for the 3rd copy"). Decide by asking: is this the *same concept or business rule* appearing more than once, and would extracting it genuinely improve maintainability (one place to change when that rule changes)? If yes, extract it even on the second occurrence. If two blocks are only *coincidentally* similar — same shape, unrelated reasons to exist — leave them separate; a forced shared abstraction that makes unrelated call sites share a function they don't actually have in common is worse than the duplication it removes.
- **Composition over deep hierarchies** — applies equally to TypeScript class/module design and React component trees.
- **Optimize for today's real requirement, not imagined future ones.** If a future need is genuinely likely and cheap to leave room for, a comment noting the seam is enough — don't build the generalized version speculatively.

## Before writing new code

- Check whether this repo already has similar logic once real code exists (it doesn't yet — see each domain skill's greenfield note). Follow an established pattern rather than inventing a parallel "better" one, unless the existing pattern is actually wrong — in which case fix it in place rather than adding a second way to do the same thing.
- Prefer extending or reusing an existing utility over writing a new one that does almost the same thing.

## Project structure: where things live (project-wide)

> This section is the organizational map — where a file belongs, not how to write it. Each domain skill still owns its own conventions in depth (route layout: `expertise-api-rest`; component/Redux layout: `expertise-react-nextjs`; Prisma/package layout: `expertise-postgres-prisma`; resource type/schema pairing: `expertise-nodejs-typescript`; test file layout: `expertise-testing`) — this section only ties them together so a plan or a new feature doesn't have to reinvent where things go.

**This project is greenfield — no `apps/`/`packages/` exist yet.** The tree below is `ARCHITECTURE-SPINE.md`'s own Structural Seed, filled in with the per-layer locations each domain skill already establishes; set it up as-is on first implementation, don't invent an alternative shape.

```text
contact-management/
  apps/
    internal/                     # the only app built in this MVP (AD-1)
      app/                        # Presentation — routes/layouts/Route Handlers (expertise-react-nextjs §7, expertise-api-rest)
        (internal)/ (public)/ api/
      components/
        <resource>/                # feature-scoped components — used by one feature only (e.g. ContactEditForm)
                                    # generic/shared UI does NOT live here — see packages/ui below
      lib/
        features/<resource>/       # Service/Domain layer — business rules + the only app code allowed to call packages/db
        api/                       # cross-cutting API-layer helpers: with-validation.ts, response.ts, rate-limit.ts (expertise-api-rest)
        hooks/                     # cross-feature custom hooks — feature-specific hooks stay colocated with their component
        utils/                     # cross-feature pure helpers — feature-specific ones stay colocated in their own feature folder
        store.ts                   # Redux store setup (expertise-react-nextjs §5)
    public/                        # Phase 2+, not built now (AD-1)
  packages/
    db/                           # Prisma schema/client/extensions — the only PrismaClient (expertise-postgres-prisma)
    shared-schemas/<resource>/     # types.ts + schema.ts per resource — imported by both Presentation and API (see below)
    ui/                           # shared/generic UI: design tokens, Status Badge, Attention Card, Empty State, Dropzone wrapper, Button(primary) — anything used by more than one feature (DESIGN.md)
    config/                        # shared tsconfig/eslint base
```

### Shared vs. feature-scoped — the rule

Code used by exactly one feature lives inside that feature's own folder. The moment a second, unrelated feature needs the same thing, it moves to the matching shared home below — never copy-pasted, never left duplicated "for now":

| Kind of code | Feature-scoped home | Shared home (used by 2+ features) |
|---|---|---|
| Business rules / data access | `apps/internal/lib/features/<resource>/` | N/A — see "no separate Repository layer" below |
| Types + Joi schema (DTOs, request/response shapes) | — this pairing is always shared, see below | `packages/shared-schemas/<resource>/{types.ts,schema.ts}` |
| React components | `apps/internal/components/<resource>/` | `packages/ui/` (design-system-level pieces — DESIGN.md's Components) |
| Custom hooks | colocated with the component/feature that uses it | `apps/internal/lib/hooks/` |
| Pure utility functions | colocated in the feature's own folder | `apps/internal/lib/utils/` |
| API-layer cross-cutting helpers (validation wrapper, response envelope, rate limiting) | — always cross-cutting | `apps/internal/lib/api/` (`expertise-api-rest`) |

**Why `types.ts`/`schema.ts` live in `packages/shared-schemas`, not inside `apps/internal`:** `expertise-nodejs-typescript` establishes the *pairing pattern* (a hand-written `types.ts` + a `Record`-checked `schema.ts` per resource); `ARCHITECTURE-SPINE.md`'s Structural Seed requires this pair to be reachable from both the Presentation layer (React Hook Form) and the API layer (Route Handler validation), which under AD-11 (apps depend on packages, never the reverse) means it has to live in a package, not inside `apps/internal`. Put the pair at `packages/shared-schemas/<resource>/`.

**No separate Repository layer.** The Service/Domain layer (`apps/internal/lib/features/<resource>/`) is the only layer allowed to call `packages/db`, per the architecture's four-layer model — it does both business rules *and* data access in the same module. Where `expertise-postgres-prisma` says "repository-layer helper" or "repository function," that means an ordinary function inside this same Service/Domain module, not a separate architectural layer — adding one would be a fifth layer nothing in this project's requirements calls for.

### Layer separation — don't mix concerns across the four layers

Every file belongs to exactly one of Presentation → API → Service/Domain → Data (`ARCHITECTURE-SPINE.md`'s Design Paradigm); a file mixing two is a structural defect, not a style nit:

- Don't call `packages/db` from a Route Handler or a component — only the Service/Domain layer does.
- Don't put a business rule (a state-machine transition, a domain-scope calculation) inside a Route Handler — it parses, validates, calls Service/Domain, responds (`expertise-api-rest`).
- Don't put data-fetching inside a Client Component or a `useEffect` — Server Components and Route Handlers are the only places that read data (`expertise-react-nextjs` §1).

### Naming

- Folders: kebab-case, plural for a resource's collection folder (e.g. `features/registration-requests/`), matching the URL/table naming already used in `expertise-api-rest`.
- Files: PascalCase for a component (`ContactEditForm.tsx`), camelCase for everything else (`scopeContact.ts`, `withBodyValidation.ts`) — TS-level naming/casing conventions in depth: `expertise-nodejs-typescript`.
- A resource's name must match across every layer it's referenced in: the Prisma model (PascalCase singular), the URL segment (kebab-case plural), and the `packages/shared-schemas` folder — a name that drifts between layers is harder to grep and easier to accidentally duplicate.

### Before adding a new folder, layer, or abstraction

Extends the "Before writing new code" rule above from *logic* to *structure*: before creating a new top-level folder, a new `packages/*`, or a new architectural layer (a repository pattern, a new cross-cutting wrapper), check whether the map above and `ARCHITECTURE-SPINE.md`'s Structural Seed already cover it. A new top-level folder is justified only when nothing in the existing map fits — not because one feature "feels different." This is the structural form of this file's own no-over-engineering rule: the tree stays as simple and predictable as the four layers already decided, not deeper.

## Pre-completion checklist (applies alongside each domain skill's own checklist)

- [ ] Would an unfamiliar teammate understand this in one read, without asking the author?
- [ ] Is there a simpler version that fully meets today's actual, stated requirement?
- [ ] Does any function/component do more than one job?
- [ ] Is any "shared abstraction" here actually forcing unrelated things together, rather than genuinely removing duplication?
- [ ] Does any comment just restate what the code already says, instead of explaining a non-obvious reason?
- [ ] Can any error path fail silently, or leak an internal detail (stack trace, query, secret) to a client or log a non-technical user would see?
- [ ] Does new code sit in the layer/folder the Project Structure map above assigns it to (feature-scoped vs. shared home chosen correctly)?
- [ ] Was a new top-level folder/package/layer added only after checking the existing structure map had nothing that already fit?
