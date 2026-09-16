---
name: expertise-code-quality
description: 'Universal engineering principles for this project: simplicity, maintainability, readability, testability, avoiding over-engineering. Use when writing or reviewing ANY code in this repo, in any layer or language. Domain-specific quality practices (API design, React/component structure, Prisma/DB, TypeScript, testing) live in the sibling expertise-nodejs-typescript / expertise-react-nextjs / expertise-postgres-prisma / expertise-testing / expertise-api-rest skills — this file is the shared baseline they all point back to instead of repeating it. Not for stack-specific conventions (versions, library APIs, framework patterns) — those live in the domain skills.'
---

# Code Quality & Engineering Principles (Project-Wide)

Applies to every file in this repo, every layer, before any domain-specific skill's guidance layers on top. The goal: every agent produces production-quality code that stays simple, maintainable, readable, and testable — without over-engineering. This is the shared baseline; it does not repeat stack-specific rules (those live in the sibling `expertise-*` skills, which cross-reference this one instead of restating it).

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

## Pre-completion checklist (applies alongside each domain skill's own checklist)

- [ ] Would an unfamiliar teammate understand this in one read, without asking the author?
- [ ] Is there a simpler version that fully meets today's actual, stated requirement?
- [ ] Does any function/component do more than one job?
- [ ] Is any "shared abstraction" here actually forcing unrelated things together, rather than genuinely removing duplication?
- [ ] Does any comment just restate what the code already says, instead of explaining a non-obvious reason?
- [ ] Can any error path fail silently, or leak an internal detail (stack trace, query, secret) to a client or log a non-technical user would see?
