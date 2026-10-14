import { ConsoleLogger, type LogLevel } from "@nestjs/common";
import { SeverityNumber, logs, type AnyValueMap } from "@opentelemetry/api-logs";
import { activeTraceId } from "./active-trace-id";

const LOGGER_NAME = "contact-management-api";

// Lowest to highest. LOG_LEVEL=warn keeps warn, error and fatal.
const LEVELS_BY_SEVERITY: LogLevel[] = ["verbose", "debug", "log", "warn", "error", "fatal"];

function enabledLevels(configured: string | undefined): LogLevel[] {
  const wanted = configured === "info" ? "log" : configured;
  const index = LEVELS_BY_SEVERITY.findIndex((level) => level === wanted);
  return LEVELS_BY_SEVERITY.slice(index === -1 ? LEVELS_BY_SEVERITY.indexOf("debug") : index);
}

const SEVERITY: Record<LogLevel, [SeverityNumber, string]> = {
  verbose: [SeverityNumber.TRACE, "TRACE"],
  debug: [SeverityNumber.DEBUG, "DEBUG"],
  log: [SeverityNumber.INFO, "INFO"],
  warn: [SeverityNumber.WARN, "WARN"],
  error: [SeverityNumber.ERROR, "ERROR"],
  fatal: [SeverityNumber.FATAL, "FATAL"],
};

// Nest's application logger, bridged to the OpenTelemetry Logs API: every
// `Logger` call anywhere in the app (framework internals included) still
// prints to stdout like before, and is also emitted as an OTel LogRecord,
// which the SDK ships to the OTLP collector when one is configured. A record
// emitted inside a request automatically carries that request's trace_id and
// span_id, so logs and traces can be joined in the backend.
export class OtelLogger extends ConsoleLogger {
  private readonly otelLogger = logs.getLogger(LOGGER_NAME);

  constructor() {
    super({ logLevels: enabledLevels(process.env["LOG_LEVEL"]), json: process.env["LOG_FORMAT"] === "json" });
  }

  override log(message: unknown, ...optionalParams: unknown[]): void {
    this.write("log", message, optionalParams);
  }
  override error(message: unknown, ...optionalParams: unknown[]): void {
    this.write("error", message, optionalParams);
  }
  override warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write("warn", message, optionalParams);
  }
  override debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write("debug", message, optionalParams);
  }
  override verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write("verbose", message, optionalParams);
  }
  override fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write("fatal", message, optionalParams);
  }

  private write(level: LogLevel, message: unknown, optionalParams: unknown[]): void {
    if (!this.isLevelEnabled(level)) return;

    const traceId = activeTraceId();
    // Appended so the correlation id is visible in plain stdout logs too.
    const printable = traceId && typeof message === "string" ? `${message} [trace_id=${traceId}]` : message;
    // Calls ConsoleLogger's own implementation of the same level.
    super[level](printable, ...optionalParams);

    // Nest's Logger class always appends the context name as the last string
    // argument; for errors the stack trace, if any, comes just before it.
    const strings = optionalParams.filter((param): param is string => typeof param === "string");
    const context = strings.length > 0 ? strings[strings.length - 1] : undefined;
    const stack = level === "error" && strings.length > 1 ? strings[0] : undefined;

    const [severityNumber, severityText] = SEVERITY[level];
    const attributes: AnyValueMap = {
      ...(context ? { "code.namespace": context } : {}),
      ...(stack ? { "exception.stacktrace": stack } : {}),
    };
    this.otelLogger.emit({
      severityNumber,
      severityText,
      body: typeof message === "string" ? message : safeStringify(message),
      attributes,
    });
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
