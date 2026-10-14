import "dotenv/config";
// Must stay right after dotenv and before every other import: OpenTelemetry
// patches http/express/pg as they are first required.
import "./telemetry/instrumentation";
import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { setupSwagger, SWAGGER_PATH } from "./common/swagger/setup-swagger";
import { OtelLogger } from "./telemetry/otel-logger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: new OtelLogger() });

  // ARCHITECTURE-SPINE.md AD-12: apps/web reaches apps/api only over HTTP,
  // from a different origin — CORS must be enabled explicitly here, scoped
  // to apps/web's known origin(s), never "*".
  const webOrigin = process.env["WEB_APP_ORIGIN"] ?? "http://localhost:3000";
  app.enableCors({ origin: webOrigin, credentials: true });

  // One validation entry point, one response envelope (AD-8) — registered
  // globally so no controller can accidentally skip either. LoggingInterceptor
  // is listed first so it wraps everything else and times the whole request.
  app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  setupSwagger(app);

  // Lets AppLifecycle close the DB pool and flush telemetry on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  const port = process.env["PORT"] ?? 3001;
  await app.listen(port);
  new Logger("Bootstrap").log(`API listening on port ${port} (API docs at /${SWAGGER_PATH}, probes at /health/live and /health/ready)`);
}

bootstrap().catch((err: unknown) => {
  new Logger("Bootstrap").error("API failed to start", err instanceof Error ? err.stack : String(err));
  process.exitCode = 1;
});
