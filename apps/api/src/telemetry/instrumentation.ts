// Must be the FIRST import of main.ts (after dotenv): OpenTelemetry patches
// `http`, `express` and `pg` by intercepting their `require`, so those modules
// must not have been loaded yet.
import { NodeSDK } from "@opentelemetry/sdk-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { BatchSpanProcessor, SimpleSpanProcessor, type SpanExporter } from "@opentelemetry/sdk-trace-base";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { NestInstrumentation } from "@opentelemetry/instrumentation-nestjs-core";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";

const DEFAULT_SERVICE_NAME = "contact-management-api";

// Health probes fire every few seconds; tracing them only buries real traffic.
const NOISY_PATH_PREFIX = "/health";

// With no collector configured we still want real trace/span ids (so every log
// line of one request can be correlated), but nothing to send them to. A
// no-op exporter keeps tracing active without any network traffic.
const discardingExporter: SpanExporter = {
  export: (_spans, done) => done({ code: 0 }),
  shutdown: () => Promise.resolve(),
};

// Standard OTLP env var: when set, traces and logs are exported to that
// collector (Jaeger, Grafana Tempo/Loki, an OTel Collector, …). When unset,
// telemetry stays in-process and logs go to stdout only.
const otlpEndpoint = process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];

const sdk =
  process.env["OTEL_SDK_DISABLED"] === "true"
    ? undefined
    : new NodeSDK({
        resource: resourceFromAttributes({
          [ATTR_SERVICE_NAME]: process.env["OTEL_SERVICE_NAME"] ?? DEFAULT_SERVICE_NAME,
          [ATTR_SERVICE_VERSION]: process.env["npm_package_version"] ?? "0.0.0",
          "deployment.environment.name": process.env["NODE_ENV"] ?? "development",
        }),
        spanProcessors: [
          otlpEndpoint ? new BatchSpanProcessor(new OTLPTraceExporter()) : new SimpleSpanProcessor(discardingExporter),
        ],
        // An explicit (possibly empty) list stops the SDK from defaulting to an
        // OTLP exporter pointed at localhost.
        logRecordProcessors: otlpEndpoint ? [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })] : [],
        // Metrics follow the same rule: exported to the collector only when one is
        // configured (an explicit empty list stops the localhost OTLP default).
        ...(otlpEndpoint ? {} : { metricReaders: [] }),
        instrumentations: [
          new HttpInstrumentation({
            ignoreIncomingRequestHook: (request) => request.url?.startsWith(NOISY_PATH_PREFIX) ?? false,
          }),
          new ExpressInstrumentation(),
          new NestInstrumentation(),
          new PgInstrumentation(),
        ],
      });

sdk?.start();

// Flushes buffered spans/logs; call once on application shutdown.
export async function shutdownTelemetry(): Promise<void> {
  await sdk?.shutdown();
}
