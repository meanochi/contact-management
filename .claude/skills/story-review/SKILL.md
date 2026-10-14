---
name: story-review
description: 'Post-story, read-only code review for this project. Runs tsc/lint/jest and a drizzle-kit schema/migration consistency check on touched workspaces, then parallel reviewers (acceptance criteria, API, DB, web, TypeScript/quality, tests, security/edge cases) against the expertise-* skills, and writes a Hebrew report to reviews/. Warns only, never edits source code. Use after finishing a story, or when the user says "review the story", "story review", "run review", or "סקירת קוד".'
---

# Story Review

**Goal:** after a story is implemented, find problems and report them. **Warn only.**

## Hard rules

- **Never modify source code, tests, configs or the story file.** The only file you may create is the report under `reviews/`. Reviewer subagents are told the same.
- **No TDD check.** This project does not enforce TDD. Ignore TDD-order rules in `expertise-testing` (including "write the failing test first" and the Amelia red/green/refactor discipline). Only check that tests exist and cover critical paths.
- Report only what you can point at: every finding needs `file:line`, a quoted snippet, and the rule it violates. No vague style opinions.
- Report language: Hebrew. Code, paths, identifiers and quotes stay in English.

## Input

`/story-review [story-file-or-id]`

1. Story file: the argument if given. Otherwise look in `_bmad-output/implementation-artifacts/` for the story that is `in-progress` / `review` (check `sprint-status.yaml`), else the most recently modified `*.md` there. If none found, ask the user once for the path; proceed without acceptance-criteria audit only if the user says there is none.
2. Diff range: the commits of this story. Use the story's recorded start commit if present; else `git merge-base HEAD main`..HEAD plus uncommitted changes (`git diff` and `git status`). State the range you chose in the report.
3. Round number: count existing `reviews/<story-id>-review*.md`. Round N>1 → read the previous report and mark each old finding as fixed / still open / new.

## Step 0: Classify and run tools (deterministic, no LLM guesses)

1. List changed files; classify into areas: `api` (apps/api), `web` (apps/web), `db` (packages/db: Drizzle schema, drizzle/ migrations, client), `tests` (`*.test.ts(x)`), `docs`, `config`.
2. Ignore generated files (lockfiles, generated drizzle migration SQL beyond a safety glance (but DO read it once for destructive statements), generated types, `.next`, `dist`).
3. For each touched workspace run, read-only, and record pass/fail with the failing output:
   - `npx turbo run lint --filter=<ws>`
   - `npx turbo run test --filter=<ws>` (if a `test` script exists)
   - type-check: `npx tsc --noEmit -p <ws>` (or the workspace's own script)
   - if `packages/db/src/schema/**` touched: **read-only check** — the same diff must contain a new `packages/db/drizzle/NNNN_*.sql` plus the updated `drizzle/meta/` files; a schema change without them is a Blocker (migration missing). Then run `npx drizzle-kit check` from `packages/db` (verifies the migration history is consistent; it writes nothing). Do **not** run `drizzle-kit generate` or `migrate` — they write files / touch a database. Read the new SQL once for destructive statements (`DROP`, `ALTER … TYPE`, `NOT NULL` without default).
   Before running any `turbo` command, follow AGENTS.md: resolve the installed `turbo` and read its bundled `docs/README.md` if you are unsure of CLI flags. Do not run `build`/`dev` or anything that writes outside build caches.
4. A failing tool is a **Blocker** finding with the actual output excerpt.

## Step 1: Parallel reviewers (subagents, read-only)

Launch in ONE message, in parallel, only those whose area was touched. Each gets: the diff, the changed-file list, the story file, and the instruction to read its skill file first, review **only the diff and its immediate callers**, and return findings in the schema below. Tell each: "Read-only. Do not edit anything."

| Reviewer | Runs when | Reads | Checks |
|---|---|---|---|
| Acceptance Auditor | story file exists | story, `_bmad-output/planning-artifacts/architecture/**/ARCHITECTURE-SPINE.md`, relevant PRD/epic | each AC met (✅/⚠️/❌ + evidence); spine invariants and ADs respected; scope creep |
| API | `api` | `.claude/skills/expertise-api-rest/SKILL.md` | URL/method/status codes, Zod via `ZodValidationPipe`, response/error envelope, Swagger helpers on every endpoint (check `/docs/json` shape if runnable), health probes untouched or extended correctly, logging per `expertise-observability`, versioning, rate limit on public registration |
| DB | `db` or Drizzle usage in `apps/api` | `.claude/skills/expertise-postgres-drizzle/SKILL.md` | soft-delete, multi-table writes in one `db.transaction` on `tx`, unique/not-found translation, no N+1, `updatedAt` set on every update, escaped `ilike` terms, domain-scoped filtering on every query (no cross-domain leaks), migration committed and safe, no false "audited automatically" claims |
| Web | `web` | `.claude/skills/expertise-react-nextjs/SKILL.md` | client/server boundary, no Route Handlers or `packages/db` in web (AD-1), Mantine + RTL, Redux usage, RHF + Zod (`zodResolver`), api-client layer, accessibility/Hebrew RTL |
| TS + Quality | any code | `.claude/skills/expertise-nodejs-typescript/SKILL.md`, `.claude/skills/expertise-code-quality/SKILL.md` | strictness, `any`, hand-written types duplicating a Zod schema (types must be `z.infer` aliases), async/error handling, file placement per the structural map, simplicity, duplication, over-engineering, performance (N+1, re-renders) |
| Tests | any code | `.claude/skills/expertise-testing/SKILL.md` (skip TDD rules) | tests exist for new logic and critical paths, co-location, shared render wrapper, no async Server Component render, `db-mock` approach for services (assertions on generated SQL), logging silenced in specs, tests actually assert something |
| Security + Edge cases | any code | `.claude/skills/bmad-review-edge-case-hunter/SKILL.md` + OWASP-style checks | authz, input validation, cross-domain data exposure, secrets in code, null/empty/boundary/race conditions, error paths |
| Docs | docs or API changed | README, `docs/`, Swagger (`/docs`) | README/docs and Swagger annotations updated to match behavior |
| Observability | `api` code touched | `.claude/skills/expertise-observability/SKILL.md` | new state changes logged with ids only, refusals at `warn`, no personal data in any log/span, no `console.log`, `instrumentation` import still first in `main.ts` |

Finding schema each reviewer returns:
`severity | area | file:line | quoted snippet | what is wrong and why it matters (1-2 sentences) | rule violated (skill + section) | suggested fix (text only)`

Severity: **Blocker** (bug, security/domain-isolation breach, missing audit-trail, tool failure, AC not met) · **High** · **Medium** · **Low** · **Nit**.

## Step 2: Verify and triage

1. Merge duplicates across reviewers.
2. For every Blocker and High, re-read the cited code yourself and mark **CONFIRMED**. If you cannot confirm, mark **PLAUSIBLE** ("אולי").
3. Drop findings with no `file:line` or no rule/impact. Drop Nits unless fewer than 5 total findings.
4. Findings in untouched code go only in "out of scope" with a one-line mention, not in the counts.

## Step 3: Output

### Terminal (max ~10 lines, Hebrew)
- Verdict: ✅ נקי / ⚠️ יש הערות / 🛑 יש Blockers
- Counts: Blocker n · High n · Medium n · Low n · (Plausible n)
- Tools: tsc ✅/❌ · lint ✅/❌ · tests ✅/❌ (n failed) · migrations ✅/❌/—
- One line per Blocker and High
- Path to the full report

### File: `reviews/<story-id>-review.md` (round N>1: `-review-N.md`)
Create `reviews/` if missing. Sections, in order:
1. Header: story, date, round, commit range, files reviewed (counts per area)
2. Verdict + 3-line summary
3. Tool results (command, pass/fail, trimmed output for failures)
4. If round>1: status of previous findings (fixed / open / new)
5. Acceptance criteria table (AC | ✅/⚠️/❌ | evidence)
6. Findings **grouped by severity** (CONFIRMED only), each: `file:line` link, problem and impact, rule violated, suggested fix (text)
7. **ממצאים לא וודאיים (PLAUSIBLE)** as a separate section at the end
8. Out of scope notes
9. **מה לא נבדק** (areas skipped, tools that could not run, reviewers not launched and why)

End by telling the user the code was not changed and the report is the only file written.
