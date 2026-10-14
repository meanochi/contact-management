import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { pingDatabase } from "@contact-management/db";

export interface HealthReport {
  status: "ok";
  uptimeSeconds: number;
  checks?: Record<string, "up">;
}

// A hung database must fail the probe, not hang it — orchestrators treat a
// slow probe as a failed one anyway, but a bounded check gives a clear log line.
const DATABASE_CHECK_TIMEOUT_MS = 2_000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  // Liveness: the process is up and the event loop answers. Deliberately does
  // not touch dependencies — a database outage must not get the pod killed.
  live(): HealthReport {
    return { status: "ok", uptimeSeconds: Math.round(process.uptime()) };
  }

  // Readiness: the service can actually serve traffic, i.e. the database answers.
  async ready(): Promise<HealthReport> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        pingDatabase(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error(`database check timed out after ${DATABASE_CHECK_TIMEOUT_MS}ms`)),
            DATABASE_CHECK_TIMEOUT_MS,
          );
        }),
      ]);
    } catch (err) {
      this.logger.error(`Readiness check failed: database is down (${err instanceof Error ? err.message : String(err)})`);
      throw new ServiceUnavailableException({
        code: "SERVICE_UNAVAILABLE",
        message: "Service is not ready",
        details: { database: "down" },
      });
    } finally {
      clearTimeout(timer);
    }
    return { ...this.live(), checks: { database: "up" } };
  }
}
