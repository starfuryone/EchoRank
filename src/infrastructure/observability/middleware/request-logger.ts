import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "../logger";
import { getCurrentCorrelationId } from "../tracing";

/**
 * Fields that should never appear in logs.
 */
const SENSITIVE_FIELDS = new Set([
  "password",
  "passwordHash",
  "token",
  "authorization",
  "cookie",
  "secret",
  "creditCard",
  "ssn",
  "accessToken",
  "refreshToken",
]);

/**
 * Recursively masks sensitive fields in an object for logging.
 */
function maskSensitive(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.has(key) || SENSITIVE_FIELDS.has(key.toLowerCase())) {
      masked[key] = "[REDACTED]";
    } else if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      masked[key] = maskSensitive(value as Record<string, unknown>);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

/**
 * Higher-order function that wraps a Next.js API route handler with
 * structured request/response logging.
 *
 * Logs:
 *  - method, path, query params
 *  - response status code
 *  - request duration in milliseconds
 *  - tenantId and correlationId (when available)
 *
 * Sensitive header values are automatically masked.
 */
export function withRequestLogger(
  handler: (
    request: NextRequest,
    context?: unknown
  ) => Promise<NextResponse | Response>
) {
  return async (
    request: NextRequest,
    context?: unknown
  ): Promise<NextResponse | Response> => {
    const start = performance.now();
    const method = request.method;
    const path = request.nextUrl.pathname;
    const query = Object.fromEntries(request.nextUrl.searchParams);

    const correlationId =
      getCurrentCorrelationId() ??
      request.headers.get("X-Correlation-ID") ??
      undefined;
    const tenantId =
      request.headers.get("X-Tenant-ID") ?? undefined;

    const log = createLogger({
      correlationId,
      tenantId,
      operation: `${method} ${path}`,
    });

    // Extract safe headers for logging
    const safeHeaders: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
        safeHeaders[key] = "[REDACTED]";
      } else {
        safeHeaders[key] = value;
      }
    });

    log.info(
      {
        event: "request.start",
        method,
        path,
        query: Object.keys(query).length > 0 ? maskSensitive(query) : undefined,
      },
      `Incoming ${method} ${path}`
    );

    let response: NextResponse | Response;
    try {
      response = await handler(request, context);
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      log.error(
        {
          event: "request.error",
          method,
          path,
          durationMs,
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack }
              : String(error),
        },
        `Request failed: ${method} ${path}`
      );
      throw error;
    }

    const durationMs = Math.round(performance.now() - start);
    const status = response.status;

    const logData = {
      event: "request.complete",
      method,
      path,
      status,
      durationMs,
    };

    if (status >= 500) {
      log.error(logData, `${method} ${path} ${status} (${durationMs}ms)`);
    } else if (status >= 400) {
      log.warn(logData, `${method} ${path} ${status} (${durationMs}ms)`);
    } else {
      log.info(logData, `${method} ${path} ${status} (${durationMs}ms)`);
    }

    return response;
  };
}
