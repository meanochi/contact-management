import { INestApplication, Logger, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { ContactsController } from "./contacts.controller";
import { ContactsService } from "./contacts.service";
import { ResponseInterceptor } from "../common/interceptors/response.interceptor";
import { LoggingInterceptor } from "../common/interceptors/logging.interceptor";
import { AllExceptionsFilter } from "../common/filters/all-exceptions.filter";

jest.mock("@contact-management/db", () => jest.requireActual("../test-utils/db-mock").mockedDbModule());

// HTTP-level test: exercises the real Pipe → Interceptor → Filter pipeline
// (expertise-testing §1C) with the service mocked.
describe("ContactsController (HTTP)", () => {
  let app: INestApplication;
  const service = {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    addSupportedBody: jest.fn(),
    updateSupportedBodyDomains: jest.fn(),
    removeSupportedBody: jest.fn(),
    deactivate: jest.fn(),
    activate: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ContactsController],
      providers: [{ provide: ContactsService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => {
    jest.resetAllMocks();
    // Request/rejection logs are not under test here; keep the output readable.
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  it("GET /contacts returns { data, meta } and passes coerced query values to the service", async () => {
    service.list.mockResolvedValue({ items: [{ id: "c1" }], total: 1, page: 2, pageSize: 5 });

    const res = await request(app.getHttpServer()).get("/contacts?page=2&pageSize=5&includeInactive=true");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [{ id: "c1" }], meta: { total: 1, page: 2, pageSize: 5 } });
    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2, pageSize: 5, includeInactive: true }));
  });

  it("GET /contacts rejects an out-of-range pageSize with the 400 error envelope", async () => {
    const res = await request(app.getHttpServer()).get("/contacts?pageSize=1000");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(service.list).not.toHaveBeenCalled();
  });

  it("POST /contacts with an invalid body returns field-level details and never reaches the service", async () => {
    const res = await request(app.getHttpServer()).post("/contacts").send({ firstName: "רחל" });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(["lastName", "idNumber", "phone", "emails", "domainIds"]),
    );
    expect(service.create).not.toHaveBeenCalled();
  });

  it("PATCH /contacts/:id rejects an empty body", async () => {
    const res = await request(app.getHttpServer()).patch("/contacts/c1").send({});
    expect(res.status).toBe(400);
    expect(service.update).not.toHaveBeenCalled();
  });

  it("PATCH /contacts/:id strips non-editable fields before they reach the service", async () => {
    service.update.mockResolvedValue({ id: "c1" });

    const res = await request(app.getHttpServer()).patch("/contacts/c1").send({ smsOptIn: true, status: "INACTIVE" });

    expect(res.status).toBe(200);
    expect(service.update).toHaveBeenCalledWith("c1", { smsOptIn: true });
  });

  it("POST /contacts/:id/deactivate requires the documentation fields", async () => {
    const res = await request(app.getHttpServer()).post("/contacts/c1/deactivate").send({ source: "PHONE" });
    expect(res.status).toBe(400);
    expect(service.deactivate).not.toHaveBeenCalled();
  });

  it("POST /contacts/:id/deactivate forwards source and date and wraps the result in { data }", async () => {
    service.deactivate.mockResolvedValue({ id: "c1", status: "INACTIVE" });

    const res = await request(app.getHttpServer())
      .post("/contacts/c1/deactivate")
      .send({ source: "EMAIL", date: "2026-09-30" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ data: { id: "c1", status: "INACTIVE" } });
    expect(service.deactivate).toHaveBeenCalledWith("c1", "EMAIL", expect.anything());
  });

  it("maps a service NotFoundException to a 404 error envelope", async () => {
    service.activate.mockRejectedValue(new NotFoundException({ code: "NOT_FOUND", message: "איש קשר לא נמצא" }));

    const res = await request(app.getHttpServer()).post("/contacts/ghost/activate");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "איש קשר לא נמצא" } });
  });

  it("maps an unexpected service error to a generic 500 without leaking details", async () => {
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    service.activate.mockRejectedValue(new Error("connection string postgres://user:pw@host"));

    const res = await request(app.getHttpServer()).post("/contacts/c1/activate");

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("postgres://");
  });

  it("DELETE /contacts/:id/supported-bodies/:bodyId delegates to removeSupportedBody", async () => {
    service.removeSupportedBody.mockResolvedValue({ id: "c1" });
    const res = await request(app.getHttpServer()).delete("/contacts/c1/supported-bodies/b1");
    expect(res.status).toBe(200);
    expect(service.removeSupportedBody).toHaveBeenCalledWith("c1", "b1");
  });
});
