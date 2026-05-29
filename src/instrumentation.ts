// Next.js instrumentation hook — runs once at server startup, per runtime.
// Starts OpenTelemetry (Node runtime) and Sentry when configured. Everything
// is guarded on env vars so a build/run without DSN/OTel config is unaffected.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initTelemetry } = await import(
      "@/infrastructure/observability/telemetry"
    );
    initTelemetry();
  }

  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    });
  }
}

// Captures server/edge request errors into Sentry (Next calls this on errors).
export async function onRequestError(
  ...args: Parameters<
    typeof import("@sentry/nextjs").captureRequestError
  >
): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
