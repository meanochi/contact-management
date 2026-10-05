import { AsyncLocalStorage } from "node:async_hooks";

export const auditContext = new AsyncLocalStorage<{ userId: string | null }>();

// Wrapped once per incoming request in apps/api (a global Interceptor or
// middleware in main.ts), before the request reaches any controller.
// `currentUser` comes from whatever auth mechanism AD-9 lands on (still
// undecided — see ARCHITECTURE-SPINE.md AD-9/Deferred); this file only
// consumes the resolved user, it doesn't establish the session itself.
// In Epic 1 there is no login at all, so userId is always null:
// auditContext.run({ userId: currentUser?.id ?? null }, () => next());
