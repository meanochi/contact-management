import { Logger, ServiceUnavailableException } from "@nestjs/common";
import { pingDatabase } from "@contact-management/db";
import { HealthService } from "./health.service";

jest.mock("@contact-management/db", () => ({ pingDatabase: jest.fn() }));

const ping = pingDatabase as jest.MockedFunction<typeof pingDatabase>;

describe("HealthService", () => {
  let service: HealthService;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    service = new HealthService();
  });
  afterEach(() => jest.restoreAllMocks());

  it("reports liveness without touching the database", () => {
    expect(service.live()).toMatchObject({ status: "ok", uptimeSeconds: expect.any(Number) });
    expect(ping).not.toHaveBeenCalled();
  });

  it("reports ready, with the database check, when the database answers", async () => {
    ping.mockResolvedValue(undefined);
    await expect(service.ready()).resolves.toMatchObject({ status: "ok", checks: { database: "up" } });
  });

  it("answers 503 when the database is down, without leaking the driver error to the client", async () => {
    ping.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:5432"));

    const failure = await service.ready().catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(ServiceUnavailableException);
    expect((failure as ServiceUnavailableException).getResponse()).toEqual({
      code: "SERVICE_UNAVAILABLE",
      message: "Service is not ready",
      details: { database: "down" },
    });
  });

  it("answers 503 instead of hanging when the database never responds", async () => {
    jest.useFakeTimers();
    ping.mockReturnValue(new Promise(() => undefined));

    const outcome = service.ready().catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(2_000);

    await expect(outcome).resolves.toBeInstanceOf(ServiceUnavailableException);
    jest.useRealTimers();
  });
});
