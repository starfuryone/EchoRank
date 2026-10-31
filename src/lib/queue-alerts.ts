import "server-only";
/**
 * Failed-job alert: email support@ when any queue's jobs fail for good.
 *
 * Written after the citation-aggregation and revenue-rollup sweeps failed every
 * night (BullMQ rejected their job ids) and nobody noticed for days: the only
 * trace was a log line. /api/admin/queues showed the counts but nothing looked.
 *
 * ── READS THE EVENTS STREAM, NOT THE FAILED SET ──────────────────────────────
 * Many jobs here are added with `removeOnFail: true` (every prompt batch, for
 * one), so the failed set is empty a millisecond after they fail and a count of
 * it would miss exactly the failures that are designed to be invisible. BullMQ
 * writes one `failed` event per FINAL failure to the queue's events stream
 * whatever the retention: retried attempts do not write it, a job deleted on
 * failure still does. The stream is capped (10 000 events per queue), far more
 * than one interval produces.
 *
 * ── STATE IN REDIS ───────────────────────────────────────────────────────────
 * A cursor per queue (the last stream id read) so each failure is reported
 * once, and a send marker per queue + reason with a TTL so a job failing every
 * fifteen minutes is one email per REPEAT_AFTER_S, not ninety-six a day. Both
 * survive a restart; nothing is in process memory (CLAUDE.md, Data and limits).
 * With no cursor yet (first run) it looks back FIRST_RUN_LOOKBACK_MS.
 *
 * A cursor only moves after the email went out (or there was nothing new to
 * send), so a relay outage delays the alert instead of losing it.
 */

/** How often start-workers.ts runs the check. */
export const QUEUE_ALERT_INTERVAL_MS = 15 * 60_000;
/** The same queue + reason is not emailed again within this. */
export const REPEAT_AFTER_S = 6 * 3600;
/** What the very first run covers, so a deploy reports the night before it. */
export const FIRST_RUN_LOOKBACK_MS = 24 * 3600_000;

const KEY = "echorank:alerts:queue-failed";

export interface StreamEntry {
  id: string;
  fields: Record<string, string>;
}

export interface QueueAlertDeps {
  queues: string[];
  /** XRANGE <queue events> (fromExclusive, +]. */
  readEvents(queue: string, fromExclusive: string): Promise<StreamEntry[]>;
  redis: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttlSeconds?: number): Promise<void>;
    exists(key: string): Promise<boolean>;
  };
  /** Returns false when mail is not configured (dev, no SMTP). */
  send(subject: string, text: string, html: string): Promise<boolean>;
  now: Date;
}

export interface FailureGroup {
  queue: string;
  reason: string;
  count: number;
  jobIds: string[];
  first: Date;
  last: Date;
}

export interface QueueAlertResult {
  failures: number;
  groups: FailureGroup[];
  /** Groups left out because the same queue + reason was emailed recently. */
  suppressed: number;
  sent: boolean;
}

const streamMs = (id: string) => Number(id.split("-")[0]);

function reasonKey(reason: string): string {
  // Ids and numbers vary per job; the alert is about the failure, not the row.
  return reason
    .slice(0, 200)
    .replace(/\b[a-z0-9]{20,}\b/gi, "<id>")
    .replace(/\d+/g, "<n>");
}

export function formatAlert(groups: FailureGroup[], suppressed: number): { subject: string; text: string; html: string } {
  const total = groups.reduce((n, g) => n + g.count, 0);
  const queues = new Set(groups.map((g) => g.queue)).size;
  const subject = `[Echorank360] ${total} failed job${total === 1 ? "" : "s"} in ${queues} queue${queues === 1 ? "" : "s"}`;
  const lines = groups.map(
    (g) =>
      `${g.queue}: ${g.count}× ${g.reason}\n  jobs: ${g.jobIds.slice(0, 5).join(", ")}${g.jobIds.length > 5 ? ", …" : ""}\n  between ${g.first.toISOString()} and ${g.last.toISOString()}`,
  );
  const footer = [
    suppressed ? `${suppressed} more group(s) already reported in the last ${REPEAT_AFTER_S / 3600} h.` : "",
    "Final failures only (retries exhausted). Counts per queue: GET /api/admin/queues.",
    "Workers log: pm2 logs echorank360-workers --lines 500",
  ].filter(Boolean);
  const text = [...lines, "", ...footer].join("\n");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<pre style="font:13px/1.45 ui-monospace,monospace">${esc(text)}</pre>`;
  return { subject, text, html };
}

/** One check. Reads every queue's new final failures, emails support@ once. */
export async function runQueueFailureAlert(deps: QueueAlertDeps): Promise<QueueAlertResult> {
  const fallbackCursor = `${deps.now.getTime() - FIRST_RUN_LOOKBACK_MS}-0`;
  const cursors = new Map<string, string>();
  const byKey = new Map<string, FailureGroup>();
  let failures = 0;

  for (const queue of deps.queues) {
    const from = (await deps.redis.get(`${KEY}:cursor:${queue}`)) ?? fallbackCursor;
    const entries = await deps.readEvents(queue, from);
    if (entries.length) cursors.set(queue, entries[entries.length - 1].id);
    for (const e of entries) {
      if (e.fields.event !== "failed") continue;
      failures++;
      const reason = e.fields.failedReason || "(no reason recorded)";
      const key = `${queue}\u0000${reasonKey(reason)}`;
      const at = new Date(streamMs(e.id));
      const g = byKey.get(key);
      if (g) {
        g.count++;
        g.jobIds.push(e.fields.jobId ?? "?");
        g.last = at;
      } else {
        byKey.set(key, { queue, reason: reason.slice(0, 300), count: 1, jobIds: [e.fields.jobId ?? "?"], first: at, last: at });
      }
    }
  }

  const fresh: Array<[string, FailureGroup]> = [];
  let suppressed = 0;
  for (const [key, g] of byKey) {
    if (await deps.redis.exists(`${KEY}:sent:${key}`)) suppressed++;
    else fresh.push([key, g]);
  }

  let sent = false;
  if (fresh.length) {
    const { subject, text, html } = formatAlert(fresh.map(([, g]) => g), suppressed);
    sent = await deps.send(subject, text, html);
    // Not delivered (no SMTP, dev guard): leave the cursors, so it is still
    // reported once mail works. A throw propagates for the same reason.
    if (!sent) return { failures, groups: fresh.map(([, g]) => g), suppressed, sent };
    for (const [key] of fresh) await deps.redis.set(`${KEY}:sent:${key}`, "1", REPEAT_AFTER_S);
  }
  for (const [queue, id] of cursors) await deps.redis.set(`${KEY}:cursor:${queue}`, id);
  await deps.redis.set(`${KEY}:last-run`, deps.now.toISOString());
  if (sent) await deps.redis.set(`${KEY}:last-sent`, deps.now.toISOString());

  return { failures, groups: fresh.map(([, g]) => g), suppressed, sent };
}

/** When the check last ran and last emailed, for /api/admin/queues. */
export async function queueAlertStatus(redis: QueueAlertDeps["redis"]): Promise<{ lastRunAt: string | null; lastSentAt: string | null }> {
  return { lastRunAt: await redis.get(`${KEY}:last-run`), lastSentAt: await redis.get(`${KEY}:last-sent`) };
}
