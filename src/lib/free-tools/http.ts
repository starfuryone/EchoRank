// src/lib/free-tools/http.ts
//
// One guard chain and one error shape for every anonymous route.
//
// GUARD ORDER, and why: cache → IP → limit → cap → upstream.
//
//   cache first, because a cached answer costs nothing and must not spend a
//     visitor's allowance (this is the ordering bug the whole file exists to
//     prevent — see cache.ts);
//   IP next, because a request we cannot attribute cannot be limited at all;
//   limit before cap, so one abusive visitor is stopped by their own quota
//     rather than by burning the shared daily budget everyone else needs;
//   cap last, immediately before the money is spent.

import { NextResponse } from "next/server";
import { checkDailyCap } from "./spend";
import { consumeDailyLimit, visitorIp, type LimitResult } from "./limits";

export const FREE_TOOLS_COPY = {
  noIp: "We could not identify your connection, so this tool is unavailable. If you use a VPN or proxy, try disabling it.",
  rateLimited: "You have used today's free runs for this tool. It resets at midnight UTC.",
  unavailable: "This tool is briefly unavailable. Try again in a few minutes.",
  capped:
    "Our free tools have hit today's shared usage budget. They reset at midnight UTC — or create an account to run this any time.",
  badRequest: "Check the details you entered and try again.",
  upstream: "The data source did not answer. Try again in a few minutes.",
} as const;

export function jsonError(
  message: string,
  code: string,
  status: number,
  extra: Record<string, unknown> = {},
): NextResponse {
  return NextResponse.json({ error: message, code, ...extra }, { status });
}

/** Map a limiter refusal onto its response. */
export function limitResponse(result: LimitResult): NextResponse {
  if (result.reason === "no_ip") {
    // 403 rather than 429: this is not "too many", it is "not attributable".
    return jsonError(FREE_TOOLS_COPY.noIp, "NO_CLIENT_IP", 403);
  }
  if (result.reason === "unavailable") {
    return jsonError(FREE_TOOLS_COPY.unavailable, "LIMITER_UNAVAILABLE", 503);
  }
  return jsonError(FREE_TOOLS_COPY.rateLimited, "RATE_LIMITED", 429, {
    resetSeconds: result.resetSeconds ?? null,
  });
}

export interface GuardOk {
  ok: true;
  ip: string;
}

export interface GuardDenied {
  ok: false;
  response: NextResponse;
}

export type GuardResult = GuardOk | GuardDenied;

/**
 * Everything a paid free tool must clear before it spends.
 *
 * Call ONLY on a cache miss. On a hit, skip this entirely — that is what makes
 * a cached answer free for the visitor.
 */
export async function guardPaidRun(
  req: Request,
  tool: string,
  dailyLimit: number,
): Promise<GuardResult> {
  const ip = visitorIp(req);
  if (!ip) return { ok: false, response: limitResponse({ ok: false, reason: "no_ip" }) };

  const limit = await consumeDailyLimit(tool, ip, dailyLimit);
  if (!limit.ok) return { ok: false, response: limitResponse(limit) };

  const cap = await checkDailyCap();
  if (cap.capped) {
    // The visitor's allowance was already consumed above. Not refunded on
    // purpose: the cap is a shared-budget stop, and handing the attempt back
    // would let a single visitor retry against it all day.
    return {
      ok: false,
      response: jsonError(FREE_TOOLS_COPY.capped, "DAILY_CAP_REACHED", 429, {
        resetsAt: "00:00 UTC",
      }),
    };
  }

  return { ok: true, ip };
}

/** The same chain minus the money check, for tools that cost nothing to run. */
export async function guardFreeRun(
  req: Request,
  tool: string,
  dailyLimit: number,
): Promise<GuardResult> {
  const ip = visitorIp(req);
  if (!ip) return { ok: false, response: limitResponse({ ok: false, reason: "no_ip" }) };

  const limit = await consumeDailyLimit(tool, ip, dailyLimit);
  if (!limit.ok) return { ok: false, response: limitResponse(limit) };

  return { ok: true, ip };
}
