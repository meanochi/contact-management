# Contact Management

A Hebrew/RTL system for managing supported bodies (גופים נתמכים) and their contacts (אנשי קשר) — built as a Turborepo monorepo with a NestJS API and a Next.js client.

## Overview

Organizations ("supported bodies") are linked to one or more domains (תחומים). Each body can have multiple contacts, and each contact can represent a subset of the domains of any body it's linked to — not necessarily all of them. The system tracks activation status, channel preferences (email/SMS), and documents external deactivation requests (source + date) without ever hard-deleting a record.

## Tech stack

| Layer | Stack |
|---|---|
| Monorepo | Turborepo 2.x + npm workspaces |
| Frontend (`apps/web`) | Next.js (App Router), Mantine UI, Redux Toolkit Query, React Hook Form |
| Backend (`apps/api`) | NestJS, class-based Pipes/Interceptors/Filters, Swagger/OpenAPI (`/docs`), health probes (`/health/*`) |
| Database | PostgreSQL 17, Drizzle ORM + drizzle-kit migrations |
| Validation | Zod 4 — one shared schema per resource, used by both the API (`ZodValidationPipe`) and the client (`zodResolver`); TypeScript types and the Swagger docs are derived from the same schemas |
| Observability | OpenTelemetry (traces + logs, OTLP export) with the Nest logger bridged to the OTel Logs API |
| Language | TypeScript (strict mode, shared base config in `packages/config`) |

## Architecture

```
apps/
  web/      Next.js client — presentation only, talks to the API over HTTP
  api/      NestJS API — the only consumer of the database
packages/
  db/              Drizzle schema, SQL migrations (drizzle/), database client
  shared-schemas/  Zod schemas + the TypeScript types inferred from them, shared by web and api
  ui/              Presentational React components shared by the app's screens
  config/          Shared tsconfig/eslint base configuration
```

`apps/web` never imports `packages/db` directly — all data access goes through `apps/api`'s HTTP endpoints. This keeps the database layer, business logic, and presentation layer cleanly separated, and allows the two apps to be deployed independently.

## Prerequisites

- Node.js 22+ (developed against Node 24 — see `.nvmrc`)
- npm 11+ (the workspace's package manager, pinned in `package.json`)
- Docker (for the local PostgreSQL instance)

## Getting started

1. **Install dependencies** (from the repo root):
   ```bash
   npm install
   ```

2. **Start PostgreSQL**:
   ```bash
   docker compose up -d
   ```

3. **Configure environment variables** — copy each example file and adjust if needed:
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```

4. **Apply database migrations and seed the sample domains**:
   ```bash
   npm run db:migrate
   npm run db:seed --workspace=@contact-management/db
   ```
   (`db:migrate` applies the committed SQL migrations in `packages/db/drizzle/` and is also run automatically before `dev`. To *author* a new migration after changing `packages/db/src/schema/index.ts`, run `npm run db:generate` and commit the generated SQL.)

   > **Upgrading a database created by the old Prisma setup** (it already has the tables and you want to keep its data): run `npm run db:baseline --workspace=@contact-management/db` once. It records the first migration as applied without running it, and `db:migrate` then works normally. A throwaway database can instead be reset with `docker compose down -v && docker compose up -d`.

5. **Start both apps in development mode**:
   ```bash
   npm run dev
   ```
   - Web: http://localhost:3000
   - API: http://localhost:3001
   - API docs (Swagger UI): http://localhost:3001/docs — raw OpenAPI at `/docs/json`
   - Health: http://localhost:3001/health/live and http://localhost:3001/health/ready

## Available scripts

Run from the repo root — Turborepo fans these out to every workspace that defines them:

| Script | Description |
|---|---|
| `npm run dev` | Start `apps/web` and `apps/api` in watch mode |
| `npm run build` | Production build of every app/package |
| `npm run typecheck` | TypeScript type-checking across the monorepo |
| `npm run lint` | ESLint across the monorepo |
| `npm run test` | Jest tests across the monorepo |
| `npm run db:generate` | Generate a new SQL migration from changes to the Drizzle schema (commit the result) |
| `npm run db:migrate` | Apply pending migrations (used automatically before `dev`) |

## Database

- Schema: `packages/db/src/schema/index.ts` — migrations: `packages/db/drizzle/`
- Soft deletes only — no model is ever hard-deleted. A "removed" `SupportedBody` or `Contact` is marked inactive and remains fully queryable for history.
- Contact ↔ SupportedBody is many-to-many, and each link carries its own subset of that body's domains — see `ContactOnSupportedBodyDomain` in the schema.

## Status

Epic 1 (supported body + contact management, no auth/permissions yet) is implemented end-to-end: create/edit/deactivate/reactivate for both supported bodies and contacts, domain-subset management per contact-body link, and search/filter on both list screens. Progress and implementation notes are tracked in `_bmad-output/planning-artifacts/epics/Epic_1.md`.

Known limitation: the audit trail (who changed what, when) is not active — the `AuditLog` table exists but nothing writes to it (the previous Prisma extension was disabled, and Drizzle has no equivalent hook). See "Audit trail" in `.claude/skills/expertise-postgres-drizzle/SKILL.md` for the two options (PostgreSQL triggers or an explicit helper).

## Observability, API docs and health

- **Logging / OpenTelemetry** — every request logs an entering and a leaving line with its trace id (`x-trace-id` response header); service-level events are logged with ids only (no personal data). Traces and logs are exported over OTLP when `OTEL_EXPORTER_OTLP_ENDPOINT` is set (e.g. `http://localhost:4318`); otherwise logs stay on stdout. `LOG_LEVEL` and `LOG_FORMAT=json` control verbosity/format. Full list of variables in `apps/api/.env.example`; conventions in `.claude/skills/expertise-observability/SKILL.md`.
- **Swagger** — generated from the same Zod schemas that validate requests, so the docs cannot drift. Off when `NODE_ENV=production` unless `SWAGGER_ENABLED=true`.
- **Health** — `GET /health/live` (process is up) and `GET /health/ready` (database answers; `503` otherwise). Use them for container/orchestrator probes.
