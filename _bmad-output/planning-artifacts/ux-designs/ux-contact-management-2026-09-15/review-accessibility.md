# Adversarial Accessibility / RTL / Consistency Review

**Scope:** `DESIGN.md`, `EXPERIENCE.md`, source PRD (`prd.md`), and the 8 static mockups in `.working/` for the Hebrew RTL contact-management UX spine.
**Method:** line-by-line reading of both spine docs + PRD, rendered-markup inspection of all 8 mockups, and independent verification (contrast-ratio computation, DOM/flex tab-order reasoning, file-path cross-checks) rather than trusting the docs' own claims at face value.
**Reviewer stance:** adversarial — every "this is handled" claim was checked against an artifact, not accepted on prose alone.

---

## Overall Verdicts

| Category | Verdict | One-line reason |
|---|---|---|
| 1. Accessibility Floor completeness | **Thin** (borderline Broken on one point) | Rules are named but under-specified (focus, keyboard, aria-live wiring per-pattern), and the token palette itself contains a measurable WCAG AA contrast failure baked into the most-repeated component (Status/count badges) while the doc explicitly claims AA compliance. |
| 2. RTL correctness | **Adequate** | Core mechanics (sidebar anchoring, DOM/flex tab order, DD/MM/YYYY dates, the one Drawer that was mocked) are actually right and self-consistent — better than average. But the "Drawer opens from left" rule is stated too broadly, a breadcrumb chevron in the ground-truth mockup is unmirrored, and RTL behavior of inherited Mantine chrome (Pagination arrows, bidi-isolation of numeric strings) is never addressed despite NFR-D being a Must. |
| 3. Consistency (DESIGN.md ↔ EXPERIENCE.md ↔ mockups) | **Thin** | Several components named in EXPERIENCE.md's Component Patterns/State Patterns tables have no home anywhere in DESIGN.md (Dropzone, Skeleton, generic Card, Empty State). The mockup file references in EXPERIENCE.md are entirely stale (wrong directory, wrong filenames, 4 of 8 real files unreferenced). One behavioral claim (registration card "always 3 actions") is directly falsified by the mockup meant to illustrate that very feature. |

---

## 1. Accessibility Floor Completeness

### 1.1 [CRITICAL] Status/count badge color fails WCAG AA contrast — contradicts the doc's own AA claim
**File/section:** `DESIGN.md` frontmatter `colors` (lines 15, 23) + `components.status-badge` (lines 68-74); `EXPERIENCE.md` Accessibility Floor (line 102: "WCAG 2.1 AA לפחות בכל האזור הפנימי"). Rendered in every mockup, e.g. `.working/key-domains.html` line 17 (`.count{background:var(--accent)...font-size:11px}`), `.working/key-registration-queue.html` `.tag-warn` (line 24, same accent color, 11px text).

**Problem:** `accent`/`status-pending` (`#B8791A`, amber) with white foreground text (`accent-foreground: #FFFFFF`) computes to a contrast ratio of **~3.6:1** against white background text. WCAG 2.1 SC 1.4.3 requires **4.5:1** for normal text, and the badge/pill text in every mockup is 11-13px — well under the "large text" threshold (18.66px bold / 24px regular) that would allow the lower 3:1 bar. This color is used for: the sidebar pending-count pill (appears on literally every internal-area mockup), the `status-pending` badge variant, the `tag-warn` "⚠ לא זוהה גוף נתמך" flag on the registration queue, and the `attention-card` component (accent background + white foreground per DESIGN.md line 76-78).
**Why it matters:** This isn't a theoretical edge case — it's the single most attention-grabbing UI element in the internal area (the "you have N pending requests" affordance) and it fails the accessibility bar the document claims to guarantee, for low-vision users and anyone using non-optimal displays. A dev implementing DESIGN.md's tokens literally will ship an AA-non-compliant product despite the doc asserting AA compliance line-for-line.
**Fix:** Either darken `accent`/`status-pending` (e.g., toward `#8A5A12`-ish, verify ≥4.5:1 against white) or switch these small-text-on-accent instances to dark text (`accent-foreground` needs a near-black value at this size, similar to how `accent-foreground-dark: '#1A1208'` already exists for the dark-mode variant — the light-mode foreground token should probably not be pure white for text this small). Re-run a contrast check across all four status colors × their foregrounds once fixed (active #2F7D46 ≈5.1:1 OK, inactive #6B7280 ≈4.8:1 OK-but-marginal, rejected #B3261E ≈6.5:1 OK — only pending/accent fails).

### 1.2 [HIGH] "Status Badge = color + icon" is DESIGN.md's actual guarantee — but the icons are indistinguishable by shape
**File/section:** `DESIGN.md` line 125 ("עם צבע **וגם** אייקון (לא צבע בלבד — נגישות)") vs. `EXPERIENCE.md` line 66 ("תמיד צבע + אייקון + **טקסט**").
**Problem:** DESIGN.md's own component spec — the document EXPERIENCE.md explicitly defers to for the visual guarantee ("הניגודיות הוויזואלית ב-DESIGN.md", line 99) — only mandates **color + icon**, not text. EXPERIENCE.md's table separately claims color+icon+text, but that's the behavioral doc, not the visual source of truth. Worse: the actual "icons" used everywhere in the mockups (🟢 ⚪ 🟠 🔴) are all the **same shape** (a filled circle) distinguished **only by color** — so "icon" here provides zero non-color information. The anti-color-reliance guarantee is, in practice, carried entirely by the text label, which DESIGN.md's own spec doesn't require.
**Why it matters:** A developer who builds strictly from DESIGN.md's Components section (not EXPERIENCE.md's prose table) could legitimately ship a badge with a colored dot and no text (satisfies "color + icon" literally) in a space-constrained context (e.g., a dense mobile card view), and a colorblind user would have no way to distinguish "active" from "rejected." This is exactly the accessibility failure mode the "no color alone" rule exists to prevent.
**Fix:** Make DESIGN.md's Status Badge spec explicitly require text as a hard invariant, not just color+icon. Separately, replace the four colored-circle glyphs with genuinely shape-distinct icons (check/circle-slash/clock/x, or similar) so the icon itself carries information independent of color and of the text label — this also protects against a future redesign that drops the text.

### 1.3 [MEDIUM] No focus-management spec for Drawer/Modal (trap, initial focus, return focus)
**File/section:** `EXPERIENCE.md` Interaction Primitives (line 93: "`Esc` סוגר Modal/Drawer פתוח") and Component Patterns rows for the edit Drawer / mark-inactive Modal (lines 67-68); `DESIGN.md` Elevation & Depth (line 112, only mentions inherited hover/focus **shadow**, not focus **management**).
**Problem:** Nothing in either document specifies: (a) whether focus moves into the Drawer/Modal on open (and to what — heading vs. first field), (b) whether Tab is trapped inside the open Drawer/Modal (so a keyboard user doesn't tab out into the dimmed background content behind it), or (c) whether focus returns to the triggering table row when the Drawer/Modal closes. This is true for every interactive surface that opens a Drawer/Modal: the edit-contact Drawer, the mark-inactive confirmation Modal, and the domain-assignment Modal shown in `.working/key-domains.html`.
**Why it matters:** Untrapped focus in overlays is one of the most common real-world keyboard-accessibility failures (a screen-reader/keyboard user tabs "through" a dimmed, supposedly-inert background while a modal sits on top, visually and semantically disconnected from where focus actually is). This is squarely inside "Component Patterns" the task asked to check (drawer form, dropzone, approval queue) and is currently unaddressed for the two components used constantly in the internal area.
**Fix:** Add an explicit line to EXPERIENCE.md's Accessibility Floor or Component Patterns: "Drawer/Modal traps focus while open, moves initial focus to \[heading/first field] on open, and returns focus to the triggering element on close (Esc or explicit close)."

### 1.4 [MEDIUM] "Higher accessibility bar for the public form" is asserted, not substantiated
**File/section:** `EXPERIENCE.md` line 102 ("ברמה גבוהה יותר בטופס הפומבי").
**Problem:** The claim of a *higher* bar than the internal area's AA floor is stated once and then the only concrete differentiator anywhere in the doc is the 44×44px touch-target rule (line 105). There is no stated contrast target (e.g., AAA 7:1 anywhere on the public form), no font-size floor, no statement about avoiding image-based CAPTCHA (which the mockup's plain checkbox happens to satisfy, but the doc never says this was a deliberate accessibility choice), and no differentiation in error-recovery/timeout handling. As written, "higher bar" is an assertion with a single supporting data point, not a followed-through requirement.
**Why it matters:** Per the task brief and per NFR-D/the Constraints section of the PRD (the public form is explicitly flagged "משיק ציבורי" — public-facing, higher rigor), this is exactly the surface where an unqualified crowd (any device, any ability, first-time users, per PRD §2.1/§6) will actually hit accessibility barriers. A single line item dressed as a blanket policy will not survive implementation-time trade-offs without more concrete criteria.
**Fix:** Either name 2-3 concrete AAA-level or above-AA criteria that apply specifically to the public form (e.g., contrast ≥7:1 for body text, no CAPTCHA requiring visual/audio puzzle-solving, larger default font size, no time limits on form completion), or soften the claim to what's actually specified (touch target + no-JS-required dropzone fallback).

### 1.5 [MEDIUM] aria-live / label-linkage claims are not connected per-pattern, and the mockups already violate them
**File/section:** `EXPERIENCE.md` line 103 ("כל שדה טופס מקושר ל-label שלו (`aria-label`/`for`) וכל שגיאת ולידציה מוכרזת... `aria-live`"). Cross-checked against `.working/key-contact-drawer.html` lines 48-58, `.working/key-public-form.html` lines 35-39, `.working/key-domains.html` lines 67-70.
**Problem:** In **every** mockup form (contact edit Drawer, public registration form, domain-assignment Modal), every `<label>` is written as a plain sibling of its `<input>`/`<select>` (`<div class="field"><label>שם מלא</label><input ...></div>`) with no `for`/`id` pairing and no wrapping. As real rendered markup ("ground truth for what was actually decided" per the task brief), this directly contradicts the stated rule in the same spine that these forms are supposed to illustrate. The Dropzone's stated inline validation ("שגיאת... מוצגת מיד בעת בחירה" — Component Patterns line 69) also never states whether that error is `aria-live`-announced or only visually red text, despite the general Accessibility Floor bullet.
**Why it matters:** Unlabeled/mis-associated form fields are a top-tier screen-reader failure (SC 1.3.1, 4.1.2) — the exact class of bug the doc claims to prevent. Since these mockups are called out as authoritative reference markup, a developer copying this HTML pattern verbatim inherits the bug.
**Fix:** Either fix the mockups (wrap inputs in `<label>` or add matching `for`/`id`), or add an explicit caveat near the top of `.working/` (or in EXPERIENCE.md's mockup pointer) that the sketches are visual-only and not markup-accurate for a11y attributes — right now nothing disclaims this, and the task itself treats them as ground truth.

### 1.6 [LOW] No skip-navigation / bypass-blocks mechanism
**File/section:** `EXPERIENCE.md` Foundation/IA (sidebar nav appears first in DOM in every internal mockup, e.g. `.working/key-contacts-list.html` lines 38-46).
**Problem:** The sidebar nav (4-6 links) sits before `.main` in DOM order on every internal screen, and nothing in either doc mentions a "skip to content" mechanism. A keyboard user must tab through the full nav on every single navigation.
**Why it matters:** WCAG SC 2.4.1 (Bypass Blocks, AA) — this is a real, common, cheap-to-fix gap that the doc's stated AA floor should have caught.
**Fix:** Add a skip link (visually hidden until focused) as a standing pattern in the Accessibility Floor section, or note that Mantine's `AppShell` provides this and confirm it's wired up.

---

## 2. RTL Correctness

### 2.1 [HIGH] "Drawer opens from left in RTL" is stated as a blanket rule but conflates two different Drawers with opposite correct answers
**File/section:** `EXPERIENCE.md` line 101 ("כיווניות Drawer (נפתח מצד שמאל ב-RTL)") vs. `DESIGN.md` line 108 ("Sidebar ניווט קבוע בצד ימין... הופך ל-Drawer נשלף **מעל** ב-`sm`" — no direction stated).
**Problem:** There are two distinct Drawers in this product: (a) the **content edit Drawer** (contact/body edit form), and (b) the **responsive nav Drawer** that the right-anchored Sidebar collapses into on small screens. EXPERIENCE.md's rule is phrased generically ("the Drawer opens from the left in RTL") without scoping which one it applies to. For (a), "opens from left" is defensible and is exactly what `.working/key-contact-drawer.html` implements (`.drawer{left:0}`, shadow cast toward the right, line 16) — consistent, verified correct. But for (b), the Sidebar lives permanently at the **right** edge on wide screens; collapsing it into a Drawer that then slides in from the **left** on narrow screens would teleport the nav to the opposite side of the screen from where users learned to expect it, which is disorienting and arguably the wrong choice — the nav Drawer should logically open from the **right** (where its anchor lives) to preserve spatial continuity. DESIGN.md, which is supposed to own this layout decision, says only "מעל" (over/on top) with no left/right — so it neither corroborates nor contradicts, it just doesn't decide.
**Why it matters:** If implemented literally as one global "Drawer = left" rule, the nav Drawer will slide in from the wrong side relative to its permanent-layout anchor — a concrete, shippable RTL bug, and exactly the kind of "one rule doesn't fit two components" trap the task asked to check for.
**Fix:** Split the rule: content/detail Drawers (edit forms) open from the trailing/left edge in RTL; the responsive nav Drawer that replaces the anchored Sidebar opens from the **same side the Sidebar occupies at rest (right)**. State both explicitly in EXPERIENCE.md and have DESIGN.md's Layout & Spacing section corroborate with an explicit direction, not "מעל."

### 2.2 [MEDIUM] Breadcrumb separator glyph is unmirrored in the one place it appears in the mockups
**File/section:** `.working/key-body-detail.html` line 50: `<div class="breadcrumb"><a href="#">גופים נתמכים</a> ›  עמותת אור לילדים</div>`.
**Problem:** The breadcrumb uses `›` (U+203A, right-pointing angle). Unlike text reflow, this Unicode glyph does **not** get mirrored by `dir="rtl"` — it's not treated as a directional/mirrored character by the bidi algorithm the way arrows in an icon font might be. In an RTL breadcrumb (parent at the right, descending toward the left, consistent with EXPERIENCE.md's own stated icon-direction rule "חץ קדימה מצביע שמאלה ב-RTL"), the separator should visually point **left** (`‹`) to match the direction of hierarchical descent, not right.
**Why it matters:** This is a concrete instance of the exact class of bug EXPERIENCE.md's RTL section gestures at ("icon directionality") but only illustrates with one abstract example (a generic forward arrow) — it never actually enumerates or catches the one directional glyph that made it into a real mockup.
**Fix:** Use `‹` (or a CSS-mirrored chevron icon rather than a bare Unicode character) for breadcrumb separators in RTL, and add "breadcrumb/pagination separators" to the list of things the icon-direction rule explicitly covers.

### 2.3 [MEDIUM] Inherited Mantine RTL behavior (Pagination arrows, bidi-isolation of numeric strings) is never verified or called out
**File/section:** `EXPERIENCE.md` line 95 (Pagination is the mandated navigation control, "לא גלילה אינסופית"); `DESIGN.md` line 120 (Pagination listed as inherited "כמו שהוא" from Mantine); NFR-D in `prd.md` (RTL מלא, Must).
**Problem:** Pagination's prev/next controls are inherently directional (chevrons) and must flip in RTL for "next" to point left. Neither doc states that Mantine's RTL context (`MantineProvider dir="rtl"` or equivalent) is actually configured, nor confirms Pagination's arrows flip correctly under it — this is simply assumed via "inherits from Mantine as-is." Separately, none of the docs address bidi-isolation for embedded LTR-shaped numeric strings inside RTL text — phone numbers (`052-1234567`), ח"פ numbers (`51-234567-8`), and dates (`15/09/2026`) are all hyphen/slash-separated multi-segment numerics that are a classic source of segment-reordering bugs under the Unicode bidi algorithm when not explicitly isolated (e.g. via `unicode-bidi: isolate` or a `dir="ltr"` span).
**Why it matters:** NFR-D is a Must-have ("עברית ו-RTL מלא"), and both of these are known, easy-to-miss RTL failure classes that only show up with live data (not static mockups, which happen to render correctly because they were typed once in a text editor, not fed through a real bidi-reordering runtime with adjacent RTL punctuation).
**Fix:** Add an explicit line confirming Mantine's RTL provider is enabled globally (this may belong in architecture rather than UX, but the UX Accessibility Floor should at least flag the requirement), and add a rule that structured numeric strings (phone/ח"פ/dates) are wrapped with bidi isolation to prevent segment reordering.

### 2.4 [LOW] Positive finding — worth preserving, not a bug
Sidebar anchoring is actually correct: the Sidebar is the **first** DOM child in every internal mockup (e.g. `.working/key-contacts-list.html` lines 36-46), and because CSS Flexbox's row axis runs right-to-left under `dir="rtl"`, this correctly places it at the **right** edge, matching both EXPERIENCE.md's IA description and DESIGN.md line 108 ("Sidebar... בצד ימין"). It also happens to make Tab order match RTL reading order at the page level (sidebar-then-content = right-to-left), which is not called out anywhere in either doc as a deliberate technique, and should be — the fact that it currently works is coincidental to how the mockups were hand-written, not because either spine document specifies the DOM-vs-visual-order dependency that makes it work. If future screens don't follow the same "put the right-anchored element first in markup" discipline, the Tab-order-matches-reading-order claim (line 106) will silently break.

---

## 3. Consistency: DESIGN.md ↔ EXPERIENCE.md ↔ Mockups

### 3.1 [HIGH] EXPERIENCE.md's mockup pointers are entirely stale — wrong directory, wrong filenames, and 4 of 8 real files are never referenced
**File/section:** `EXPERIENCE.md` line 45: `→ הפניה להרכבה: mockups/contacts-list.html, mockups/contact-detail-drawer.html, mockups/registration-form.html, mockups/registration-queue.html.`
**Problem:** None of these four paths exist. The real files live in `.working/` (not `mockups/`) and are named `key-contacts-list.html`, `key-contact-drawer.html`, `key-public-form.html` (not `registration-form.html`), and `key-registration-queue.html`. In addition, four real mockups are never mentioned at all: `key-domains.html`, `key-bodies-list.html`, `key-body-detail.html`, `key-public-confirmation.html`.
**Why it matters:** This is exactly the kind of stale cross-reference that silently rots — anyone following EXPERIENCE.md's pointer to "go look at the mockup" hits a 404, and half the actual decided-upon screens (domains, bodies list, body detail, confirmation) have no discoverable link from the spine at all.
**Fix:** Update line 45 to the real paths and add the four missing files (or fold them under a "→ see also" line), e.g.: `.working/key-domains.html`, `.working/key-bodies-list.html`, `.working/key-body-detail.html`, `.working/key-contacts-list.html`, `.working/key-contact-drawer.html`, `.working/key-registration-queue.html`, `.working/key-public-form.html`, `.working/key-public-confirmation.html`.

### 3.2 [HIGH] Four components named in EXPERIENCE.md have no home anywhere in DESIGN.md
**File/section:** `EXPERIENCE.md` Component Patterns (lines 59-72) and State Patterns (lines 74-85) vs. `DESIGN.md` Components (lines 118-126, which lists only: inherited-as-is {Button, TextInput, Select, Table, Modal, Drawer, Notification, Tabs, Breadcrumbs, Pagination} + custom {Button-primary, Status Badge, Attention Card}).
**Problem:** The following are named and behaviorally specified in EXPERIENCE.md but appear **nowhere** in DESIGN.md's Components catalog, either as "inherits from Mantine as-is" or as a custom branding entry:
- **Dropzone** (Component Patterns line 69) — only ever mentioned inline as "Mantine Dropzone" in EXPERIENCE.md prose; DESIGN.md's inherited list omits it entirely, so there is no visual spec (border style, radius, colors) anywhere for the one interactive control used by the anonymous public-facing surface.
- **Skeleton** (State Patterns line 78, loading state) — same gap.
- **Generic Card** — used for the registration-request card (Component Patterns line 70), the body-detail header-card (`.working/key-body-detail.html` line 19), and distinct from the already-specified `attention-card` — Mantine's `Card` primitive isn't in DESIGN.md's inherited list at all, and this generic card pattern has no radius/border/shadow spec of its own.
- **Empty state** (Component Patterns line 72) — described behaviorally (icon + one sentence + one primary action) but with zero visual spec and no Mantine-inheritance statement.
**Why it matters:** DESIGN.md is explicitly positioned as "מקור האמת לזהות הוויזואלית" (EXPERIENCE.md line 21). A component with no entry there has no visual contract at all — not even "inherits Mantine defaults," which is the minimum bar every other component in the system meets.
**Fix:** Add these four to DESIGN.md's Components section, even if the entry is just one line: "Dropzone / Skeleton / Card / Empty state — inherits Mantine defaults, no branding override."

### 3.3 [MEDIUM] "Registration card always shows exactly 3 actions" is falsified by the mockup illustrating the same feature
**File/section:** `EXPERIENCE.md` Component Patterns line 70 ("שלוש פעולות גלויות תמיד: אשר / דחה / בקש השלמה") vs. `.working/key-registration-queue.html` lines 49-64 (the "⚠ לא זוהה גוף נתמך" flagged card).
**Problem:** The flagged/unmatched card in the mockup shows **"שייך לגוף קיים…" / "צור גוף נתמך חדש" / "דחה"** — not "אשר / דחה / בקש השלמה" as the spine claims is always true. This is a sensible design decision (you can't approve a request with no matched body to attach it to — consistent with FR-14/FR-15), but EXPERIENCE.md's own Component Patterns table never documents this exception; only the State Patterns table (line 83) covers the flagged-card's badge/placement, staying silent on what its actions are.
**Why it matters:** This is precisely the kind of "the doc's blanket claim doesn't survive contact with its own worked example" inconsistency the review was asked to hunt for. A developer implementing strictly from the Component Patterns table would build only the 3 generic buttons and miss the required special-case action set for unmatched requests — a functional gap, not just a documentation nit.
**Fix:** Add a row (or a footnote on the existing row) explicitly stating the alternate 3-action set for the "לא זוהה" case, cross-referenced to State Patterns line 83.

### 3.4 [LOW] Pending-request count is inconsistent across mockups
**File/section:** sidebar count pill: `.working/key-domains.html` line 46 (`1`), `.working/key-bodies-list.html` line 41 (`1`), `.working/key-contacts-list.html` line 43 (`1`), `.working/key-registration-queue.html` line 42 (`3`) — while that same queue page's body only renders 3 request cards, so it's internally self-consistent, but disagrees with the other three static sketches.
**Why it matters:** Minor since these are independent hand-authored static sketches, not live state, but if anyone screenshots/measures the sidebar for the "Attention Card" default look, they'll pick up conflicting reference values.
**Fix:** Pick one number and use it consistently across sketches, or add a caption noting the count is illustrative/arbitrary per-screen.

### 3.5 [LOW] Channel-preference icons rely on opacity alone, and aren't named in EXPERIENCE.md at all
**File/section:** `.working/key-contacts-list.html` line 30 (`.chan .off{opacity:.25;}`) and rows at lines 60-63.
**Problem:** The email/SMS channel-opt-out indicator dims the same emoji (📧/📱) via CSS opacity, with no icon change, no text, and no `aria-label`. This is the same "single subtle visual property carries meaning" failure mode the Status Badge rule (§1.2 above) is designed to prevent — but this pattern isn't in EXPERIENCE.md's Component Patterns table at all, so the no-color/no-single-cue-alone rule was never applied to it.
**Why it matters:** Low-vision users may not perceive a 75%-opacity difference between two icons of the same shape and color; there's no text or tooltip fallback.
**Fix:** Add a "communication channel indicator" row to Component Patterns with the same non-single-cue-alone requirement (e.g., strikethrough + `aria-label="לא מעוניין בהודעות SMS"`, not opacity alone).

### 3.6 [INFORMATIONAL] No dangling `{token}` references found — because the mechanism is never used
**File/section:** `EXPERIENCE.md` (entire file).
**Finding:** A full search for `{` in EXPERIENCE.md returns zero matches — the file never uses the `{path.to.token}` syntax DESIGN.md's own frontmatter/Components section uses internally (e.g. `{colors.primary}`, `{rounded.pill}`). All cross-references from EXPERIENCE.md to DESIGN.md are informal prose ("ר' DESIGN.md"). This means there's nothing to flag as a *dangling* reference, but it also means the two docs' visual/behavioral split is coupled only by convention, not by anything checkable — a token renamed in DESIGN.md's frontmatter would silently break nothing in EXPERIENCE.md because nothing there points at it structurally. Separately, DESIGN.md's own internal token references were all verified to resolve correctly (every `{colors.*}`/`{rounded.*}` used in the Components block at lines 63-78 has a matching frontmatter definition at lines 7-60) — no dangling tokens found within DESIGN.md itself.

### 3.7 [LOW] Dark-mode tokens exist for 2 of 6 color groups only
**File/section:** `DESIGN.md` frontmatter lines 11-26.
**Finding:** `primary`/`primary-foreground` and `accent`/`accent-foreground` each have `-dark` counterparts, but the four `status-*` colors (active/inactive/pending/rejected) — the most-repeated component in the system — do not. If dark mode is ever switched on, Status Badges have no defined dark-mode palette. Not in scope of the PRD today (no dark-mode requirement found anywhere), so flagged as informational/low rather than a real defect, but worth a note before anyone assumes the `-dark` tokens are a complete set.

---

## Summary of Findings by Severity

| # | Severity | Finding | Category |
|---|---|---|---|
| 1.1 | Critical | Status-pending/accent badge & count-pill text fails WCAG AA contrast (~3.6:1 vs required 4.5:1) | Accessibility |
| 3.1 | High | EXPERIENCE.md's mockup file references are entirely stale (wrong dir/names, 4/8 files unreferenced) | Consistency |
| 3.2 | High | Dropzone, Skeleton, Card, Empty State have no home in DESIGN.md | Consistency |
| 2.1 | High | "Drawer opens from left" rule conflates content-drawer vs. nav-drawer, likely wrong for the latter | RTL |
| 1.2 | High | DESIGN.md's badge spec only guarantees color+icon (not text); the "icons" are same-shape colored circles | Accessibility |
| 3.3 | Medium | "Always 3 actions" on registration cards contradicted by the flagged-card mockup | Consistency |
| 2.2 | Medium | Breadcrumb `›` separator unmirrored for RTL hierarchy direction | RTL |
| 2.3 | Medium | Pagination RTL-chevron behavior and numeric bidi-isolation never addressed | RTL |
| 1.3 | Medium | No focus-trap/initial-focus/return-focus spec for Drawer/Modal | Accessibility |
| 1.4 | Medium | "Higher bar for public form" asserted but only one concrete differentiator given | Accessibility |
| 1.5 | Medium | Label/`for` linkage claim contradicted by every mockup's actual markup | Accessibility |
| 3.4 / 3.5 | Low | Inconsistent pending-count across mockups; channel icons rely on opacity alone | Consistency |
| 1.6 | Low | No skip-navigation link | Accessibility |
| 3.6 / 3.7 | Informational | No dangling tokens (mechanism unused); dark-mode tokens incomplete for status colors | Consistency |

**Report location:** `C:\Users\This User\Desktop\Rachel\contact-management\_bmad-output\planning-artifacts\ux-designs\ux-contact-management-2026-09-15\review-accessibility.md`
