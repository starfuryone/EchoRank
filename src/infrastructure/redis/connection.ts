import Redis from "ioredis";
import { REDIS_CONFIG } from "./config";

/**
 * Redis connection singleton manager.
 *
 * Provides separate connections for general use, BullMQ subscriber, and
 * BullMQ publisher to comply with BullMQ's requirement that the subscriber
 * connection must not be shared.
 */

let defaultConnection: Redis | null = null;
let subscriberConnection: Redis | null = null;

function getRedisUrl(): string {
  return process.env.REDIS_URL || REDIS_CONFIG.connection.defaultUrl;
}

function createConnection(name: string): Redis {
  const url = getRedisUrl();

  const conn = new Redis(url, {
    maxRetriesPerRequest: REDIS_CONFIG.connection.maxRetriesPerRequest,
    enableReadyCheck: REDIS_CONFIG.connection.enableReadyCheck,
    connectTimeout: REDIS_CONFIG.connection.connectTimeout,
    commandTimeout: REDIS_CONFIG.connection.commandTimeout,
    keepAlive: REDIS_CONFIG.connection.keepAlive,
    lazyConnect: REDIS_CONFIG.connection.lazyConnect,
    retryStrategy: REDIS_CONFIG.connection.retryStrategy,
    reconnectOnError: REDIS_CONFIG.connection.reconnectOnError,
    keyPrefix: REDIS_CONFIG.namespace,
    connectionName: `echorank:${name}`,
  });

  conn.on("connect", () => {
    console.log(`[Redis:${name}] Connected to ${url}`);
  });

  conn.on("error", (err) => {
    console.error(`[Redis:${name}] Connection error:`, err.message);
  });

  conn.on("close", () => {
    console.log(`[Redis:${name}] Connection closed`);
  });

  conn.on("reconnecting", () => {
    console.log(`[Redis:${name}] Reconnecting...`);
  });

  return conn;
}

/**
 * Returns the default (publisher) Redis connection. Creates it on first call.
 */
export function getRedisConnection(): Redis {
  if (!defaultConnection) {
    defaultConnection = createConnection("default");
  }
  return defaultConnection;
}

/**
 * Returns the subscriber Redis connection for BullMQ workers.
 * BullMQ requires a dedicated connection for its subscriber (blocking) usage.
 */
export function getSubscriberConnection(): Redis {
  if (!subscriberConnection) {
    subscriberConnection = createConnection("subscriber");
  }
  return subscriberConnection;
}

/**
 * Creates a new, independent Redis connection.
 * Use when you need a connection that is not shared (e.g., for a new Worker).
 */
export function createNewConnection(name: string): Redis {
  return createConnection(name);
}

/**
 * Returns BullMQ-compatible connection options.
 * BullMQ needs a `connection` field that is an ioredis instance.
 * Workers need a separate subscriber connection.
 */
export function getBullMQConnectionOptions(): { connection: Redis } {
  return { connection: getRedisConnection() };
}

/**
 * Returns BullMQ-compatible connection options for workers.
 * Workers use the subscriber (blocking) connection.
 */
export function getBullMQWorkerConnectionOptions(): { connection: Redis } {
  return { connection: getSubscriberConnection() };
}

/**
 * Health check: pings the Redis connection and returns latency info.
 */
export async function healthCheck(): Promise<{
  healthy: boolean;
  latencyMs: number;
  error?: string;
}> {
  const conn = getRedisConnection();
  const start = Date.now();
  try {
    await conn.connect().catch(() => {
      /* already connected */
    });
    const result = await conn.ping();
    const latencyMs = Date.now() - start;
    return {
      healthy: result === "PONG",
      latencyMs,
    };
  } catch (err) {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Gracefully shuts down all Redis connections.
 */
export async function shutdownRedis(): Promise<void> {
  const closing: Promise<void>[] = [];

  if (defaultConnection) {
    console.log("[Redis] Shutting down default connection...");
    closing.push(
      defaultConnection
        .quit()
        .then(() => {
          defaultConnection = null;
        })
        .catch((err) => {
          console.error("[Redis] Error closing default connection:", err.message);
          defaultConnection?.disconnect();
          defaultConnection = null;
        }),
    );
  }

  if (subscriberConnection) {
    console.log("[Redis] Shutting down subscriber connection...");
    closing.push(
      subscriberConnection
        .quit()
        .then(() => {
          subscriberConnection = null;
        })
        .catch((err) => {
          console.error("[Redis] Error closing subscriber connection:", err.message);
          subscriberConnection?.disconnect();
          subscriberConnection = null;
        }),
    );
  }

  await Promise.allSettled(closing);
  console.log("[Redis] All connections closed.");
}
