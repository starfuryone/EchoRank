import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from "@opentelemetry/semantic-conventions";
import {
  trace,
  SpanStatusCode,
  type Span,
  type Attributes,
} from "@opentelemetry/api";

const SERVICE_NAME = "echorank";
const SERVICE_VERSION = process.env.npm_package_version || "0.1.0";
const DEPLOYMENT_ENV = process.env.NODE_ENV || "development";

/**
 * OpenTelemetry NodeSDK instance.
 * Configures OTLP HTTP exporter, resource attributes, and HTTP instrumentation.
 */
const sdk = new NodeSDK({
  resourceDetectors: [],
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: DEPLOYMENT_ENV,
  }),
  traceExporter: new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      "http://localhost:4318/v1/traces",
  }),
  instrumentations: [new HttpInstrumentation()],
});

/**
 * Initialize the SDK. Call once at application startup.
 * Safe to call multiple times; subsequent calls are no-ops.
 */
let initialized = false;

export function initTelemetry(): void {
  if (initialized) return;
  try {
    sdk.start();
    initialized = true;
  } catch {
    // SDK already started or unavailable -- swallow gracefully
  }
}

const tracer = trace.getTracer(SERVICE_NAME, SERVICE_VERSION);

/**
 * Creates and starts a new span. Caller is responsible for ending it.
 */
export function startSpan(name: string, attributes?: Attributes): Span {
  const span = tracer.startSpan(name);
  if (attributes) {
    span.setAttributes(attributes);
  }
  return span;
}

/**
 * Wraps an async function in a span. The span is automatically ended
 * when the function resolves or rejects, and errors are recorded.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Attributes
): Promise<T> {
  const span = tracer.startSpan(name);
  if (attributes) {
    span.setAttributes(attributes);
  }
  try {
    const result = await fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    recordSpanError(error, span);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Sets attributes on the currently active span.
 * No-op if there is no active span.
 */
export function setSpanAttributes(attributes: Attributes): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

/**
 * Records an error on a span. Uses the active span if none is provided.
 */
export function recordSpanError(error: unknown, span?: Span): void {
  const target = span ?? trace.getActiveSpan();
  if (!target) return;
  const err = error instanceof Error ? error : new Error(String(error));
  target.recordException(err);
  target.setStatus({
    code: SpanStatusCode.ERROR,
    message: err.message,
  });
}

export { sdk as telemetrySdk };
