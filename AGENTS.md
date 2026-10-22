<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Expertise skills

Before writing or reviewing code in this repo, load the relevant `expertise-*` skill(s) (in `.claude/skills/`). They hold the project's conventions; follow them over general defaults.

| Skill | Use when |
| --- | --- |
| `expertise-code-quality` | Any code, in any layer. Baseline principles and the canonical folder/file map (where a new file, service, type, schema, hook or component belongs). |
| `expertise-nodejs-typescript` | Backend `.ts`/`.js` logic, tsconfig, npm workspaces, `turbo.json`, Zod schemas and the types inferred from them, async/error handling. |
| `expertise-api-rest` | Anything under `apps/api/src/**`: controllers, services, modules, URL/method/status design, Zod Pipes, response envelope, Swagger (generated from Zod), health probes, versioning, rate limiting. |
| `expertise-postgres-drizzle` | `packages/db` Drizzle schema, drizzle-kit migrations, Drizzle queries/transactions in services, audit trail status, soft delete, domain-scoped filtering. |
| `expertise-observability` | Every operation you add or change in `apps/api` (endpoints, service methods, error paths, jobs, startup/shutdown): what to log and at which level, what must never be logged (personal data), OpenTelemetry (`apps/api/src/telemetry/**`), request logging, tracing/collector configuration. |
| `expertise-react-nextjs` | `apps/web`: React/Next.js components, pages, Mantine (RTL), Redux Toolkit, React Hook Form + Zod, api-client layer. Presentation only, with no Route Handlers or database access. |
| `expertise-diagrams` | Generating or refreshing the ERD and the Class Diagram (`docs/diagrams/`), and after any change to the Drizzle schema or to an `apps/api` module/controller/service. |
| `expertise-testing` | Any test file or Jest config, TDD workflow, coverage priorities (Jest/RTL for web, `@nestjs/testing` for api). |

Rules:
- **Mandatory:** before creating, editing, or reviewing any `*.spec.ts`, `*.spec.tsx`, `*.test.ts` or `*.test.tsx` file, or any `jest.config.*`, you MUST load `expertise-testing` first. This applies in `apps/api`, `apps/web` and `packages/*`, and also when the test is only a small part of a larger task. Load it before writing the test, not after.
- **Mandatory:** before creating or changing any operation in `apps/api` (a controller endpoint, a service method that writes data or makes a decision, an error path, a background or scheduled job, startup/shutdown code) or `packages/db` runtime code, you MUST load `expertise-observability` and log it as that skill requires: state changes and deliberate refusals logged through Nest's `Logger` with ids only, every error path logged exactly once at the right level, and never any personal data. Logging is part of finishing the operation, not a follow-up, just like its tests and code quality. A change that adds an operation with no log, or logs personal data, is not done.
- Load every skill that matches the task. Cross-cutting work usually needs `expertise-code-quality` plus one or more domain skills.
- Each skill states what it does not cover and names the sibling skill to use instead. Follow those pointers rather than guessing.
- If a skill and the code disagree, say so and ask, instead of silently picking one.
