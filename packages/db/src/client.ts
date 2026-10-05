// Prisma 7's "prisma-client" generator emits client.ts as the entry point,
// not index.ts — the bare directory import ("./generated/prisma") does not
// resolve; it must point at the file directly.
import { Prisma, PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { auditContext } from "./audit-context";

// Re-exported so consumers (apps/api services) can check error types, e.g.
// `err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"`
// — see expertise-api-rest's "translate ORM errors at the Service layer".
export { Prisma };

const AUDITED_WRITE_OPS = new Set(["create", "update", "delete", "updateMany", "deleteMany"]);

// Prisma's $allOperations spans every model generically — there is no static type
// linking the string `model` name to its specific delegate. This is a documented
// limitation of $allModels/$allOperations, not a shortcut, and it's the one place
// in this codebase where expertise-nodejs-typescript's "no `any`" rule doesn't
// apply cleanly. Kept isolated to this single structural type instead of `any`.
type DelegateWithFindUnique = { findUnique: (args: { where: unknown }) => Promise<unknown> };
type AllOperationsArgs = {
  model: string;
  operation: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
};

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set — refusing to start without a database connection string.");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const rawClient = new PrismaClient({ adapter });

// ============================================================================
// ⚠️ AUDIT TRAIL TEMPORARILY DISABLED — product decision, 2026-10-04.
//
// `Prisma.getExtensionContext(this)` is broken for this exact pattern
// (query-level $allModels.$allOperations) on the installed Prisma version
// (7.10.0) — confirmed against a real DB, and matches a known reported
// Prisma issue (github.com/prisma/prisma/discussions/24178): instead of a
// usable client/delegate, `this`/getExtensionContext(this) resolves to an
// empty array. Every write in the app was failing with 500s because of it.
//
// Decision: ship without automatic audit logging for now, revisit once a fix
// or workaround is chosen (candidates discussed: restructure to avoid the
// broken context lookup, track the active client via AsyncLocalStorage
// instead, or re-evaluate the Prisma version — none decided yet). The
// extension logic itself is kept below, intact and unused, specifically so
// re-enabling it later is a small, reviewable diff — not a rewrite.
//
// To re-enable: change the `export const prisma = rawClient;` line below to
// `export const prisma = buildAuditedClient(rawClient);`, once the
// getExtensionContext issue is actually fixed.
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept intact, unused while audit trail is disabled (see note above)
function buildAuditedClient(client: PrismaClient) {
  return client.$extends({
    name: "auditLog",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: AllOperationsArgs) {
          if (model === "AuditLog" || !AUDITED_WRITE_OPS.has(operation)) {
            return query(args);
          }

          const userId = auditContext.getStore()?.userId ?? null;

          // Prisma.getExtensionContext(this) resolves to whichever client instance
          // is actually running this operation: the module-level `prisma` for a
          // standalone call, or the `tx` client when this was invoked inside
          // prisma.$transaction(async (tx) => ...). Using it (not the outer
          // `prisma` closure) for both the "before" read and the audit insert is
          // what makes the audit row participate in the SAME Postgres transaction
          // as the mutation, automatically, whenever the caller issued the
          // mutation via `tx`.
          //
          // CURRENTLY BROKEN on Prisma 7.10.0 — see the disabled-audit-trail
          // note above. Do not re-enable without fixing or working around this.
          const ctx = Prisma.getExtensionContext(this);
          const delegate = (ctx as unknown as Record<string, DelegateWithFindUnique>)[uncapitalize(model)];
          if (!delegate) {
            throw new Error(`Audit extension: no delegate found for model "${model}"`);
          }

          const before =
            operation === "update" || operation === "delete"
              ? await delegate.findUnique({ where: (args as { where: unknown }).where })
              : null;

          const result = await query(args);

          await (
            ctx as unknown as { auditLog: { create: (a: unknown) => Promise<unknown> } }
          ).auditLog.create({
            data: {
              tableName: model,
              recordId:
                (result as { id?: string } | null)?.id ??
                (args as { where?: { id?: string } })?.where?.id ??
                "unknown",
              action: operation.toUpperCase(),
              before: before ?? undefined,
              after: operation === "delete" ? undefined : (result as Record<string, unknown>),
              changedById: userId,
            },
          });

          return result;
        },
      },
    },
  });
}

function uncapitalize(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

// The only PrismaClient instance in the system (ARCHITECTURE-SPINE.md AD-5,
// AD-11) — reachable only from apps/api. Never construct a second PrismaClient
// anywhere else, even while auditing is disabled — when it's re-enabled, every
// write must go through this one exported client without exception.
export const prisma = rawClient;
