import { configureStore } from "@reduxjs/toolkit";
import { domainsApi } from "./api/domainsApi";
import { supportedBodiesApi } from "./api/supportedBodiesApi";
import { contactsApi } from "./api/contactsApi";

// A module-level singleton is fine for this client-only store (expertise-react-nextjs §5)
// — don't recreate it per render. No plain slices yet: nothing in Epic 1 so far is
// genuinely global/client-only state (session, cross-screen prefs) — only server
// data via RTK Query, which owns its own cache/invalidation.
export const store = configureStore({
  reducer: {
    [domainsApi.reducerPath]: domainsApi.reducer,
    [supportedBodiesApi.reducerPath]: supportedBodiesApi.reducer,
    [contactsApi.reducerPath]: contactsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(domainsApi.middleware, supportedBodiesApi.middleware, contactsApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
