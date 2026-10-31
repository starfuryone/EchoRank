import "server-only";
/**
 * Wires src/lib/queue-alerts.ts to the real queues, Redis and mail relay, and
 * runs it on an interval inside the workers process (start-workers.ts).
 *
 * In the workers process because that is the process that is up whenever jobs
 * can fail at all. If the workers process itself is down, nothing fails and
 * nothing is alerted; pm2 and the deploy health check cover that case.
 */
import { getQueue } from "@/infrastructure/queue/registry";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { QUEUE_NAMES } from "@/infrastructure/redis/config";
import { logger } from "@/infrastructure/observability/logger";
import { SUPPORT_EMAIL } from "@/lib/assistant/config";
import { sendMail } from "@/lib/mailer";
import {
  QUEUE_ALERT_INTERVAL_MS,
  runQueueFailureAlert,
  type QueueAlertDeps,
  type StreamEntry,
} from "@/lib/queue-alerts";

export function alertRedis(): QueueAlertDeps["redis"] {
  const redis = getRedisConnection();
  return {
    get: (key) => redis.get(key),
    set: async (key, value, ttlSeconds) => {
      if (ttlSeconds) await redis.set(key, value, "EX", ttlSeconds);
      else await redis.set(key, value);
    },
    exists: async (key) => (await redis.exists(key)) === 1,
  };
}

export function realQueueAlertDeps(now = new Date()): QueueAlertDeps {
  return {
    queues: QUEUE_NAMES,
    readEvents: async (name, fromExclusive) => {
      // The registry builds every Queue on this same connection; BullMQ's own
      // client type does not expose XRANGE.
      const queue = getQueue(name as (typeof QUEUE_NAMES)[number]);
      const raw = await getRedisConnection().xrange(queue.keys.events, `(${fromExclusive}`, "+", "COUNT", 5000);
      return raw.map(([id, flat]): StreamEntry => {
        const fields: Record<string, string> = {};
        for (let i = 0; i + 1 < flat.length; i += 2) fields[flat[i]] = flat[i + 1];
        return { id, fields };
      });
    },
    redis: alertRedis(),
    send: (subject, text, html) => sendMail({ to: [SUPPORT_EMAIL], subject, text, html }),
    now,
  };
}

/** Run once a minute after boot, then every QUEUE_ALERT_INTERVAL_MS. Returns a stop function. */
export function startQueueFailureAlert(): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const r = await runQueueFailureAlert(realQueueAlertDeps());
      if (r.failures) {
        logger.warn(
          { failures: r.failures, groups: r.groups.length, suppressed: r.suppressed, sent: r.sent, to: SUPPORT_EMAIL },
          r.sent ? "queue failure alert sent" : "queue failures found; alert not sent",
        );
      }
    } catch (err) {
      logger.error({ err }, "queue failure alert check failed");
    } finally {
      running = false;
    }
  };
  const first = setTimeout(tick, 60_000);
  const timer = setInterval(tick, QUEUE_ALERT_INTERVAL_MS);
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
