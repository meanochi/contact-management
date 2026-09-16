---
name: expertise-react-nextjs
description: 'React/Next.js App Router conventions for this project: Mantine (incl. RTL setup), Redux Toolkit usage in components, React Hook Form + Joi. Use when writing or reviewing any React component, page/layout/Server Action, or deciding a client-vs-server component boundary. Do NOT use for: API route handler internals/response envelope (expertise-api-rest), generic TypeScript/Node conventions (expertise-nodejs-typescript), Prisma schema/queries (expertise-postgres-prisma), or test file setup (expertise-testing).'
---

# React + Next.js App Router Reference (Contact Management App)

> Version-sensitive claims below (Next.js caching model, Mantine RTL mechanism, React APIs) can go stale. Before relying on one, check this repo's `package.json` for the actual installed majors of `next`, `react`, and `@mantine/core`, and skim the relevant doc if something here looks off. The decision rules and project-specific architecture facts (Server/Client boundary, RTL setup, Redux provider placement) are stable regardless of version.

**This project is currently greenfield — no `apps/`/`packages/` code exists yet.** File paths and file trees below (e.g. `app/(internal)/contacts/page.tsx`) describe the canonical structure the first implementation should establish, not files that already exist today. Once a given file exists in the repo, read it and follow its actual shape — these examples stop being the source of truth the moment real code diverges from them.

**Before introducing a new pattern** (a new form-wiring style, a new Redux slice shape, a new layout structure), grep the codebase for an existing example and follow it. Don't invent a second way to do something this project already does one way.

Legend: **[MUST]** = mandatory project rule, non-negotiable without a documented reason. **[RECOMMENDED]** = good default, use judgment.

> For universal engineering principles (simplicity, naming, DRY, avoiding over-engineering, comments, error handling) see `expertise-code-quality` — this file only covers what's specific to React/Next.js.

## 1. Server vs Client Components — the decision rule

**[MUST] Default every new file to a Server Component. Add `"use client"` only when the file itself needs:**

1. Hooks that touch browser/render state: `useState`, `useEffect`, `useReducer`, `useContext` (incl. Redux's `useSelector`/`useDispatch`).
2. Event handlers wired to client-side logic (`onClick`, `onChange`, `onSubmit`).
3. Browser-only APIs (`window`, `localStorage`, `IntersectionObserver`).
4. A library that assumes a browser runtime (most interactive Mantine inputs, React Hook Form).

If none apply, leave it a Server Component — no directive needed.

**Canonical pattern for this app:** a list page like `app/(internal)/contacts/page.tsx` should be a Server Component (fetches via Prisma directly, renders a Mantine `Table`); an edit form like `components/contacts/ContactEditForm.tsx` should be a Client Component (`useForm`, local modal state, possibly `useSelector`). Once these files exist, check their actual current form before assuming this split still holds.

**Composition:** a Server Component can render a Client Component (pass serializable props). A Client Component **cannot** `import` and render a Server Component directly — only via `children`/slot props from a parent Server Component. Keep the client boundary as low/leaf as possible: wrap the interactive piece (a form, a filter toolbar), never the whole page.

- **[MUST]** Fetch data (Prisma, DB calls) in Server Components or Server Actions, never in `useEffect`.
- **[MUST]** Pass only serializable props Server → Client (plain objects/DTOs — no functions, class instances, or Prisma model instances with methods).
- **[MUST NOT]** Call Redux hooks or React Hook Form from a Server Component — they throw or silently no-op.
- **[MUST NOT]** Mark a whole page `"use client"` because one button needs an `onClick` — extract that button into its own client component.

## 2. Mutations go through the REST API, not Server Actions

Route Handler request/response conventions (URL/method design, envelope shape, OpenAPI annotation) belong to `expertise-api-rest` — this section only covers *which mechanism* triggers a mutation, because Next.js offers two and using both for the same kind of action creates two undocumented, silently-diverging paths.

**[MUST] Every data mutation — contact create/edit/status-change, registration-queue approve/reject, domain admin CRUD, the public self-registration submission — goes through a Route Handler (`app/api/.../route.ts`), called from the client via an RTK Query mutation hook.** This project has already decided its API is a documented, Swagger/OpenAPI-annotated surface (`expertise-api-rest`) — routing the same mutations through Server Actions instead would create a second, undocumented way to do the same thing, and RTK Query (§5) needs an HTTP endpoint to call anyway for its cache-invalidation to work across every screen that shows the same data.

```tsx
// components/contacts/ContactEditForm.tsx
"use client";
import { useForm, Controller } from "react-hook-form";
import { joiResolver } from "@hookform/resolvers/joi";
import { contactSchema } from "@contact-mgmt/shared-schemas"; // same schema the Route Handler validates with
import { useUpdateContactMutation } from "@/lib/api/contactsApi"; // RTK Query, see §5

export function ContactEditForm({ contact }: { contact: Contact }) {
  const [updateContact, { isLoading, error }] = useUpdateContactMutation();
  const { control, handleSubmit } = useForm({
    resolver: joiResolver(contactSchema),
    defaultValues: contact,
  });

  return (
    <form onSubmit={handleSubmit((value) => updateContact({ id: contact.id, ...value }))}>
      {/* Controller-wrapped Mantine inputs, per §6 */}
    </form>
  );
}
```

**[MUST]** The Route Handler re-validates with the same shared Joi schema server-side regardless of what RHF already checked client-side (mechanism: `expertise-api-rest`'s validation wrapper) — never trust that client-side validation ran, since the endpoint is reachable independently of this form.

**[RECOMMENDED — narrow exception]** A `"use server"` Server Action is acceptable only for a mutation genuinely local to one page's UX with no reason to ever be part of the documented API (e.g. dismissing a client-only UI hint) — essentially none of this app's real data mutations qualify. If you're reaching for one, check first whether it should just be another RTK-Query-backed route instead.

## 3. Caching: rendering is dynamic unless you opt in

Recent Next.js majors (Cache Components / `"use cache"`) made **dynamic-by-default** the model: a Server Component or Route Handler runs fresh per request unless explicitly marked cacheable. Confirm which major this repo pins (`package.json`) before assuming this applies as described — pre-15/16 Next.js cached `fetch`/GET routes implicitly, which is the opposite default.

- **[MUST]** Since mutations go through RTK Query (§2), cache freshness after a mutation is RTK Query's tag-invalidation job (`invalidatesTags` on the mutation, `providesTags` on the query) — not `revalidatePath`/`revalidateTag`. Those Next.js APIs only matter for the rare page that still needs a full-navigation cache bust (e.g. after the narrow-exception Server Action in §2) — don't reach for them as the default post-mutation step.
- **[MUST NOT]** Assume a `fetch()` call is cached by default — verify against the installed Next.js version's docs if it matters.
- **[RECOMMENDED]** Leave per-coordinator, authorization-sensitive screens (contacts list/detail, registration queue) dynamic. Reach for an explicit caching opt-in only for genuinely shared, slow-changing data (e.g. the domains/reference-data admin list).

## 4. Mantine + RTL setup — [MUST]

This is a load-bearing project decision: Mantine was chosen specifically for RTL support, and the app is Hebrew-only.

```tsx
// app/layout.tsx (Server Component)
import "@mantine/core/styles.css";
import { ColorSchemeScript, mantineHtmlProps, MantineProvider, DirectionProvider } from "@mantine/core";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" {...mantineHtmlProps}>
      <head><ColorSchemeScript /></head>
      <body>
        <DirectionProvider initialDirection="rtl">
          <MantineProvider theme={theme}>{children}</MantineProvider>
        </DirectionProvider>
      </body>
    </html>
  );
}
```

- `DirectionProvider` (from `@mantine/core`) is what actually flips component internals (icons, spacing) for RTL — wrap it around `MantineProvider`. Mantine does **not** set the `dir` HTML attribute for you; you set `dir="rtl"` on `<html>` yourself.
- `mantineHtmlProps` on `<html>` prevents hydration warnings from Mantine's color-scheme attributes — always include it.
- Since the app is Hebrew-only for MVP, hard-code `lang="he"`/`dir="rtl"`. Only wire up `useDirection()` toggling if bilingual support is actually planned.
- Mantine 7+ ships RTL-aware styles via CSS Modules/variables out of the box — no `stylis-plugin-rtl` needed. If `package.json` shows a pre-7 Mantine, that changes (Emotion + `stylis-plugin-rtl` was the old approach) — check before assuming.

**[MUST]** Put `MantineProvider`/`DirectionProvider` in the root layout only, once. **[MUST NOT]** re-import `@mantine/core/styles.css` or re-wrap `MantineProvider` in a nested layout.

## 5. Redux Toolkit in the App Router

**[MUST] The `<Provider>` must live inside a Client Component boundary** — never directly in the root `app/layout.tsx` (a Server Component). Standard pattern:

```tsx
// app/StoreProvider.tsx
"use client";
import { Provider } from "react-redux";
import { store } from "@/lib/store";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}
```

Wrap it once, inside `MantineProvider`/`DirectionProvider`, in `app/layout.tsx`. A module-level store singleton is fine for this client-only store — don't recreate it per render.

**[RECOMMENDED] state split** (check for an existing slice/apiSlice before adding a new one — see repo-check rule above):

| State | Where | Why |
|---|---|---|
| Session/auth, UI-wide prefs (selected supported body, sidebar state) | Plain RTK slice | Global, client-only, no cache/invalidation semantics needed |
| Contacts/registrations/domains — anything from the DB | **Not** a plain Redux slice. Server Components for initial render; RTK Query for client-side search/filter/polling | RTK Query gives cache invalidation, dedupe, loading/error state for free |
| Per-form field state | React Hook Form's own state | Mirroring RHF fields into Redux is an anti-pattern |

When introducing RTK Query, seed its cache from the server-fetched initial data (`upsertQueryData`/`initialState`) rather than re-fetching on mount — avoid a client-server double fetch.

**[MUST NOT]** duplicate server data into a plain Redux slice "just in case."

## 6. React Hook Form + Joi

This project uses **Joi** (`@hookform/resolvers/joi`), not Zod, despite most current tutorials defaulting to Zod. Schema/DTO structure and client/server schema-sharing conventions live in `expertise-nodejs-typescript` — this section is only the React-side wiring.

```tsx
import { useForm, Controller } from "react-hook-form";
import { joiResolver } from "@hookform/resolvers/joi";
import { TextInput, Select } from "@mantine/core";

const { control, register, handleSubmit, formState: { errors } } = useForm({
  resolver: joiResolver(schema, { abortEarly: false }), // surface all field errors at once
});

// Simple text-like inputs: register() works — Mantine forwards a ref and
// fires a native-shaped onChange (event.target.value) that matches register()'s contract.
<TextInput {...register("fullName")} error={errors.fullName?.message} />

// Controlled-only components: onChange fires the raw value, not an event —
// register() can't wire these, use Controller.
<Controller
  name="domainId"
  control={control}
  render={({ field }) => <Select {...field} data={domainOptions} />}
/>
```

- **[MUST]** Use `Controller` for Mantine components whose `onChange` returns a raw value instead of an event object — `Select`, `MultiSelect`, `Autocomplete`, `Combobox`-based inputs, `DatePickerInput`, `Slider`. Plain `register()` can't wire these up.
- **[RECOMMENDED]** For simple text-like inputs (`TextInput`, `Textarea`, `PasswordInput`, `NumberInput`, `Checkbox`) `register()` works fine — Mantine forwards a ref and fires a native-shaped `onChange` for these. Don't reach for `Controller` by default for every Mantine component; use it where the component's API actually requires it.
- **[RECOMMENDED]** Pass `{ abortEarly: false }` so multi-field forms (e.g. registration) show every invalid field at once, not one per resubmit.
- `Joi.string().email({ tlds: false })` avoids false negatives on real addresses from Joi's TLD allowlist.
- When a form posts to a Server Action via `useActionState`: RHF owns client-side validation/UX; the action's return value carries server-only validation failures (e.g. a uniqueness check) back into form error state. These are two separate passes — don't conflate them.

## 7. Routing conventions for this app

Target layout for the first implementation (see the greenfield note above — check the repo for what already exists before assuming a path is still accurate):

```
apps/internal/app/
  (internal)/                # route group: authenticated coordinator area
    layout.tsx                # Server Component: session check, Mantine AppShell
    contacts/
      page.tsx                # list — Server Component, Prisma fetch
      loading.tsx              # Suspense fallback while page.tsx streams
      error.tsx                 # MUST be "use client" (error boundaries are client-only)
      [id]/edit/page.tsx       # hosts <ContactEditForm> (client component, calls RTK Query — see §2)
    registrations/page.tsx     # queue — Server Component list + client filter toolbar
    domains/page.tsx
  (public)/                   # route group: unauthenticated, no coordinator nav
    register/page.tsx         # public self-registration (client form, calls RTK Query — see §2)
  layout.tsx                  # root: html/body, MantineProvider, DirectionProvider, StoreProvider
  api/                        # Route Handlers — the actual mutation surface, see expertise-api-rest
    contacts/[id]/route.ts
    registration-requests/[id]/approve/route.ts
    ...
```

- **Route groups** `(internal)`/`(public)` don't affect the URL; they give each area its own `layout.tsx` (auth-gated shell vs bare shell). Use them exactly for that split.
- **`loading.tsx`**: add to any Server Component page doing a real DB fetch — it wraps the segment in `Suspense` automatically.
- **`error.tsx` must be `"use client"`** — the one file where that's non-optional.
- No routine `actions.ts` per route — per §2, mutations are Route Handlers under `app/api/`, not colocated Server Actions. Only the narrow-exception Server Action from §2, if one is ever genuinely needed, would live in a local `actions.ts`.
- `(public)/register` is intentionally isolated as its own route group so it can be extracted into a separate app later with minimal rework.

## 8. Code quality for React/Next.js

Domain-specific additions only — see `expertise-code-quality` for the universal baseline (simplicity, naming, DRY, single responsibility) this builds on.

- **Avoid god components.** A screen that mixes data-fetching, layout, and business logic in one file is a real risk in this app — the contacts table + filters + drawer is exactly the shape that grows unmanageable. Split by concern: a Server Component fetches and shapes data, a presentational component renders it, and a client "island" (filter toolbar, drawer, form) owns only its own interaction state. If a page component's JSX scrolls past a screen and mixes fetch logic with markup, that's the signal to split it.
- **Pick state placement deliberately, don't default to Redux.** This project has Redux Toolkit available, which makes it tempting to reach for it too often. Use this order: local `useState` for state one component (and its direct children) owns and nothing else reads (a drawer's open/closed flag, a filter draft before submit); lift to the nearest common parent when two sibling components need to share it; reach for Redux only when state is genuinely global/cross-route (session, selected supported body) or needs cache semantics (RTK Query, per section 5) — not as a default home for "state that a few components use."
- **Accessibility is a first-class requirement here, not a nice-to-have** — this app has an explicit Accessibility Floor from its UX spec. Every interactive element needs a real `<label>`/`aria-label` association, native semantic elements (`<button>`, `<table>`, `<nav>`) over `<div onClick>`, and full keyboard operability (tab order, focus visible, `Escape` closes a drawer/modal) — verify this when building or reviewing any form, table, or drawer, not just at a final audit pass.
- **Don't memoize preemptively.** Adding `useMemo`/`useCallback` without a measured re-render problem adds complexity for no proven benefit. Reach for them only after profiling shows an actual jank/re-render cost (e.g. a large contacts table re-rendering on every keystroke) — not as a default wrapper around every callback or derived value.

## 9. Testing

Full Jest/RTL setup, the async-Server-Component testing gap, and stack-specific test patterns are owned by `expertise-testing` — read that skill before writing tests. The one fact that shapes how you *write* components here: Jest cannot render `async` Server Components, so keep them thin (fetch + shape data, delegate JSX to sync/client children) — that's what keeps them testable at all.

## Pre-completion checklist

Before considering a React/Next.js change done, check:

- [ ] New/changed files default to Server Components; `"use client"` only where required, on the smallest leaf
- [ ] No data fetching in `useEffect`; no Redux or RHF hooks inside a Server Component
- [ ] Any new mutation is a Route Handler called via RTK Query — not a new Server Action (unless it's the genuine §2 narrow exception)
- [ ] Mutation cache-busting happens through RTK Query tag invalidation, not a reflexive `revalidatePath`/`revalidateTag`; no code assumes a `fetch()` is cached by default without checking the installed Next.js major
- [ ] Controlled-only Mantine inputs (`Select`/`MultiSelect`/`Combobox`-based/`DatePickerInput`/`Slider`) use `Controller`; simple text-like inputs may use `register()`
- [ ] No new `MantineProvider`/`DirectionProvider`/`StoreProvider` wrapping introduced outside the root layout
- [ ] No new plain Redux slice holding server/DB data
- [ ] RTL preserved: no hardcoded LTR assumptions (e.g. manually flipped margins/icons instead of letting Mantine/`DirectionProvider` handle it)
- [ ] Existing patterns in the repo were checked before introducing a new one
- [ ] No component mixes data-fetching + layout + business logic in one file (god component)
- [ ] New shared state actually needs to be Redux, not local `useState` or a lifted prop
- [ ] Interactive elements have proper labels/semantic HTML and are keyboard-operable
- [ ] Any `useMemo`/`useCallback` addresses a measured re-render problem, not added preemptively
