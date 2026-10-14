import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiResponse } from "@nestjs/swagger";
import { z, type ZodType } from "zod";

// @nestjs/swagger does not re-export its OpenAPI types from the package root,
// so the schema type is derived from the decorator that consumes it.
type SchemaObject = Exclude<Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>["schema"], { $ref: string }>;

// The OpenAPI docs are generated from the same Zod schemas that validate the
// requests (packages/shared-schemas), so documentation and validation cannot
// drift apart — there is no hand-maintained @ApiProperty DTO class to forget.

function toSchema(schema: ZodType, io: "input" | "output"): SchemaObject {
  // `any` for anything JSON Schema can't express (refinements are ignored, a
  // transform shows as an open schema) instead of throwing at startup.
  const jsonSchema = z.toJSONSchema(schema, {
    target: "openapi-3.0",
    io,
    unrepresentable: "any",
  }) as SchemaObject & { $schema?: string };
  delete jsonSchema.$schema; // not valid inside an OpenAPI document
  return jsonSchema;
}

export const ApiZodBody = (schema: ZodType) => ApiBody({ schema: toSchema(schema, "input") });

// Query parameters are flat, so an object schema is expanded into one
// @ApiQuery per field. Types come from the *output* schema (so
// `z.coerce.number()` documents as a number, not "anything"); which fields
// are required comes from the *input* schema (a defaulted field is optional
// to send).
export function ApiZodQuery(schema: ZodType) {
  const output = toSchema(schema, "output");
  const required = new Set(toSchema(schema, "input").required ?? []);
  const properties = Object.entries(output.properties ?? {}) as [string, SchemaObject][];
  return applyDecorators(
    ...properties.map(([name, property]) => ApiQuery({ name, required: required.has(name), schema: property })),
  );
}

// Every success response is wrapped by ResponseInterceptor as { data }.
export const ApiZodResponse = (status: number, schema: ZodType, description: string) =>
  ApiResponse({
    status,
    description,
    schema: { type: "object", required: ["data"], properties: { data: toSchema(schema, "output") } },
  });

// List endpoints return { data: [...], meta: { total, page, pageSize } }.
export const ApiZodListResponse = (itemSchema: ZodType, description: string) =>
  ApiResponse({
    status: 200,
    description,
    schema: {
      type: "object",
      required: ["data", "meta"],
      properties: {
        data: { type: "array", items: toSchema(itemSchema, "output") },
        meta: {
          type: "object",
          required: ["total", "page", "pageSize"],
          properties: {
            total: { type: "integer" },
            page: { type: "integer" },
            pageSize: { type: "integer" },
          },
        },
      },
    },
  });

const errorEnvelope: SchemaObject = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string", example: "VALIDATION_ERROR" },
        message: { type: "string" },
        details: {},
      },
    },
  },
};

// Documents the shared error envelope (AllExceptionsFilter) for the listed statuses.
export const ApiErrorResponses = (...statuses: number[]) =>
  applyDecorators(...statuses.map((status) => ApiResponse({ status, description: errorDescriptions[status] ?? "Error", schema: errorEnvelope })));

const errorDescriptions: Record<number, string> = {
  400: "Validation failed (VALIDATION_ERROR)",
  404: "Not found (NOT_FOUND)",
  409: "Conflict with the current state (CONFLICT)",
  500: "Unexpected server error (INTERNAL_ERROR)",
  503: "Dependency unavailable",
};
