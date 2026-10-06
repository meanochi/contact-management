# Contact Management

A Hebrew/RTL system for managing supported bodies (גופים נתמכים) and their contacts (אנשי קשר) — built as a Turborepo monorepo with a NestJS API and a Next.js client.

## Overview

Organizations ("supported bodies") are linked to one or more domains (תחומים). Each body can have multiple contacts, and each contact can represent a subset of the domains of any body it's linked to — not necessarily all of them. The system tracks activation status, channel preferences (email/SMS), and documents external deactivation requests (source + date) without ever hard-deleting a record.

## Tech stack

| Layer | Stack |
|---|---|
| Monorepo | Turborepo 2.x + npm workspaces |
| Frontend (`apps/web`) | Next.js (App Router), Mantine UI, Redux Toolkit Query, React Hook Form |
| Backend (`apps/api`) | NestJS, class-based Pipes/Interceptors/Filters |
| Database | PostgreSQL 17, Prisma ORM |
| Validation | Joi — one shared schema per resource, used by both the API (server-side) and the client (`joiResolver`) |
| Language | TypeScript (strict mode, shared base config in `packages/config`) |

## Architecture

```
apps/
  web/      Next.js client — presentation only, talks to the API over HTTP
  api/      NestJS API — the only consumer of the database
packages/
  db/              Prisma schema, migrations, generated client
  shared-schemas/  Joi validation schemas + TypeScript types, shared by web and api
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

4. **Apply database migrations and generate the Prisma client**:
   ```bash
   npm run db:migrate:deploy
   npm run db:generate
   ```
   (`db:migrate:deploy` applies existing migrations non-interactively — the right choice for a fresh clone. Use `npm run db:migrate --workspace=@contact-management/db` only when you're authoring a *new* migration after changing `schema.prisma`.)

5. **Start both apps in development mode**:
   ```bash
   npm run dev
   ```
   - Web: http://localhost:3000
   - API: http://localhost:3001

## Available scripts

Run from the repo root — Turborepo fans these out to every workspace that defines them:

| Script | Description |
|---|---|
| `npm run dev` | Start `apps/web` and `apps/api` in watch mode |
| `npm run build` | Production build of every app/package |
| `npm run typecheck` | TypeScript type-checking across the monorepo |
| `npm run lint` | ESLint across the monorepo |
| `npm run test` | Jest tests across the monorepo |
| `npm run db:migrate` | Run a new Prisma migration (dev) |
| `npm run db:migrate:deploy` | Apply existing migrations without creating a new one (used automatically before `dev`) |
| `npm run db:generate` | Regenerate the Prisma client from the current schema |

## Database

- Schema: `packages/db/prisma/schema.prisma`
- Soft deletes only — no model is ever hard-deleted. A "removed" `SupportedBody` or `Contact` is marked inactive and remains fully queryable for history.
- Contact ↔ SupportedBody is many-to-many, and each link carries its own subset of that body's domains — see `ContactOnSupportedBodyDomain` in the schema.

## Status

Epic 1 (supported body + contact management, no auth/permissions yet) is implemented end-to-end: create/edit/deactivate/reactivate for both supported bodies and contacts, domain-subset management per contact-body link, and search/filter on both list screens. Progress and implementation notes are tracked in `_bmad-output/planning-artifacts/epics/Epic_1.md`.

Known limitation: the audit trail (who changed what, when) is temporarily disabled due to an upstream Prisma 7.10.0 extension-context bug — see the comment in `packages/db/src/client.ts` for the re-enable path once resolved.
