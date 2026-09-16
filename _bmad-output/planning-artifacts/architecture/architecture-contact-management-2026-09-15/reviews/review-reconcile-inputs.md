# Reconciliation Review — ARCHITECTURE-SPINE.md vs. Source Inputs

**Reviewed:** `_bmad-output/planning-artifacts/architecture/architecture-contact-management-2026-09-15/ARCHITECTURE-SPINE.md`
**Against:** `prd.md`, `EXPERIENCE.md`, `docs/tech-stack-decisions.md`
**Method:** read all four documents in full; extracted every requirement/constraint/promise in the sources that implies an architecturally-significant rule (something two independently-built units could violate, or an operational/technical commitment), then checked whether the spine states it as an AD, a Consistency Convention, a Stack entry, or a Deferred item with reason — or drops it silently.
**Scope:** read-only. No spine or source file was modified.

---

## 1. NFR-E (domain isolation must hold even via direct API calls) — PARTIALLY GAP (implicit, not asserted)

**Source:** PRD §5, NFR-E: "אין דרך לרכז אחד לראות נתונים של תחום שאינו שלו — לא דרך הממשק, ולא דרך קריאה ישירה ל-API" (no way for one coordinator to see another domain's data — not through the UI, and not through a direct API call). PRD §6 (Security) repeats this: "אכיפת הרשאות תחום ... חייבת להתבצע בצד השרת בכל בקשה — לא רק בהסתרת רכיבי ממשק" (server-side enforcement on every request, not just hiding UI elements).

**Spine:** AD-4 ("Domain-scoped authorization is centralized") states `proxy.ts` "enforces authentication and domain-scope before any Route Handler body runs," and binds "every API route."

**Assessment:** Mechanically, AD-4 *does* satisfy NFR-E — `proxy.ts` sits in front of the Route Handler regardless of who or what calls it (browser UI, curl, Postman, another service), so a direct API call gets the same domain-scope check as a UI-driven one. This is a real, structural fix, not just a UI-layer one (EXPERIENCE.md's sidebar-hiding is explicitly UI-only and is *not* relied on for security — correctly, since AD-4 is the actual enforcement point).

However, the spine never **states this explicitly**. AD-4's "Binds" line says "every API route" but doesn't name NFR-E, and nothing in the AD or the Consistency Conventions table says in so many words "this holds even for callers that bypass the UI entirely (direct/scripted API calls), which is the specific attack surface NFR-E calls out." A reader auditing the spine against the PRD has to infer the direct-API-call guarantee from where `proxy.ts` sits in the request pipeline, rather than finding it asserted. Given NFR-E is a Must-level, explicitly-worded PRD requirement (and explicitly repeated in the Constraints section for emphasis), it's worth a one-line explicit tie-in rather than leaving it as an inference.

**Recommendation:** Add a sentence to AD-4 (or the domain-scope row of Consistency Conventions) stating explicitly that this enforcement applies uniformly regardless of caller — UI, direct API client, or script — closing NFR-E and the §6 security constraint by name.

---

## 2. "404, not 403" permission-denial pattern — GAP (missing spine-level rule; conflicts with tech-stack-decisions.md)

**Source:** EXPERIENCE.md, State Patterns table: "הרשאה נדחית | ניסיון גישה ישיר ל-URL של רשומה מחוץ לתחום | הפניה לעמוד 'הדף לא נמצא' (404) — **לא** 'אין לך הרשאה' — כדי לא לחשוף קיום/אי-קיום רשומה (עקבי עם FR-3)." I.e.: for domain-scope permission denial, return 404, explicitly not 403/"access denied," so an unauthorized caller can't distinguish "record doesn't exist" from "record exists but isn't yours."

This is consistent with PRD FR-3's tested outcome, which itself allows either code: "קריאת API לרשומת גוף/איש קשר/בקשה שאינה בתחום המשתמש מוחזרת כ-**403/404**" — the PRD leaves the choice open; EXPERIENCE.md (marked `status: final`, and which states "ה-Spine ... מנצח בכל סתירה" only over *mockups/canvas*, not over the PRD) narrows it down to 404-only, for a stated security reason (existence-disclosure).

**Conflict found:** `docs/tech-stack-decisions.md` §12 (REST API style) states the *generic* convention: "קודי סטטוס HTTP משמעותיים — ... `401`/`403` להרשאות (רלוונטי ל-GR-1/GR-2)" — i.e., the tech-stack doc's own REST cheat-sheet says permission failures should be 401/403. This directly contradicts EXPERIENCE.md's explicit 404-not-403 rule for the domain-scope case.

**Spine:** Nowhere. AD-4 (domain-scope enforcement) says nothing about the HTTP status code it returns. AD-8 (validation/response envelope) defines `{ data, meta? }` / `{ error: { code, message, details? } }` shapes but not which `code`/HTTP status applies to a domain-scope denial. No Consistency Convention row addresses error status-code selection at all.

**Why this matters at spine level:** this is exactly the kind of rule "two independently-built units could violate" — one route author reading only `tech-stack-decisions.md` would return 403 for a cross-domain access attempt (a "reasonable REST default"), while another reading only EXPERIENCE.md would return 404. Since AD-4's enforcement is centralized in `proxy.ts`, the status code it emits is a single decision point today — but nothing pins that decision down in writing, and any resource-level check added at the route level (which AD-4 explicitly permits, for checks "the central layer structurally can't express") could easily default to 403 and silently violate the UX/security intent.

**Recommendation:** Add an explicit rule — either as a new short AD or as a row in Consistency Conventions ("State & cross-cutting") — that all domain-scope/permission-denial responses (both the centralized `proxy.ts` check and any narrow per-route check) return `404`, never `401`/`403`, specifically to avoid confirming record existence to an out-of-domain caller; and note this as an intentional override of the generic REST 401/403 convention recorded in `tech-stack-decisions.md` §12, so a future reader doesn't treat that entry as still authoritative for this one case.

---

## 3. Public-form security constraints: file validation, AV-scanning decision, retention policy — GAP (explicitly punted to architecture stage by the PRD, and not picked up)

**Source:** PRD §6 (Constraints & Guardrails), security subsection:
- File-type/size validation is stated as a firm requirement: "קבצים שהועלו דרך הטופס הפומבי (FR-13) חייבים עבור בדיקת סוג קובץ מותר וגודל מקסימלי לפני שמירה" (uploaded files must be checked for allowed type and max size before saving).
- AV scanning is explicitly flagged with `[NOTE FOR PM]`: "סריקת אנטי-וירוס לקבצים שהועלו מומלצת מאוד ברמת קפדנות 'משיק ציבורי', אך תוקף כדרישת Must/Should **רק בשלב הארכיטקטורה**" — i.e., the PRD explicitly defers the Must/Should call on AV scanning *to the architecture document*.
- Retention policy is flagged twice: PRD §6 `[ASSUMPTION]`: "מדיניות שמירה (retention) מדויקת של מסמכים שהועלו ובקשות שנדחו טרם הוגדרה — פריט **לשלב הארכיטקטורה**/הצוות המשפטי"; and again in Open Question 5 (§10): "טעון החלטה משותפת עם הארכיטקט ואולי גורם משפטי/ציות"; and again in the Assumptions Index (§11).
- Rate limiting is stated as a firm requirement: "הגבלת קצב בקשות (rate limiting) על נקודות הקצה הציבוריות ... כדי שהגנת הספאם (FR-19) לא תסתמך רק על CAPTCHA."

**Spine:**
- Rate limiting — **covered**: Stack table lists `@upstash/ratelimit` + `@upstash/redis` ("Recommended for the public registration endpoint — not yet confirmed with stakeholder"), and it's repeated in Deferred with the same caveat. This is a reasonable way to represent a not-yet-locked-in decision.
- File storage location (disk vs. S3) — **covered** in Deferred ("File storage for public-registration document uploads").
- File-type/size validation (the Must-level requirement, independent of storage location) — **not mentioned anywhere** in the spine. No AD, no convention, no Deferred entry addresses where in the layered pipeline (API route vs. Service/Domain) this check must live, even though AD-8 establishes "one validation entry point" via the shared Joi wrapper for JSON bodies — multipart file bytes aren't validated by Joi the same way, so this is a real seam the spine is silent on.
- AV-scanning Must/Should decision — **not addressed at all**. The PRD explicitly assigned this decision to the architecture stage; the spine doesn't decide it, and doesn't even list it as a Deferred item with a reason, which is the minimum bar the task set for "not fully locked in yet" items.
- Retention policy for uploaded documents / rejected requests — **not addressed at all**, despite being flagged three separate times in the PRD as an architecture-stage decision point.

**Recommendation:** Add at least three Deferred entries (or fold into existing ones) explicitly carrying these forward with the PRD's own framing, so the spine visibly picked them up rather than dropping them:
- File-type/size validation: state where it's enforced (e.g., "Route Handler validates MIME type and size before calling Service/Domain; Service/Domain never persists an unvalidated file") — this one arguably shouldn't even be Deferred, since the PRD marks it as a firm Must, not an open question.
- AV-scanning: carry forward as Deferred, explicitly quoting that the PRD assigned the Must/Should call to this stage and that the spine is not yet resolving it (rather than silently never mentioning it — silence reads as "forgotten," not "deferred").
- Retention policy: same treatment — Deferred, naming that legal/compliance input is needed per the PRD.

---

## 4. "No record locking, last-write-wins" — GAP (should be at least a Deferred item, arguably an AD)

**Source:** EXPERIENCE.md, State Patterns table: "שינוי במקביל ע\"י משתמש אחר | טופס עריכת איש קשר | `[NOTE FOR UX]` MVP לא בונה נעילת רשומות (record locking); 'הכי אחרון מנצח' (last-write-wins) מספיק בהיקף הזה בשל מספר משתמשים פנימיים קטן. **סיכון ידוע, לא נפתר כרגע.**" (explicitly flagged as a known, unresolved risk, not a casual UX footnote.)

**Spine:** No mention anywhere. AD-5 (audit trail) covers *recording* what changed and when, but says nothing about *concurrent-write conflict behavior* — whether a second writer's update silently overwrites a first writer's, whether there's any optimistic-concurrency check (e.g., a version/`updatedAt` guard returning 409), or whether this is uniform across every mutating endpoint.

**Why this belongs in the spine, not just UX:** this is precisely a Service/Domain-layer decision, not a Presentation-layer one — it determines whether `Contact` (and any other domain-scoped model) update logic in `packages/db`/`lib/features/<resource>` performs a conditional/optimistic write or a blind overwrite. Two independently-built mutation endpoints (e.g. `Contact` update vs. a future `SupportedBody` update) could easily diverge — one dev adds an optimistic-lock check "for safety," another doesn't — producing inconsistent behavior that contradicts the UX's explicit, deliberate choice of uniform last-write-wins. Since EXPERIENCE.md frames this as an accepted, known risk rather than a solved problem, the architecture layer is exactly where "yes, we're accepting this project-wide, here's why, and here's the trigger to revisit" belongs.

**Recommendation:** Add a Deferred entry (minimum) or a short AD (better, since it's a concrete behavioral rule binding "Service/Domain layer, all mutating models"): "No optimistic-locking/record-locking in MVP — concurrent updates are last-write-wins, per EXPERIENCE.md's explicit, accepted risk given small internal user count. Revisit if the audit trail (AD-5) shows conflict-driven data loss in practice." This closes the loop between the UX's accepted risk and how the Service/Domain layer is actually built, and prevents one endpoint from silently adding conflict detection that others lack.

---

## Secondary / lower-priority observations (not part of the four requested checks, noted for completeness)

- **Pagination as a cross-cutting API rule.** EXPERIENCE.md's Interaction Primitives explicitly bans infinite scroll in favor of pagination on every list screen ("Pagination בלבד — מתאים גם לביקורת/Audit ברורה"). The spine's AD-8 defines a `{ data, meta? }` envelope (the `meta?` slot could hold pagination info) but never states that every list-returning Route Handler must be paginated, or what the query-param/response-shape contract is. Minor gap — likely fine to leave to `expertise-api-rest`, but worth a one-line convention entry since it's a cross-endpoint contract, not per-feature detail.
- **WCAG level as a build-time gate.** EXPERIENCE.md's Accessibility Floor sets WCAG 2.1 AA minimum everywhere and a *higher* contrast/touch-target bar specifically for the public form. The spine doesn't reference an accessibility conformance target at all (arguably correctly left to `DESIGN.md`/UX rather than the architecture spine, since it's not a layering/data-flow concern) — flagged only for completeness, not recommended as a required spine addition.

---

## Items checked and found adequately covered (no gap)

- PRD Open Question 1 (internal auth mechanism SSO vs. new login) → AD-9 (Auth.js, provider-agnostic) + Deferred ("Specific SSO identity provider"). Covered.
- PRD FR-3's `[NOTE FOR PM]` (middleware vs. per-endpoint auth check, explicitly left to architecture) → AD-4 (centralized `proxy.ts`). Covered.
- PRD CM-3/FR-8 (soft delete, no real delete) → AD-7. Covered.
- PRD NFR-B / FR-11's field-level audit trail → AD-5. Covered.
- tech-stack-decisions.md's Prisma 7 `$use`-removal / Client Extensions update → AD-5 + Stack table ("Prisma 7+ required"). Covered.
- tech-stack-decisions.md's open item (single Next.js app vs. multiple, App Router vs. Pages Router) → AD-1, AD-2. Covered.
- tech-stack-decisions.md's Swagger tool staleness (`next-swagger-doc`) → Stack table recommends `next-openapi-gen` instead, flagged as not yet reverified. Covered.
- PRD §6 privacy disclosure requirement (clear notice to registration applicants) → correctly left to UX/DESIGN copy, not an architectural concern. No gap.
