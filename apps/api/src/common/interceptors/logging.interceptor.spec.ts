import { ConflictException, ExecutionContext, Logger } from "@nestjs/common";
import { lastValueFrom, of, throwError } from "rxjs";
import { LoggingInterceptor } from "./logging.interceptor";

const httpContext = (req: object, res: object) =>
  ({
    getType: () => "http",
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  }) as unknown as ExecutionContext;

describe("LoggingInterceptor", () => {
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let debug: jest.SpyInstance;
  const interceptor = new LoggingInterceptor();
  const res = () => ({ statusCode: 200, setHeader: jest.fn() });

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    debug = jest.spyOn(Logger.prototype, "debug").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("logs entering and leaving a route, using the route pattern and the response status", async () => {
    const req = { method: "GET", path: "/contacts/42", route: { path: "/contacts/:id" } };
    await lastValueFrom(interceptor.intercept(httpContext(req, res()), { handle: () => of({}) }));

    expect(log).toHaveBeenNthCalledWith(1, "--> GET /contacts/:id");
    expect(log.mock.calls[1]![0]).toMatch(/^<-- GET \/contacts\/:id 200 \d+ms$/);
  });

  it("never logs the query string or body, which carry people's names and ID numbers", async () => {
    const req = {
      method: "GET",
      path: "/contacts",
      originalUrl: "/contacts?search=%D7%A8%D7%97%D7%9C",
      body: { idNumber: "000000018" },
      route: { path: "/contacts" },
    };
    await lastValueFrom(interceptor.intercept(httpContext(req, res()), { handle: () => of({}) }));

    expect(JSON.stringify(log.mock.calls)).not.toMatch(/search|000000018/);
  });

  it("logs the error status when the handler fails, and still propagates the error", async () => {
    const req = { method: "POST", path: "/supported-bodies", route: { path: "/supported-bodies" } };
    const failure = new ConflictException({ code: "CONFLICT", message: "dup" });

    await expect(
      lastValueFrom(interceptor.intercept(httpContext(req, res()), { handle: () => throwError(() => failure) })),
    ).rejects.toBe(failure);

    expect(log.mock.calls[1]![0]).toMatch(/^<-- POST \/supported-bodies 409 \d+ms$/);
    expect(warn).not.toHaveBeenCalled();
  });

  it("flags unexpected failures (5xx) at warn level", async () => {
    const req = { method: "GET", path: "/contacts", route: { path: "/contacts" } };
    await expect(
      lastValueFrom(
        interceptor.intercept(httpContext(req, res()), { handle: () => throwError(() => new Error("boom")) }),
      ),
    ).rejects.toThrow("boom");

    expect(warn.mock.calls[0]![0]).toMatch(/^<-- GET \/contacts 500 \d+ms$/);
  });

  it("keeps health probes out of the info logs", async () => {
    const req = { method: "GET", path: "/health/live", route: { path: "/health/live" } };
    await lastValueFrom(interceptor.intercept(httpContext(req, res()), { handle: () => of({}) }));

    expect(log).not.toHaveBeenCalled();
    expect(debug).toHaveBeenCalledTimes(2);
  });

  it("passes non-HTTP contexts through untouched", async () => {
    const context = { getType: () => "rpc" } as unknown as ExecutionContext;
    await expect(lastValueFrom(interceptor.intercept(context, { handle: () => of("x") }))).resolves.toBe("x");
    expect(log).not.toHaveBeenCalled();
  });
});
