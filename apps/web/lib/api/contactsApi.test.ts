/**
 * @jest-environment node
 */
// node env (not jsdom): RTK Query's fetchBaseQuery needs the real Fetch API
// (Request/Response), which jsdom doesn't provide.
import { configureStore } from "@reduxjs/toolkit";
import { contactsApi } from "./contactsApi";

const contact = { id: "c1", status: "ACTIVE" };

const stores: { dispatch: (action: ReturnType<typeof contactsApi.util.resetApiState>) => unknown }[] = [];

// Fresh store per test — RTK Query cache state must not leak between tests
// (expertise-testing §5).
function setup(respond: (req: Request) => unknown = () => ({ data: contact })) {
  const calls: Request[] = [];
  global.fetch = jest.fn(async (input: Request | string | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(String(input), init);
    calls.push(req.clone());
    return new Response(JSON.stringify(respond(req)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const store = configureStore({
    reducer: { [contactsApi.reducerPath]: contactsApi.reducer },
    middleware: (getDefault) => getDefault().concat(contactsApi.middleware),
  });
  stores.push(store);
  return { store, calls };
}

describe("contactsApi", () => {
  // Drop RTK Query's keep-unused-data timers so Jest can exit cleanly.
  afterEach(() => {
    stores.splice(0).forEach((s) => s.dispatch(contactsApi.util.resetApiState()));
  });

  it("listContacts sends filters as a query string and flattens { data, meta } into a list result", async () => {
    const { store, calls } = setup(() => ({ data: [contact], meta: { total: 7, page: 2, pageSize: 5 } }));

    const result = await store.dispatch(
      contactsApi.endpoints.listContacts.initiate({ page: 2, pageSize: 5, search: "כהן", includeInactive: true }),
    );

    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe("/contacts");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("search")).toBe("כהן");
    expect(url.searchParams.get("includeInactive")).toBe("true");
    expect(result.data).toEqual({ items: [contact], total: 7, page: 2, pageSize: 5 });
  });

  it.each([
    ["deactivateContact", { id: "c1", input: { source: "PHONE", date: "2026-09-30" } }, "POST", "/contacts/c1/deactivate"],
    ["activateContact", { id: "c1" }, "POST", "/contacts/c1/activate"],
    ["updateContact", { id: "c1", input: { smsOptIn: true } }, "PATCH", "/contacts/c1"],
    ["removeSupportedBody", { id: "c1", supportedBodyId: "b1" }, "DELETE", "/contacts/c1/supported-bodies/b1"],
    [
      "updateSupportedBodyDomains",
      { id: "c1", supportedBodyId: "b1", domainIds: ["d1"] },
      "PATCH",
      "/contacts/c1/supported-bodies/b1",
    ],
    [
      "addSupportedBody",
      { id: "c1", supportedBodyId: "b2", domainIds: ["d1"] },
      "POST",
      "/contacts/c1/supported-bodies",
    ],
  ] as const)("%s hits %s %s and unwraps { data }", async (name, arg, method, path) => {
    const { store, calls } = setup();

    const result = await store.dispatch(
      (contactsApi.endpoints[name] as unknown as { initiate: (a: unknown) => never }).initiate(arg),
    );

    expect(calls[0]!.method).toBe(method);
    expect(new URL(calls[0]!.url).pathname).toBe(path);
    expect((result as { data: unknown }).data).toEqual(contact);
  });

  it("deactivateContact sends only the documentation payload as the body", async () => {
    const { store, calls } = setup();

    await store.dispatch(
      contactsApi.endpoints.deactivateContact.initiate({ id: "c1", input: { source: "EMAIL", date: "2026-09-30" } }),
    );

    expect(await calls[0]!.json()).toEqual({ source: "EMAIL", date: "2026-09-30" });
  });

  it("updateSupportedBodyDomains sends only domainIds in the body (ids belong in the URL)", async () => {
    const { store, calls } = setup();

    await store.dispatch(
      contactsApi.endpoints.updateSupportedBodyDomains.initiate({ id: "c1", supportedBodyId: "b1", domainIds: ["d1"] }),
    );

    expect(await calls[0]!.json()).toEqual({ domainIds: ["d1"] });
  });

  it("refetches the cached contacts list after a mutation invalidates the Contact tag", async () => {
    const { store, calls } = setup((req) =>
      req.method === "GET" ? { data: [contact], meta: { total: 1, page: 1, pageSize: 20 } } : { data: contact },
    );
    const subscription = store.dispatch(contactsApi.endpoints.listContacts.initiate({}));
    await subscription;
    expect(calls.filter((c) => c.method === "GET")).toHaveLength(1);

    await store.dispatch(contactsApi.endpoints.activateContact.initiate({ id: "c1" }));
    await new Promise((resolve) => setTimeout(resolve, 20)); // let the invalidation-triggered refetch run

    expect(calls.filter((c) => c.method === "GET")).toHaveLength(2);
    subscription.unsubscribe();
  });
});
