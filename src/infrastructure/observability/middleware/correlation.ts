import { NextRequest, NextResponse } from "next/server";
import {
  generateCorrelationId,
  createTraceContext,
} from "../tracing";

const CORRELATION_HEADER = "X-Correlation-ID";

/**
 * Higher-order function that wraps a Next.js API route handler with
 * correlation ID propagation.
 *
 * - Extracts the correlation ID from the incoming `X-Correlation-ID` header,
 *   or generates a new one if absent.
 * - Runs the handler inside an async trace context so that downstream code
 *   can call `getCurrentCorrelationId()`.
 * - Attaches the correlation ID to the outgoing response headers.
 * - Optionally propagates the tenantId when available via a custom header.
 */
export function withCorrelation(
  handler: (
    request: NextRequest,
    context?: unknown
  ) => Promise<NextResponse | Response>
) {
  return async (
    request: NextRequest,
    context?: unknown
  ): Promise<NextResponse | Response> => {
    const incoming = request.headers.get(CORRELATION_HEADER);
    const correlationId = incoming || generateCorrelationId();

    // Attempt to extract tenantId from a custom header (set by auth middleware)
    const tenantId =
      request.headers.get("X-Tenant-ID") ?? undefined;
    const operation = `${request.method} ${request.nextUrl.pathname}`;

    const response = await createTraceContext(
      tenantId ?? "unknown",
      operation,
      () => handler(request, context),
      correlationId
    );

    // Ensure the correlation ID appears on the response
    if (response instanceof NextResponse) {
      response.headers.set(CORRELATION_HEADER, correlationId);
      if (tenantId) {
        response.headers.set("X-Tenant-ID", tenantId);
      }
    } else {
      // Standard Response -- must create a new one to add headers
      const headers = new Headers(response.headers);
      headers.set(CORRELATION_HEADER, correlationId);
      if (tenantId) {
        headers.set("X-Tenant-ID", tenantId);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return response;
  };
}
