import { ArgumentsHost, BadRequestException, ConflictException, HttpException, Logger } from "@nestjs/common";
import { lastValueFrom, of } from "rxjs";
import Joi from "joi";
import { AllExceptionsFilter } from "./filters/all-exceptions.filter";
import { ResponseInterceptor } from "./interceptors/response.interceptor";
import { JoiValidationPipe } from "./pipes/joi-validation.pipe";

describe("JoiValidationPipe", () => {
  const schema = Joi.object({ name: Joi.string().required(), age: Joi.number().required() });
  const pipe = new JoiValidationPipe(schema);

  it("returns the validated value", () => {
    expect(pipe.transform({ name: "a", age: 3 })).toEqual({ name: "a", age: 3 });
  });

  it("strips unknown keys so they never reach the service", () => {
    expect(pipe.transform({ name: "a", age: 3, isAdmin: true })).toEqual({ name: "a", age: 3 });
  });

  it("throws a 400 VALIDATION_ERROR listing every failing field, not just the first", () => {
    let thrown: unknown;
    try {
      pipe.transform({});
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(BadRequestException);
    expect((thrown as BadRequestException).getResponse()).toMatchObject({
      code: "VALIDATION_ERROR",
      details: [{ field: "name" }, { field: "age" }],
    });
  });
});

describe("ResponseInterceptor", () => {
  const run = (payload: unknown) =>
    lastValueFrom(new ResponseInterceptor().intercept({} as never, { handle: () => of(payload) }));

  it("wraps bare data in { data }", async () => {
    expect(await run({ id: 1 })).toEqual({ data: { id: 1 } });
  });

  it("wraps arrays and primitives too", async () => {
    expect(await run([1, 2])).toEqual({ data: [1, 2] });
    expect(await run(null)).toEqual({ data: null });
  });

  it("passes through a result that already has data (and meta) without double-wrapping", async () => {
    const shaped = { data: [1], meta: { total: 1 } };
    expect(await run(shaped)).toBe(shaped);
  });
});

describe("AllExceptionsFilter", () => {
  const filter = new AllExceptionsFilter();

  const handle = (exception: unknown) => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as unknown as ArgumentsHost;
    filter.catch(exception, host);
    return { status, json };
  };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("renders an HttpException with its own status and error envelope", () => {
    const { status, json } = handle(new ConflictException({ code: "CONFLICT", message: "dup", details: { id: "x" } }));
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({ error: { code: "CONFLICT", message: "dup", details: { id: "x" } } });
  });

  it("omits details when there are none", () => {
    const { json } = handle(new ConflictException({ code: "CONFLICT", message: "dup" }));
    expect(json.mock.calls[0]![0].error).not.toHaveProperty("details");
  });

  it("falls back to INTERNAL_ERROR for an HttpException with a plain-string body", () => {
    const { status, json } = handle(new HttpException("boom", 418));
    expect(status).toHaveBeenCalledWith(418);
    expect(json).toHaveBeenCalledWith({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
  });

  it("returns a generic 500 and never leaks the raw error message or stack", () => {
    const { status, json } = handle(new Error("relation \"Contact\" does not exist at /srv/db.js:12"));
    expect(status).toHaveBeenCalledWith(500);
    const body = JSON.stringify(json.mock.calls[0]![0]);
    expect(body).not.toContain("relation");
    expect(body).not.toContain("db.js");
    expect(json.mock.calls[0]![0].error).toEqual({ code: "INTERNAL_ERROR", message: "Something went wrong" });
  });

  it("logs the real error server-side for 500s only", () => {
    const spy = jest.spyOn(Logger.prototype, "error");
    handle(new Error("secret"));
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockClear();
    handle(new ConflictException({ code: "CONFLICT", message: "dup" }));
    expect(spy).not.toHaveBeenCalled();
  });
});
