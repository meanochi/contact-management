---
title: Reviewer Gate — Rubric Walk of ARCHITECTURE-SPINE.md
subject: _bmad-output/planning-artifacts/architecture/architecture-contact-management-2026-09-15/ARCHITECTURE-SPINE.md
reviewed-against:
  - _bmad-output/planning-artifacts/prds/prd-contact-management-2026-09-15/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-contact-management-2026-09-15/.memlog.md
  - .claude/skills/expertise-react-nextjs/SKILL.md
  - .claude/skills/expertise-postgres-prisma/SKILL.md
  - .claude/skills/expertise-api-rest/SKILL.md
  - docs/tech-stack-decisions.md
date: 2026-09-16
---

# Overall Verdict

**Adequate, not yet ready to hand down** — the layering/mutation/audit/domain-scope decisions (AD-1, AD-2, AD-4, AD-5, AD-6, AD-9) are well-formed, memlog-traceable, and correctly delegate implementation detail to the companion skills; but the spine has one untraceable AD (AD-3), a load-bearing data-model omission (no User/Coordinator/domain-assignment entity anywhere, despite FR-1–FR-3 being the PRD's foundational feature), an ER diagram that asserts a relation the canonical Prisma schema doesn't have, and an operational/file-governance envelope (logging, CI/CD, environments, upload retention, AV scanning) that is largely silent rather than decided or explicitly deferred.

---

## 1. Fixes the real divergence points for the level below — misses none

**Verdict: thin**

- **[High]** No entity, AD, or diagram anywhere in the spine (or in `expertise-postgres-prisma`, which the spine calls the canonical schema source) models **who a Coordinator/Super-Admin is or how they're assigned to a Domain**. FR-1–FR-3 (PRD §4.1) are literally "the basis for everything" and FR-2 explicitly requires a domain to support *more than one* assigned coordinator. Without a User/Role/DomainAssignment shape fixed at this altitude, two independently-built stories (e.g. "assign coordinator to domain" vs. "resolve current user's domain scope in `proxy.ts`") have nothing to converge on — each could invent an incompatible shape (a flat `domainId` on `User` vs. a join table). This is exactly the kind of divergence an architecture spine exists to prevent, and it's missing entirely rather than deferred.
- **[Medium]** FR-9 (external update/removal requests must record source, date, handler) and the audit-trail NFR for Contact are acknowledged narratively but have no corresponding field/entity hook in the ER diagram or an AD — likely fine to leave to schema implementation, but worth a one-line pointer since it's a "Must" tested outcome, not incidental.
- Everything else at this altitude that the PRD/memlog actually decided is captured: two-app target (AD-1), App Router (AD-2), centralized authZ (AD-4), audit-trail atomicity (AD-5), domain-scope-per-model (AD-6), soft delete (AD-7), Auth.js abstraction (AD-9). Good coverage where memlog exists.

## 2. Every AD's Rule is enforceable and actually prevents its stated divergence

**Verdict: adequate**

- AD-1, AD-2, AD-3, AD-4, AD-5, AD-6, AD-7, AD-8, AD-9, AD-10 are all concrete and checkable in code review (no `.delete()` calls, one `PrismaClient` export, one Joi wrapper, `"use client"` only at leaves, etc.).
- **[Medium]** AD-11's enforcement mechanism is imprecise: "Turborepo's task graph and each package's own `package.json` dependencies are the enforcement point — a package importing an app is a build-graph violation, not just a style issue." Turborepo's task graph governs build/test **task ordering and caching**, derived from declared `package.json` dependencies — it does not statically block a stray relative-path import from `packages/db` into `apps/internal` the way an ESLint import-boundary rule (or a TS `references`/`rootDir` restriction) would. As written, the rule names a mechanism that doesn't actually catch the violation it's meant to prevent; either cite the real enforcement point (lint rule / tsconfig boundary) or add one.

## 3. Nothing under Deferred could let two independently-built units diverge incompatibly

**Verdict: thin**

- **[Critical]** "File storage for public-registration document uploads (local disk vs. S3-compatible object storage)" is Deferred, but the underlying feature — file upload on the public registration form — is in-scope, Must-have MVP work (FR-13, PRD §4.4), not a Phase 2+ item like the linked hosting decision. Deferring the storage *backend* without fixing even a thin storage **interface** (e.g. `saveUploadedFile()`/`getFileRef()` in `packages/*`) at this altitude means the registration-form-submission story and the approval-queue/document-viewing story can independently commit to incompatible file-reference shapes (a local path vs. an S3 URL) before the backend is ever chosen. This is precisely the "two independently-built units diverge incompatibly" case the checklist warns about — it should be at minimum a thin AD (fix the interface, defer the backend), not a bare Deferred bullet.
- **[High]** Tied to the same feature: the PRD explicitly assigns two related decisions to the architecture stage — document **retention policy** (§6, `[ASSUMPTION]`, open question 5: "טעון החלטה משותפת עם הארכיטקט... בשלב הארכיטקטורה") and **antivirus scanning's Must/Should status** (§6: "תוקף כדרישת Must/Should רק בשלב הארכיטקטורה"). Neither appears anywhere in the spine — not decided, not in Deferred, not flagged as an open question. Since the PRD explicitly delegated these to this document, their total absence is a gap, not a neutral omission.
- Everything else in Deferred is safe: production hosting (explicit user choice, portability constraint given), SSO provider (Auth.js abstracts it, no code depends on the choice), `apps/public` build (genuinely out of scope), Postgres RLS (revisit trigger given), API versioning (revisit triggers given), rate-limiting library / OpenAPI generator (the *behavior* — no in-process counters, `@openapi` JSDoc annotation — is already locked as a "Project rule" in `expertise-api-rest`, so only the library pick is actually open; the spine's Deferred wording undersells this slightly by calling the whole thing unconfirmed, but it's low risk since the companion skill already constrains the substance — **[Low]**).

## 4. Named tech is verified-current or explicitly flagged to verify

**Verdict: adequate**

- Stack table hedges appropriately: Node/TS/Next/React majors flagged "verify," Mantine 7+ flagged, Prisma 7 claim is well-sourced (matches a dated research entry in `docs/tech-stack-decisions.md`, correctly framed as a permanent API removal rather than a style fact), `next-openapi-gen` flagged for re-verification.
- **[Medium]** AD-4's Rule states as settled fact that "`proxy.ts` (Next.js's renamed `middleware.ts`) enforces authentication and domain-scope" — this is a Next.js-16-specific rename fact. `expertise-api-rest` (the source of this claim) explicitly hedges it ("verify this hasn't shifted again"), but the spine's own AD-4 — a binding, enforceable rule every API route depends on — states it unhedged, and the generic "Next.js — verify installed major" stack-table row doesn't call out this specific version-behavior fact. If the filename/runtime changes in a later Next.js release, AD-4 goes silently stale.

## 5. Every dimension this altitude owns is decided/deferred/an open question

**Verdict: thin**

- Deployment target is handled well: Docker-for-local is decided (memlog-sourced), production hosting is explicitly and traceably deferred, with a concrete portability guardrail (no provider-locked SDKs) until then.
- **[High]** Beyond hosting, the operational envelope is essentially silent: no mention of CI/CD, environment topology (dev/staging/prod), logging/error-monitoring/alerting, or backup strategy for Postgres. "Config/secrets: env vars only, validated at startup" is the only operations-adjacent line in the whole document. Given the checklist's explicit instruction to scrutinize this, a whole dimension (operations) reads as skipped rather than decided or deferred.
- See §3 above for the two PRD-mandated, architecture-assigned decisions (retention policy, AV-scanning Must/Should status) that are also silent rather than addressed.

## 6. References companion documents rather than duplicating their detail — delegation actually followed

**Verdict: adequate**

- Where citations exist, they work well and match the sibling skills accurately (spot-checked against all three): AD-2 → `expertise-react-nextjs` (Server/Client boundary rule matches §1 exactly), AD-5 → `expertise-postgres-prisma` (the `getExtensionContext` atomicity mechanism matches verbatim), AD-8 → `expertise-api-rest` (envelope shapes match verbatim), AD-10 → `expertise-react-nextjs` (matches §5's "MUST NOT duplicate server data" rule word-for-word in spirit). No stale or inaccurate summaries of the sibling skills were found — the rate-limiting recommendation, the `next-swagger-doc`→`next-openapi-gen` flag, and the Prisma-7 `$use` removal all match their source skills precisely.
- **[Medium]** Citation is inconsistent, not absent: AD-4 (centralized authZ via `proxy.ts`) doesn't point to `expertise-api-rest`, which owns this exact mechanism in detail ("Two things every route already gets for free"). AD-6 (domain-scope-per-model) and AD-7 (soft delete) don't point to `expertise-postgres-prisma`, which contains the parallel `scopeContact`/`scopeSupportedBody` code and the fuller soft-delete rules (REVOKE DELETE backstop, partial index) respectively — both ADs restate a one-line summary of content that lives there in more depth without the reader being pointed to it, unlike the pattern AD-2/AD-5/AD-8/AD-10 establish.
- **[Medium]** Frontmatter `companions: []` is empty, despite the body text repeatedly citing `expertise-react-nextjs`, `expertise-postgres-prisma`, `expertise-api-rest`, and `DESIGN.md` as companion documents. If any downstream tooling reads the `companions` field to resolve this doc's dependency set, it will find nothing — the actual companion set only exists as prose references.
- **[Low]** `EXPERIENCE.md` is listed in `sources` but never referenced or delegated to anywhere in the body (unlike `DESIGN.md`, which is cited once for `packages/ui`).

## 7. Diagrams are valid mermaid and convey real structure

**Verdict: adequate, with one factual error**

- The layering `graph TD` diagram is syntactically valid and non-trivial: it shows the real dependency direction, the RTK-Query/proxy.ts annotations on edges, and the cross-cutting `shared-schemas`/`ui` dotted edges — this is a genuine, load-bearing diagram, not a placeholder.
- The `erDiagram` is syntactically valid but has a **[High]** accuracy problem: it asserts `RegistrationRequest }o--|| SupportedBody : "matches (nullable until resolved)"`, implying a stored relation/FK — but the canonical `RegistrationRequest` model in `expertise-postgres-prisma` (the doc the spine names as the source of the "full field-level schema") has **no `supportedBodyId` field at all**, only `payload: Json`. Either the ER diagram is describing a relation that doesn't exist in the schema it defers to, or the companion skill's example is missing a field the spine assumes exists — either way the two documents disagree on a structural point (whether the match-by-companyId result is persisted as a relation or only ever computed at read time from the JSON payload), which is exactly the kind of thing that should be fixed before two people build against it independently.
- **[Medium]** Similarly, `AuditLog }o--|| Domain`/`SupportedBody`/`Contact : "may reference"` reads as a real relation in the diagram, but `expertise-postgres-prisma`'s canonical `AuditLog` model has only generic `tableName`/`recordId` string columns — no FK relation fields to any of the three entities. The diagram overstates the referential structure that actually exists (a polymorphic string pointer, not a typed relation), which could lead an implementer to add FK columns that the canonical schema doesn't call for.

## 8. No AD contradicts another AD in this same file

**Verdict: strong**

- No direct contradictions found across the 11 ADs. AD-4 (route-level centralized authZ) and AD-6 (query-level domain-scope helpers) are complementary, not competing, and the spine correctly frames AD-6 as "the Prisma-layer implication" rather than a second authorization mechanism. AD-9 (Auth.js) and AD-4 (proxy.ts) compose cleanly. AD-1's two-app target and AD-11's dependency direction reinforce each other. The AD-1 text also correctly reflects only the *final*, amended state from the memlog (two apps long-term) without leaving the superseded single-app decision as residual, contradictory content.

---

# Memlog Traceability (cross-cutting finding, not a checklist bullet but material to several above)

- **[Critical]** AD-3 ("Mutations go through the REST API, never Server Actions") has **no corresponding entry in `.memlog.md`**. The memlog's own rationale for App Router (line 11) lists "Server Actions reduce boilerplate for the project's many forms" as a *pro* of the chosen stack, with no recorded walk-back. AD-3's text claims this was "found as a live contradiction during implementation planning and closed here" — but that resolution isn't recorded in the authoritative decision log the task says the spine must match. `docs/tech-stack-decisions.md` §4 does flag "API Routes vs. Server Actions" as an open question for the architecture stage, so AD-3 is answering a legitimately open question — but its resolution should have left a trace in `.memlog.md` and currently doesn't.
- **[Medium]** The memlog numbers two of its three architecture decisions "decision 1 of 3" (centralized proxy.ts authZ) and "decision 3 of 3" (audit trail) — **"decision 2 of 3" is missing from the file entirely**. AD-6 (domain-scoped query bug/fix) plausibly corresponds to the missing entry, but as it stands AD-6's content ("a real bug caught in this project's `Contact` model") isn't traceable to any memlog record. Worth confirming whether the memlog is incomplete or the numbering is simply off.

---

# Summary of Findings by Severity

**Critical**
1. AD-3 (no Server Actions for mutations) has zero traceability in `.memlog.md`.
2. Deferred file-storage backend leaves no interface fixed, despite the feature (FR-13) being in-scope MVP work — real incompatible-divergence risk.

**High**
3. No User/Coordinator/domain-assignment entity anywhere in the spine or its companion schema doc, despite FR-1–FR-3 being the PRD's foundational feature area.
4. PRD-mandated, architecture-assigned decisions (upload retention policy, AV-scanning Must/Should status) are entirely absent — not decided, deferred, or flagged.
5. Operational envelope (CI/CD, environments, logging/monitoring, backups) is silent beyond hosting/local-DB.
6. ER diagram's `RegistrationRequest`↔`SupportedBody` relation contradicts the companion Prisma skill's actual schema (no such field exists there).

**Medium**
7. AD-11's stated enforcement mechanism (Turborepo task graph) doesn't actually catch the import violation it claims to prevent.
8. AD-4's `proxy.ts` rename claim is stated unhedged in the spine despite the source skill explicitly flagging it as re-verify-worthy.
9. Inconsistent companion-skill citations (AD-4, AD-6, AD-7 lack pointers that parallel ADs include).
10. Frontmatter `companions: []` is empty despite extensive prose-level companion references.
11. "Decision 2 of 3" is missing from `.memlog.md`, leaving AD-6 without a traceable source.
12. ER diagram's `AuditLog` relations overstate a typed FK relationship that the canonical schema (generic `tableName`/`recordId` strings) doesn't have.

**Low**
13. Rate-limiting Deferred wording undersells that the substantive behavior is already locked in `expertise-api-rest`.
14. `EXPERIENCE.md` is a listed source but never referenced/delegated to in the body.
