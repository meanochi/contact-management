import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ARCHITECTURE-SPINE.md AD-12: apps/web reaches apps/api only over HTTP,
  // from a different origin — CORS must be enabled explicitly here, scoped
  // to apps/web's known origin(s), never "*".
  const webOrigin = process.env["WEB_APP_ORIGIN"] ?? "http://localhost:3000";
  app.enableCors({ origin: webOrigin, credentials: true });

  // One validation entry point, one response envelope (AD-8) — registered
  // globally so no controller can accidentally skip either.
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env["PORT"] ?? 3001;
  await app.listen(port);
}

void bootstrap();
