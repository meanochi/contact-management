---
name: 'review-version-currency'
type: reviewer-gate-lens
lens: version-currency
target: '_bmad-output/planning-artifacts/architecture/architecture-contact-management-2026-09-15/ARCHITECTURE-SPINE.md'
reviewed: '2026-09-16'
verdict: CHANGES-RECOMMENDED
---

# Reviewer Lens: Version Currency & Reality-Check

**Mandate:** verify every committed decision was web-researched or reality-checked rather than asserted from training data — current versions, that named tech still exists and fits, and (greenfield) starter defaults. Flag anything out of date and unconfirmed.

**Verdict: CHANGES RECOMMENDED.** Most claims hold up or are already appropriately hedged. Two claims are actually wrong/stale as stated, one is directly contradicted by current web evidence, and one omits a load-bearing consequence of the version it pins to. None of these block progress, but all four should be corrected or re-hedged before this spine is treated as settled.

---

## (b) Wrong or already-outdated claims

### 1. Prisma stack row — wrong justification for the `7+` pin
> `Prisma | 7+ required (`$use` removed; Client Extensions only)`

Checked against Prisma's own changelog: `prisma.$use` middleware was removed in **v6.14.0** (a *minor* release), not at v7 — it had been deprecated since v4.16.0 and Prisma pulled it early, which is itself notable (a deprecated API removed outside a major bump). So "`$use` removed" is not a reason to require v7 specifically — it's already gone as of 6.14+. If the real reason to pin v7 is something else (Rust-free client as the default, performance), the spine should say that instead; as written it cites a fact that doesn't support the stated conclusion.

**Severity: Medium.** Not fatal — v7 is a defensible pin regardless — but the stated rationale is factually wrong and should be corrected, not carried into `expertise-postgres-prisma` as-is.

**Missing consequence, same row:** Prisma 7 also **mandates a driver adapter** (e.g. `@prisma/adapter-pg` for Postgres — no longer optional) and changes the generator block (`provider = "prisma-client"`, `engineType = "client"`, a required custom `output` path instead of generating into `node_modules`, changing the import path away from `@prisma/client`). AD-5 describes "one sanctioned `PrismaClient` export" as if instantiation were unchanged from v5/v6 patterns; it isn't. This should be flagged for `expertise-postgres-prisma` to confirm the adapter-wired instantiation pattern before it's used as the "canonical pattern to establish on first implementation."

### 2. OpenAPI-generator row — maintenance claim contradicted by current evidence
> `next-openapi-gen | Recommended over `next-swagger-doc` (unmaintained) — re-verify maintenance status before locking in`

Web evidence as of today (2026-09-16): `next-swagger-doc` shows a published release ~13 days old and a dependency-bump PR from 2026-09-12 — i.e., **not unmaintained** by current signal. `next-openapi-gen` is also actively maintained (release ~1 day old at check time). So the parenthetical "(unmaintained)" is a stale/incorrect factual claim as currently stated, not merely something to double-check later.

Credit where due: the spine already flags this row for re-verification and repeats that caveat in Deferred — so the *practice* is right, but the *specific claim embedded in the recommendation* is currently wrong and should be softened to "verify maintenance status of both before choosing" rather than asserting one is unmaintained.

**Severity: Medium** — the hedge exists, but the fact it hedges around is wrong, and a reader skimming the table will absorb "unmaintained" as settled.

---

## (a) Stated as fact where it should be hedged

### 3. Mantine version — "7+ assumed" is three majors stale, and creates an unstated dependency
> `Mantine | 7+ assumed (CSS Modules RTL) — verify before relying on `DirectionProvider` setup`

Current Mantine major as of today is **v9.6** (v8 reached its final release in March 2026). So "7+" undersells the gap — a fresh `npx create` in September 2026 lands on v9, not v7. The good news: `DirectionProvider` for RTL has been stable and unchanged in mechanism from 7.0 through 9.x, so the *RTL approach itself* is durable — that part of the claim is safe.

What's missing: **Mantine 9.x requires React ≥ 19.2.** The spine's own Stack row for React just says "Verify installed major" with no floor stated. If the project lands on Mantine 9 (likely, for a fresh install), that silently imposes a React version floor the spine doesn't surface anywhere. This is exactly the kind of cross-row dependency a reader needs flagged, not left to be discovered mid-implementation.

**Severity: Medium.** Recommend rewording to "verify installed major (current is 9.x as of Sept 2026; confirm React floor it imposes)" rather than anchoring expectations at 7+.

### 4. AD-4's `proxy.ts` claim — correct today, but stated as unconditional fact
> `proxy.ts` (Next.js's renamed `middleware.ts`) enforces authentication and domain-scope...

I verified this: Next.js **did** rename `middleware.ts` → `proxy.ts` starting in Next.js 16 (current stable channel, 16.2.x as of today), with an official codemod and identical semantics. So the underlying fact is correct and current — this is not an error, and I want to call that out since it's the kind of claim that looks the most fabricated at a glance ("renamed middleware.ts" reads like a hallucination) but checks out.

The issue is purely internal consistency: the Stack table already hedges "Next.js | App Router — verify installed major," implicitly acknowledging the installed version isn't locked yet. AD-4 doesn't carry that same hedge — it states `proxy.ts` as flat fact. If the installed Next.js major ends up below 16 (e.g. pinned lower by a peer dependency), the file is still `middleware.ts` and AD-4's rule as literally written would be wrong for that install. AD-4 should inherit the same "verify installed major ≥ 16, else `middleware.ts`" caveat the Stack table already applies one section up.

**Severity: Low.** Content is currently accurate; this is a hedging-consistency gap, not a factual error.

---

## (c) Named tech — existence/fit confirmed, one worth a note

- **Prisma, Mantine, Next.js App Router (default over Pages Router), Joi, `@upstash/ratelimit`/`@upstash/redis`, `@hookform/resolvers` (Joi resolver still shipped), Turborepo + npm workspaces** — all confirmed to currently exist and fit the stated role. No fabricated or defunct libraries found.
- **Auth.js (NextAuth), AD-9** — confirmed to exist and support a Credentials provider as described. Worth flagging as a currency note rather than an error: as of 2026, Auth.js has settled into maintenance mode (security fixes, no new feature work), and its own maintainers now point new projects toward Better Auth. The spine adopts Auth.js as an unqualified `[ADOPTED]` invariant with no acknowledgment of this ecosystem shift. For a Credentials-only MVP this is low-risk — Auth.js remains supported and the abstraction AD-9 relies on (swap-in SSO later) still holds — but a greenfield pick made today should at least note "confirmed current as of 2026-09; Auth.js is in maintenance mode, Better Auth is the actively-developed alternative" so a future reader doesn't assume this was uncontested.
  **Severity: Low-Medium** (informational — doesn't invalidate AD-9, but the spine's confidence level overstates what's actually a "still fine, but the ecosystem has moved on" situation).
- **TypeScript row** ("Strict baseline... verify installed major") — appropriately hedged already. Worth noting for whoever does the verification: TypeScript is mid-transition to a Go-native compiler (7.0 shipped ~July 2026 with real breaking changes — strict-by-default, ES5 target dropped, AMD/UMD/SystemJS removed) alongside the final JS-based 6.0. "Verify installed major" should explicitly mean checking whether tooling (ts-node, older loaders, editor plugins) has caught up to 7.x before pinning it, not just recording a version number.
  **Severity: Low** — already hedged, this only sharpens what "verify" should check.

---

## Items already correctly hedged (no action needed)

Node.js, TypeScript, Next.js major, React major, Redux Toolkit/RTK Query, React Hook Form, PostgreSQL, Jest/RTL rows all use "verify installed major" / "—" rather than asserting a number — this is the right pattern and the review has nothing to add beyond the two cross-row dependencies noted above (Mantine 9 → React 19.2 floor; Prisma 7 → driver-adapter + generator config).

---

## Summary Table

| # | Claim | Verdict | Severity |
| --- | --- | --- | --- |
| 1 | Prisma 7+ required because `$use` removed | Wrong — removed in 6.14.0, not v7; v7 also mandates driver adapter + generator changes, unmentioned | Medium |
| 2 | `next-swagger-doc` called "(unmaintained)" | Contradicted by current evidence (active releases/PRs as of Sept 2026) | Medium |
| 3 | "Mantine 7+ assumed" | Stale — current major is 9.x; Mantine 9 imposes an unstated React ≥19.2 floor | Medium |
| 4 | AD-4 states `proxy.ts` rename as unconditional fact | Factually correct and current (Next.js 16), but not hedged the way the Stack table's own Next.js row is | Low |
| 5 | Auth.js adopted without noting maintenance-mode status / Better Auth | Confirmed to exist and fit; overstates ecosystem confidence | Low-Medium |
| 6 | TypeScript "verify installed major" | Already hedged; sharpen to cover the 6→7 (Go-native) tooling-compatibility gap | Low |

**File reviewed:** `C:\Users\This User\Desktop\Rachel\contact-management\_bmad-output\planning-artifacts\architecture\architecture-contact-management-2026-09-15\ARCHITECTURE-SPINE.md`
