import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Base pino logger instance.
 * In development: pretty-printed output.
 * In production: structured JSON for log aggregation.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: {
    service: "echorank",
    env: process.env.NODE_ENV || "development",
  },
  redact: {
    paths: [
      "password",
      "passwordHash",
      "token",
      "authorization",
      "cookie",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[REDACTED]",
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }),
});

export interface LoggerContext {
  tenantId?: string;
  userId?: string;
  correlationId?: string;
  operation?: string;
  [key: string]: unknown;
}

/**
 * Creates a child logger with the given context bindings.
 * Child loggers inherit the parent's configuration and add
 * the provided fields to every log entry.
 */
export function createLogger(context: LoggerContext): pino.Logger {
  return logger.child(context);
}

export type Logger = pino.Logger;
