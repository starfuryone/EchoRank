import "server-only";

// One-line alerts to the Matrix #echorank-alerts room, the same way the
// agentbot (/opt/echorank-agents/agents/src/matrix.js) posts them: a plain
// m.room.message PUT over the client API, with the same three variables:
//
//   MATRIX_HOMESERVER_URL   e.g. http://127.0.0.1:8008 (Synapse on this box)
//   MATRIX_ACCESS_TOKEN     the bot's access token
//   MATRIX_ROOM_ALERTS      the room id of #echorank-alerts
//
// They live in the agentbot's .env, which the app cannot read; copy them into
// the app's .env to turn this on. Until then, and whenever the homeserver is
// unreachable, an alert is skipped silently (debug log only): an alert must
// never fail the request that raised it.
import { randomBytes } from "node:crypto";
import { logger } from "@/infrastructure/observability/logger";

export function matrixAlertsConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.MATRIX_HOMESERVER_URL && env.MATRIX_ACCESS_TOKEN && env.MATRIX_ROOM_ALERTS);
}

/** True when the homeserver accepted the message. Never throws. */
export async function postMatrixAlert(line: string, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  if (!matrixAlertsConfigured(env)) return false;
  const hs = env.MATRIX_HOMESERVER_URL!.replace(/\/+$/, "");
  const room = encodeURIComponent(env.MATRIX_ROOM_ALERTS!);
  const txn = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  try {
    const res = await fetch(`${hs}/_matrix/client/v3/rooms/${room}/send/m.room.message/${txn}`, {
      method: "PUT", // a POST returns M_UNRECOGNIZED
      headers: { Authorization: `Bearer ${env.MATRIX_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ msgtype: "m.text", body: line.replace(/\s+/g, " ").slice(0, 500) }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) logger.debug({ status: res.status }, "matrix alert not accepted");
    return res.ok;
  } catch (err) {
    logger.debug({ err }, "matrix alert skipped: homeserver unreachable");
    return false;
  }
}
