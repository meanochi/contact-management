import { Injectable, Logger, type OnApplicationShutdown } from "@nestjs/common";
import { closeDatabase } from "@contact-management/db";
import { shutdownTelemetry } from "./telemetry/instrumentation";

// Runs on SIGTERM/SIGINT after the HTTP server has stopped accepting requests:
// close the DB pool, then flush buffered spans and logs to the collector last
// so the shutdown itself is captured.
@Injectable()
export class AppLifecycle implements OnApplicationShutdown {
  private readonly logger = new Logger(AppLifecycle.name);

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Shutting down${signal ? ` on ${signal}` : ""}`);
    await closeDatabase();
    await shutdownTelemetry();
  }
}
