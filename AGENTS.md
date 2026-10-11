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
| `expertise-nodejs-typescript` | Backend `.ts`/`.js` logic, tsconfig, npm workspaces, `turbo.json`, Joi-schema/TS-type definitions, async/error handling. |
| `expertise-api-rest` | Anything under `apps/api/src/**`: controllers, services, modules, URL/method/status design, Joi Pipes, response envelope, OpenAPI, versioning, rate limiting. |
| `expertise-postgres-prisma` | `schema.prisma`, migrations, Prisma queries and Client Extensions, audit trail, soft delete, domain-scoped filtering. |
| `expertise-react-nextjs` | `apps/web`: React/Next.js components, pages, Mantine (RTL), Redux Toolkit, React Hook Form + Joi, api-client layer. Presentation only, with no Route Handlers or Prisma access. |
| `expertise-testing` | Any test file or Jest config, TDD workflow, coverage priorities (Jest/RTL for web, `@nestjs/testing` for api). |

Rules:
- **Mandatory:** before creating, editing, or reviewing any `*.spec.ts`, `*.spec.tsx`, `*.test.ts` or `*.test.tsx` file, or any `jest.config.*`, you MUST load `expertise-testing` first. This applies in `apps/api`, `apps/web` and `packages/*`, and also when the test is only a small part of a larger task. Load it before writing the test, not after.
- Load every skill that matches the task. Cross-cutting work usually needs `expertise-code-quality` plus one or more domain skills.
- Each skill states what it does not cover and names the sibling skill to use instead. Follow those pointers rather than guessing.
- If a skill and the code disagree, say so and ask, instead of silently picking one.
