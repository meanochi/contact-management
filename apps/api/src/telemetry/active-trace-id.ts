import { isSpanContextValid, trace } from "@opentelemetry/api";

// The trace id of the request being handled, or undefined when there is none.
// Requests the HTTP instrumentation ignores (health probes) still carry a
// non-recording span whose id is all zeros — that is not worth showing.
export function activeTraceId(): string | undefined {
  const spanContext = trace.getActiveSpan()?.spanContext();
  return spanContext && isSpanContextValid(spanContext) ? spanContext.traceId : undefined;
}
