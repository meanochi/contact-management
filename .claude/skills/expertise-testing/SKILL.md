---
name: expertise-testing
description: 'Jest/React Testing Library conventions for apps/web (Next.js, Mantine, Redux Toolkit), and @nestjs/testing conventions for apps/api (NestJS, Prisma, Joi), TDD workflow, and coverage priorities. Use when writing or changing any *.test.ts(x) file, Jest config, or deciding what/how to test a new feature or bug fix, in either app. Not for E2E/Playwright test design, general component/API/schema conventions (see expertise-react-nextjs, expertise-api-rest, expertise-postgres-prisma), or non-test TypeScript conventions (see expertise-nodejs-typescript).'
---

# Testing: Jest (+ React Testing Library in `apps/web`, `@nestjs/testing` in `apps/api`)

> Package/version specifics (Jest, Next.js, NestJS, RTL, Mantine APIs) drift fast. Check the installed versions in `package.json`/`node_modules` and each tool's current docs before treating a version claim here as permanent fact. The conventions and decision rules below are the stable part.

> Universal engineering principles (simplicity, naming, comments explain why, DRY as a judgment call, error handling) live in `expertise-code-quality` and apply here too — this file only adds what's specific to writing tests.

## Before writing any test

- **Check existing `*.test.ts(x)` files near the code you're touching first.** Match their structure, naming, mocking style, and helpers. Only introduce a new pattern (a new `test-utils` helper, a new mocking approach) when nothing comparable already exists — don't invent a second way to do something already solved in this repo.
- **TDD (red → green → refactor) is this project's required workflow** for new features and bug fixes (worked example in §6) — this isn't a testing-skill preference, it's this project's defined dev-agent discipline (Amelia: "test-first, red/green/refactor, 100% pass before review," per `_bmad/config.toml`). Write the failing test before the implementation, not after.

## Mandatory rules (non-negotiable for this project)

These are project decisions, not style preferences — deviating from them is a bug, not a judgment call:

- **Jest + React Testing Library only.** Don't introduce Vitest or any other runner, even though it's a common Jest alternative elsewhere — this project has already chosen Jest.
- **TDD discipline**: failing test first, then the minimal implementation, then refactor. Don't write several tests and then several implementations in one pass "because it's faster" — that's deferred testing, not TDD.
- **Always render via the shared wrapper**, never `render` straight from `@testing-library/react`, in any test that renders a Mantine component (most component tests in this app). Nothing has needed it yet on this greenfield project — the first time a test does, create `@/test-utils/render` (check it doesn't already exist first) and every later test reuses it unchanged (see §2).
- **Never try to `render()` an `async` Server Component in Jest.** Unsupported combination, not a config mistake — see §4.
- **Co-locate `*.test.ts(x)` next to the file it tests.** Only `test-utils/`, `__mocks__/`, and true cross-module integration tests get a dedicated folder (§7).
- **Don't re-derive Prisma mocking/integration-DB setup here** — follow `expertise-postgres-prisma`'s testing guidance (mock Prisma for unit tests, real Postgres for integration tests covering the audit/domain-scope extensions).

## 1. Jest configuration for this monorepo

Two configuration shapes:

**A. Inside the Next.js app workspace** — use `next/jest` (Next's officially supported integration). It auto-configures the SWC transform, CSS/image/`next/font` mocking, `.env` loading, and `node_modules`/`.next` exclusion — don't hand-roll any of that.

```ts
// apps/web/jest.config.ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
}

export default createJestConfig(config)
```

**B. Shared non-Next packages** (e.g. `packages/db`, `packages/shared-schemas`) — `next/jest` doesn't apply; use a plain `ts-jest`/`@swc/jest` config with `testEnvironment: 'node'`.

**C. `apps/api` (NestJS)** — use `@nestjs/testing`'s `Test.createTestingModule(...)`, not `next/jest` (this app has nothing to do with Next.js). Controller/service unit tests build a minimal testing module and mock what the class under test depends on:

```ts
// apps/api/src/contacts/contacts.service.spec.ts
import { Test } from "@nestjs/testing";
import { ContactsService } from "./contacts.service";

describe("ContactsService", () => {
  let service: ContactsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ providers: [ContactsService] }).compile();
    service = module.get(ContactsService);
  });

  it("creates a contact", async () => {
    // mock packages/db's prisma client (see expertise-postgres-prisma's Prisma-mocking guidance) — same
    // mocking approach as any other Prisma-backed unit test, just invoked from a Nest testing module.
  });
});
```

For a full HTTP-level test of a controller (Pipes/Interceptors/Filters wired up), use `@nestjs/testing`'s `createNestApplication()` + `supertest` against the compiled module, rather than calling the controller class's methods directly — that's the only way to actually exercise the Pipe/Interceptor/Filter pipeline described in `expertise-api-rest`.

`jest.setup.ts` baseline:
```ts
import '@testing-library/jest-dom'
```
(Recent `@testing-library/jest-dom` majors import matchers directly, no `jest-dom/extend-expect` — confirm against the installed version.)

## 2. Mantine test setup

Every Mantine component needs a `MantineProvider` ancestor, plus jsdom API mocks Mantine relies on that jsdom doesn't implement. This is Mantine's own documented setup — skipping it fails tests on the first `render()`.

Add to `jest.setup.ts`:
```ts
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false, media: query, onchange: null,
    addListener: jest.fn(), removeListener: jest.fn(),
    addEventListener: jest.fn(), removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})
window.HTMLElement.prototype.scrollIntoView = () => {}
class ResizeObserver { observe() {} unobserve() {} disconnect() {} }
window.ResizeObserver = ResizeObserver
```

Shared render wrapper (the one the mandatory rule above requires). No component test exists yet on this greenfield project — create this file the first time one is needed (check it isn't already there before adding a duplicate), then treat it as the fixed shared pattern:
```tsx
// test-utils/render.tsx
import { render as rtlRender } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { theme } from '@/theme'

export function render(ui: React.ReactNode) {
  return rtlRender(<>{ui}</>, {
    wrapper: ({ children }) => <MantineProvider theme={theme} env="test">{children}</MantineProvider>,
  })
}
export * from '@testing-library/react'
```
Extend this same wrapper for Redux/routing context (§5) rather than creating separate ad hoc wrappers.

**Portals**: Mantine overlays (`Modal`, `Drawer`, `Popover`, `Combobox`) render into `document.body`, not the container `render()` returns. Query via `screen`, and (for `Select`/`Combobox`) open the control with `user.click` before asserting options are visible — they don't exist in the DOM until opened.

## 3. React Testing Library practice

- Query by role/label first: `getByRole('button', { name: /save/i })`, `getByLabelText(/email/i)`. Fall back to `getByTestId` only when no accessible query exists.
- Use `userEvent.setup()` per test — not the static `userEvent.click(...)` API, and not `fireEvent` for anything a real user would do.
- Assert on what the user perceives (visible text, `aria-*` state, focus, disabled state) — never on internal component state or by calling component methods directly.
- Prefer `findBy*`/`waitFor` over `setTimeout` for anything async (form submission, RTK Query loading state).
- Don't re-test the library's own behavior (e.g. that Mantine's `TextInput` renders a label) — test *your* usage of it.
- Mock `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`) for any client component that calls them. Wrap Redux-connected components in a real `<Provider store={testStore}>` with a purpose-built test store, rather than deep-mocking `useSelector`.

```tsx
import userEvent from '@testing-library/user-event'
import { render, screen } from '@/test-utils/render'

it('submits the form when required fields are filled', async () => {
  const user = userEvent.setup()
  render(<ContactForm onSubmit={onSubmit} />)
  await user.type(screen.getByLabelText(/full name/i), 'Rachel Cohen')
  await user.click(screen.getByRole('button', { name: /save/i }))
  expect(onSubmit).toHaveBeenCalled()
})
```

## 4. The Server Component testing gap — what to actually do

**Jest cannot render `async` Server Components.** Next.js's own docs say so explicitly, and this hasn't changed with newer Jest/RTL releases. Don't spend time trying to `render()` one — it's a known framework gap, not a mistake in your setup.

Three-tier strategy instead:

1. **Extract the logic, test it directly — no rendering.** Anything an async Server Component does before returning JSX (calling `apps/api` via `lib/api-client.ts`, shaping the response, computing derived fields) belongs in a plain exported function, unit-tested with ordinary Jest — mocking `lib/api-client.ts`'s fetch call, not Prisma (`apps/web` never touches Prisma at all, AD-1; the actual domain-scoping/permission logic this used to test lives in `apps/api`'s services now — see that app's own tests, `expertise-api-rest`):
   ```ts
   // app/(internal)/contacts/getContactsForList.ts
   export async function getContactsForList(searchParams: Record<string, string>) {
     const res = await apiFetch(`/contacts?${new URLSearchParams(searchParams)}`)
     return res.data
   }
   ```
   ```ts
   // getContactsForList.test.ts
   it('passes the search params through to apps/api', async () => {
     // mock apiFetch (lib/api-client.ts), assert the querystring is built correctly
   })
   ```
   This is the highest-leverage move on the `apps/web` side: it turns "untestable Server Component" into fully testable logic. The actual highest-risk logic — domain-scoping, permissions — now lives entirely in `apps/api` and is tested there with `@nestjs/testing` (§1C), not here.
2. **Synchronous Server/Client Components** (no top-level `await`) render fine with `render()` as in §3 — test those normally.
3. **Full Server Component rendering (data fetch + JSX together) is an E2E concern, not a Jest unit test.** Cover it with the project's E2E layer. Don't invest time mocking `React.cache`/`fetch` boundaries to force an async component through `render()`.

**Do:** push logic out of the `async` component body into testable functions. **Don't:** leave non-trivial conditional rendering inline in an async Server Component "because it's just JSX" — that's exactly the part Jest can't reach.

(For the Server-vs-Client-Component decision itself, see `expertise-react-nextjs` — this section covers only the testing consequence.)

## 5. Stack-specific test patterns

**Joi-validated forms** — test the schema and the form's error-rendering separately; they're different failure modes. Schema tests are pure and fast:
```ts
it('rejects an invalid email', () => {
  const { error } = contactSchema.validate({ name: 'Rachel Cohen', email: 'not-an-email', phone: '0500000000' })
  expect(error?.details[0].path).toEqual(['email'])
})
```
The component test only needs to prove the error path is wired up (one invalid case, one valid case, submit handler not called when invalid) — don't re-verify every Joi edge case at the component level; that's the schema test's job.

**Redux Toolkit** — test a plain slice reducer as a pure function, no store needed. For RTK Query endpoints, build a fresh store per test (`configureStore`); don't share one store across tests, cache state leaks between them. The first time a test needs this, create one shared `setupApiStore` (or `setupStore`) helper in `test-utils/` — check it doesn't already exist before adding a second one — rather than re-deriving store shape per file, and mock the network layer (MSW or a mocked `baseQuery`) rather than hitting a real API.

**Mantine components** — use the shared render wrapper (§2); remember the portal/combobox note above for `Select`/`Combobox`.

## 6. TDD workflow example: adding a Contact field

Example: adding an optional `secondaryPhone` field. Red-green-refactor, bottom-up (validation → data → UI), one layer fully green before starting the next:

1. **Red/Green — Joi schema**: failing test asserting `contactSchema` accepts a valid `secondaryPhone` / rejects a malformed one → add the field to the schema.
2. **Red/Green — Prisma/data layer**: failing test asserting the repository function's returned/persisted record includes `secondaryPhone` → add the migration + column + mapping (migration mechanics: `expertise-postgres-prisma`).
3. **Red/Green — form component**: failing RTL test asserting `ContactForm` shows the new input and surfaces the same validation message the schema encodes → wire up the input via `react-hook-form` + `@hookform/resolvers/joi`.
4. **Refactor**: with all three green, remove duplication (e.g. a phone-pattern regex defined twice), re-running all three test files after each change.

Each layer's test must fail for the right reason before its implementation exists — don't write all three tests up front and then all three implementations.

## 7. File organization

Co-locate `*.test.ts(x)` next to the source file it tests (matches this app's route-segment colocation convention and keeps "this file has no test" visible in the file tree):
```
app/contacts/ContactForm.tsx
app/contacts/ContactForm.test.tsx
lib/validation/contactSchema.ts
lib/validation/contactSchema.test.ts
```

Exceptions — dedicated folders:
- `test-utils/` — shared render wrappers, store helpers, fixtures.
- `__mocks__/` — Jest's manual-mock convention (e.g. `next/navigation`).
- `integration/` or `e2e/` — cross-module flows that don't belong to one source file (e.g. the full registration-approval flow across API route + Prisma + notification).

## 8. Coverage: what's worth testing here

Don't chase a global coverage percentage — it rewards testing trivial code and says nothing about the risk areas that actually matter. Prioritize by **consequence of being wrong**.

**High priority — test thoroughly, including edge cases:**
- **Permission / domain-scoping logic, in `apps/api`** (coordinator sees only their body's contacts, super-admin sees all, org-rep sees a restricted subset). The single highest-risk area in the app — a bug here leaks data across organizational boundaries. Test every role × boundary condition (empty scope, exactly one body, user with no assigned body), at the Guard/service level (§1C) — this logic doesn't exist in `apps/web` at all (AD-1).
- **Soft-delete logic** (no real `DELETE`, only status → inactive). Test that inactive contacts are excluded from default list queries but still retrievable where required, and that reactivation works.
- **Joi validation edge cases** for every user-facing form, especially the public registration form — empty strings vs. missing keys, boundary lengths, malformed email/phone, any field the public form exposes that the internal one doesn't.
- **Registration-request approval state machine**: every legal transition (pending→approved, pending→rejected) and every illegal one your code must block (double-approval, approving an already-rejected request).

**Medium priority — main path only:**
- `apps/api` controllers: one success case + one validation-failure case per endpoint is usually enough; don't re-test Joi edge cases already covered at the schema level.
- Redux slices/RTK Query: the transformations/cache behavior your code adds, not RTK's own internals.

**Low priority / skip:** trivial getters, pure prop pass-through components, framework glue that would only break if Next.js/React/Mantine itself broke. Don't use a snapshot test as a substitute for a real assertion.

If unsure whether something needs a test, ask: *if this were subtly wrong, would a real user, a real dataset, or an audit ever surface it — and would that be bad?* Permission and data-boundary bugs answer yes immediately; a getter almost never does.

## 9. Code quality for tests

A few things beyond `expertise-code-quality`'s universal principles are specific to how tests fail and get maintained over time:

- **A failing test's name and assertion should explain the failure without opening the implementation.** `it('rejects a contact with an invalid email')`, not `it('test 3')` or `it('works')` — the test name is often the only context anyone has when CI goes red.
- **Assert on observable behavior, not implementation details.** This is especially easy to get wrong with Redux/RTK Query: assert on the resulting state or rendered UI, not on the shape of a dispatched action object or exactly how many times a mock fired — those break on a harmless refactor even when the behavior is unchanged.
- **Keep tests independent.** Don't let tests share mutable fixtures or module-level state — a common Jest footgun that makes a test's outcome depend on execution order or what ran before it (§5's "fresh store per test" rule for RTK Query is one instance of this; apply the same independence to any shared fixture, not just the store).
- **One behavior per test — not one assertion per test.** Several assertions checking facets of the *same* behavior belong together (e.g. asserting both that a validation error appeared *and* that `onSubmit` wasn't called, for "rejects an invalid email," is one behavior, fine as one test). Split only when a test quietly asserts two or three *unrelated* behaviors, so a failure points unambiguously at what broke.

## Before marking a testing task done

- [ ] The failing test was written and confirmed to fail, for the right reason, before the implementation existed.
- [ ] If the change touches a high-priority risk area (§8), edge cases are covered — not just the happy path.
- [ ] Component tests render via the shared `test-utils` wrapper, not raw `@testing-library/react`.
- [ ] No attempt to `render()` an async Server Component — its logic is extracted into a tested function instead.
- [ ] The new test file is co-located correctly (or placed in `test-utils/`/`__mocks__/`/`integration/` if it genuinely belongs there).
- [ ] Existing test patterns in the same area were checked and followed rather than reinvented.
- [ ] The full test file(s) actually run and pass, with no stray `.only`/`.skip` left behind.
