// src/lib/blog-agent/notify.ts
//
// Where the agent reports what it did.
//
// WHY THIS IS A SEAM AND NOT A MATRIX CLIENT. The brief specified posting to
// Matrix #echorank-briefing via "agentbot". Investigated 2026-08-21: no such
// bot exists in this repo. The only Matrix code is src/lib/matrix/provision.ts,
// which registers CUSTOMER accounts through the Synapse admin API — there is no
// room-send helper, no room id, no bot access token and no env var naming one,
// anywhere under /opt/echorank. Synapse itself is up on 127.0.0.1:8008.
//
// Rather than invent a room id and a token variable that nobody set, the agent
// notifies through a transport interface with a logging implementation. Adding
// the Matrix transport later is one function: POST to
// /_matrix/client/v3/rooms/{roomId}/send/m.room.message/{txnId} with a bearer
// token, wired in below where MATRIX_TRANSPORT_NOTE points. Nothing else in the
// pipeline changes, because nothing else knows how notifications are delivered.

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { logger } from "@/infrastructure/observability/logger";

export type NotifyLevel = "briefing" | "alert";

export interface Notification {
  level: NotifyLevel;
  title: string;
  /** Short lines, rendered one per line by any transport. */
  lines: string[];
}

export interface NotifyTransport {
  name: string;
  send(n: Notification): Promise<void>;
}

/**
 * The durable log.
 *
 * Deliberately OUTSIDE the repo, under /opt/echorank/backups/blog-agent/ —
 * the agent git-commits its own output, and a notification log inside the tree
 * would either land in those commits or need a gitignore rule that the next
 * person has to discover. One JSONL file per UTC day, appended.
 */
export const NOTIFY_LOG_DIR = "/opt/echorank/backups/blog-agent";

function logPath(now: Date): string {
  return `${NOTIFY_LOG_DIR}/notifications-${now.toISOString().slice(0, 10)}.jsonl`;
}

/**
 * Structured log plus a JSONL line.
 *
 * pino alone would be enough to see this in `pm2 logs echorank360-workers`, but
 * pm2 rotates and truncates, and "what did the agent draft last Tuesday" is a
 * question worth being able to answer. The file write is best-effort: a
 * notification that cannot be written must never fail the job that produced it,
 * because the work is already done and committed by then.
 */
export const loggingTransport: NotifyTransport = {
  name: "log",
  async send(n) {
    const record = { at: new Date().toISOString(), ...n };
    if (n.level === "alert") logger.error(record, `blog-agent: ${n.title}`);
    else logger.info(record, `blog-agent: ${n.title}`);

    try {
      const path = logPath(new Date());
      mkdirSync(dirname(path), { recursive: true, mode: 0o755 });
      appendFileSync(path, `${JSON.stringify(record)}\n`, { mode: 0o644 });
    } catch (err) {
      logger.warn({ err }, "blog-agent: could not append notification log");
    }
  },
};

// MATRIX_TRANSPORT_NOTE — to add Matrix, implement NotifyTransport here:
//
//   const matrixTransport: NotifyTransport = {
//     name: "matrix",
//     async send(n) {
//       const token = process.env.MATRIX_BOT_TOKEN;
//       const room = n.level === "alert"
//         ? process.env.MATRIX_ALERTS_ROOM_ID
//         : process.env.MATRIX_BRIEFING_ROOM_ID;
//       if (!token || !room) return;  // unset = transport inert, never an error
//       await fetch(`${base}/_matrix/client/v3/rooms/${encodeURIComponent(room)}/send/` +
//                   `m.room.message/${crypto.randomUUID()}`, { … });
//     },
//   };
//
// Then push it into TRANSPORTS below. Room IDs are the internal "!abc:server"
// form, not the "#echorank-briefing" alias — the alias needs a resolve call
// first, and resolving on every send is a request nobody needs.

const TRANSPORTS: NotifyTransport[] = [loggingTransport];

/**
 * Fan out to every transport.
 *
 * NEVER THROWS. A notification failure must not roll back a draft that is
 * already written and committed — the article existing and nobody being told is
 * recoverable; the job failing after the commit is not.
 */
export async function notify(n: Notification): Promise<void> {
  await Promise.allSettled(TRANSPORTS.map((t) => t.send(n)));
}

/** Test seam: swap the transport list wholesale. */
export function setTransportsForTest(transports: NotifyTransport[]): () => void {
  const original = [...TRANSPORTS];
  TRANSPORTS.length = 0;
  TRANSPORTS.push(...transports);
  return () => {
    TRANSPORTS.length = 0;
    TRANSPORTS.push(...original);
  };
}
