// tests/queue-alerts.test.ts
//
// runQueueFailureAlert with in-memory Redis and a recording mailer. The
// real-Redis half (that BullMQ writes the `failed` event this reads, even for
// a job removed on failure) is in queue-alerts.redis.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FIRST_RUN_LOOKBACK_MS,
  REPEAT_AFTER_S,
  runQueueFailureAlert,
  type QueueAlertDeps,
  type StreamEntry,
} from "@/lib/queue-alerts";

vi.mock("server-only", () => ({}));

const NOW = new Date("2026-10-31T04:00:00Z");
const ms = (iso: string) => new Date(iso).getTime();
const failed = (iso: string, jobId: string, reason: string, seq = 0): StreamEntry => ({
  id: `${ms(iso)}-${seq}`,
  fields: { event: "failed", jobId, failedReason: reason, prev: "active" },
});
const other = (iso: string, event: string): StreamEntry => ({ id: `${ms(iso)}-9`, fields: { event, jobId: "x" } });

let store: Map<string, { value: string; ttl?: number }>;
let streams: Record<string, StreamEntry[]>;
let sent: Array<{ subject: string; text: string }>;
let deliver: boolean;

function deps(now = NOW): QueueAlertDeps {
  return {
    queues: Object.keys(streams),
    readEvents: async (q, from) => {
      const [fm, fs] = from.split("-").map(Number);
      return streams[q].filter((e) => {
        const [m, s] = e.id.split("-").map(Number);
        return m > fm || (m === fm && s > fs);
      });
    },
    redis: {
      get: async (k) => store.get(k)?.value ?? null,
      set: async (k, value, ttl) => void store.set(k, { value, ttl }),
      exists: async (k) => store.has(k),
    },
    send: async (subject, text) => {
      if (deliver) sent.push({ subject, text });
      return deliver;
    },
    now,
  };
}

beforeEach(() => {
  store = new Map();
  sent = [];
  deliver = true;
  streams = {
    "citation-aggregation": [
      other("2026-10-31T03:35:00Z", "added"),
      failed("2026-10-31T03:36:30Z", "repeat:acb8:1793417700000", "Custom Id cannot contain :"),
      other("2026-10-31T03:36:31Z", "retries-exhausted"),
    ],
    "revenue-rollup": [failed("2026-10-31T03:41:30Z", "repeat:ed29:1793418000000", "Custom Id cannot contain :")],
    "email-delivery": [other("2026-10-31T03:50:00Z", "completed")],
  };
});

describe("runQueueFailureAlert", () => {
  it("emails one message listing each queue's final failures", async () => {
    const r = await runQueueFailureAlert(deps());
    expect(r).toMatchObject({ failures: 2, suppressed: 0, sent: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe("[Echorank360] 2 failed jobs in 2 queues");
    expect(sent[0].text).toContain("citation-aggregation: 1× Custom Id cannot contain :");
    expect(sent[0].text).toContain("revenue-rollup: 1× Custom Id cannot contain :");
    expect(sent[0].text).toContain("repeat:acb8:1793417700000");
  });

  it("reports each failure once: the cursor moves past what was sent", async () => {
    await runQueueFailureAlert(deps());
    const again = await runQueueFailureAlert(deps(new Date(NOW.getTime() + 15 * 60_000)));
    expect(again.failures).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it("a failure that repeats is not re-sent within REPEAT_AFTER_S, but counts as suppressed", async () => {
    await runQueueFailureAlert(deps());
    streams["citation-aggregation"].push(failed("2026-11-01T03:36:30Z", "repeat:acb8:1793504100000", "Custom Id cannot contain :"));
    const r = await runQueueFailureAlert(deps(new Date("2026-10-31T05:00:00Z")));
    expect(r).toMatchObject({ failures: 1, suppressed: 1, sent: false });
    expect(sent).toHaveLength(1);
    const marker = [...store.entries()].find(([k]) => k.includes(":sent:citation-aggregation"));
    expect(marker?.[1].ttl).toBe(REPEAT_AFTER_S);
  });

  it("groups by reason with ids and numbers masked", async () => {
    streams["revenue-rollup"] = [
      failed("2026-10-31T03:41:00Z", "a", "tenant cmpu0slh30001di2x1j3v1vtu: timeout after 30000ms", 0),
      failed("2026-10-31T03:41:01Z", "b", "tenant cmq9zz00aa0002di2x1j3abcde: timeout after 31000ms", 0),
    ];
    const r = await runQueueFailureAlert(deps());
    const rev = r.groups.filter((g) => g.queue === "revenue-rollup");
    expect(rev).toHaveLength(1);
    expect(rev[0]).toMatchObject({ count: 2, jobIds: ["a", "b"] });
  });

  it("an undelivered alert leaves the cursors, so it is sent once mail works", async () => {
    deliver = false;
    expect((await runQueueFailureAlert(deps())).sent).toBe(false);
    deliver = true;
    const r = await runQueueFailureAlert(deps());
    expect(r).toMatchObject({ failures: 2, sent: true });
    expect(sent).toHaveLength(1);
  });

  it("the first run looks back FIRST_RUN_LOOKBACK_MS and no further", async () => {
    streams["revenue-rollup"].unshift(
      failed(new Date(NOW.getTime() - FIRST_RUN_LOOKBACK_MS - 60_000).toISOString(), "old", "ancient"),
    );
    const r = await runQueueFailureAlert(deps());
    expect(r.groups.map((g) => g.reason)).not.toContain("ancient");
  });

  it("records when it last ran and last sent", async () => {
    await runQueueFailureAlert(deps());
    expect(store.get("echorank:alerts:queue-failed:last-run")?.value).toBe(NOW.toISOString());
    expect(store.get("echorank:alerts:queue-failed:last-sent")?.value).toBe(NOW.toISOString());
  });
});
