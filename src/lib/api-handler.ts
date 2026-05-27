import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/infrastructure/observability/logger";
import { generateCorrelationId } from "@/infrastructure/observability/tracing";
import { auth } from "@/lib/auth";

// ─── Error Classes ───────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
  ) {
    super(message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ValidationError extends ApiError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

export class RateLimitError extends ApiError {
  constructor(message = "Too many requests") {
    super(message, 429, "RATE_LIMITED");
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface HandlerContext {
  correlationId: string;
}

interface HandlerOptions {
  requireAuth?: boolean;
  maxBodySize?: number;
}

type HandlerFn = (
  request: NextRequest,
  context: HandlerContext,
) => Promise<Record<string, unknown> | NextResponse>;

const MUTATING_METHODS = ["POST", "PUT", "PATCH"];
const DEFAULT_MAX_BODY_SIZE = 1_048_576; // 1MB

// ─── Handler Factory ─────────────────────────────────────────────────────────

export function createApiHandler(handler: HandlerFn, options: HandlerOptions = {}) {
  const { requireAuth = false, maxBodySize = DEFAULT_MAX_BODY_SIZE } = options;

  return async function wrappedHandler(request: NextRequest): Promise<NextResponse> {
    const correlationId = generateCorrelationId();
    const start = Date.now();
    const method = request.method;
    const path = request.nextUrl.pathname;
    let status = 200;
    let tenantId: string | undefined;

    try {
      // ── Content-Type enforcement for mutating requests ──────────────
      if (MUTATING_METHODS.includes(method)) {
        const contentType = request.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new ValidationError("Content-Type must be application/json");
        }
      }

      // ── Body size enforcement ───────────────────────────────────────
      const contentLength = request.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > maxBodySize) {
        throw new ValidationError(
          `Request body too large. Maximum size is ${maxBodySize} bytes`,
        );
      }

      // ── Auth check ─────────────────────────────────────────────────
      if (requireAuth) {
        const session = await auth();
        if (!session?.user) {
          throw new UnauthorizedError();
        }
      }

      // ── Execute handler ────────────────────────────────────────────
      const result = await handler(request, { correlationId });

      // If the handler returned a NextResponse directly, attach headers and return
      if (result instanceof NextResponse) {
        result.headers.set("X-Correlation-ID", correlationId);
        result.headers.set("X-Content-Type-Options", "nosniff");
        result.headers.set("X-Frame-Options", "DENY");
        status = result.status;
        return result;
      }

      // Otherwise, wrap in a JSON response
      status = 200;
      const response = NextResponse.json(result, { status });
      response.headers.set("X-Correlation-ID", correlationId);
      response.headers.set("X-Content-Type-Options", "nosniff");
      response.headers.set("X-Frame-Options", "DENY");
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        status = error.statusCode;
        const body: Record<string, unknown> = {
          error: error.message,
          correlationId,
        };
        if (error.code) {
          body.code = error.code;
        }

        const response = NextResponse.json(body, { status });
        response.headers.set("X-Correlation-ID", correlationId);
        response.headers.set("X-Content-Type-Options", "nosniff");
        response.headers.set("X-Frame-Options", "DENY");
        return response;
      }

      // Map the "Not authenticated or no tenant access" error from requireTenant()
      if (
        error instanceof Error &&
        error.message === "Not authenticated or no tenant access"
      ) {
        status = 401;
        const response = NextResponse.json(
          { error: "Unauthorized", code: "UNAUTHORIZED", correlationId },
          { status },
        );
        response.headers.set("X-Correlation-ID", correlationId);
        response.headers.set("X-Content-Type-Options", "nosniff");
        response.headers.set("X-Frame-Options", "DENY");
        return response;
      }

      // Unexpected error
      status = 500;
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      logger.error(
        { err: error, correlationId, method, path },
        "Unhandled API error",
      );

      const response = NextResponse.json(
        { error: "Internal server error", correlationId },
        { status },
      );
      response.headers.set("X-Correlation-ID", correlationId);
      response.headers.set("X-Content-Type-Options", "nosniff");
      response.headers.set("X-Frame-Options", "DENY");
      return response;
    } finally {
      const duration = Date.now() - start;
      logger.info(
        { method, path, status, duration, tenantId, correlationId },
        "API request completed",
      );
    }
  };
}
