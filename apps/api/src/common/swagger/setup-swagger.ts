import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export const SWAGGER_PATH = "docs";

// Interactive docs at /docs, raw OpenAPI document at /docs/json. Off in
// production unless explicitly enabled — the API surface is internal.
export function setupSwagger(app: INestApplication): void {
  const enabled = process.env["SWAGGER_ENABLED"] ?? (process.env["NODE_ENV"] === "production" ? "false" : "true");
  if (enabled !== "true") return;

  const config = new DocumentBuilder()
    .setTitle("Contact Management API")
    .setDescription("ניהול גופים נתמכים ואנשי קשר. Every success response is wrapped in { data, meta? }; every error in { error: { code, message, details? } }.")
    .setVersion("1.0.0")
    .addTag("Contacts")
    .addTag("Supported bodies")
    .addTag("Domains")
    .addTag("Health")
    .build();

  SwaggerModule.setup(SWAGGER_PATH, app, SwaggerModule.createDocument(app, config), {
    jsonDocumentUrl: `${SWAGGER_PATH}/json`,
  });
}
