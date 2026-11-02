/**
 * POST /api/free/v1/snapshot — start (or serve from cache) a free AI
 * Visibility Check. Anonymous: /api/free/v1/ is in the proxy's publicPaths;
 * the same-origin CSRF check still applies.
 *
 * The order is the spend order (src/lib/snapshot/limits.ts): validate and
 * blocklist, Turnstile, 7-day domain cache, 3-per-IP-per-day allowance, the
 * per-domain start lock, then enqueue. A cache hit answers before the
 * allowance is touched, so a visitor over their limit still gets the cached
 * run for a domain someone already checked.
 *
 * Returns { id, status, cached } — never the report; the page polls
 * GET /api/free/v1/snapshot/<id> for the preview.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getClientIp } from "@/lib/client-ip";
import { logger } from "@/infrastructure/observability/logger";
import { configuredEngines } from "@/lib/snapshot/engines";
import { normalizeDomain } from "@/lib/snapshot/match";
import { buildPrompts } from "@/lib/snapshot/prompts";
import {
  blockReason,
  hashIp,
  lockDomain,
  refundIpAllowance,
  takeIpAllowance,
  unlockDomain,
} from "@/lib/snapshot/limits";
import { verifyTurnstile } from "@/lib/snapshot/turnstile";
import { createSnapshot, findCached } from "@/lib/snapshot/store";
import { enqueueSnapshot } from "@/lib/snapshot/job";

export const dynamic = "force-dynamic";

const text = (max: number) => z.string().trim().min(1).max(max);
const Body = z.object({
  brand: text(80),
  domain: text(253),
  city: z.string().trim().max(60).optional().nullable(),
  category: text(60),
  locale: z.string().max(10).optional(),
  turnstileToken: z.string().max(2048).optional(),
});

const err = (code: string, status: number) => NextResponse.json({ error: code }, { status });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return err("invalid_request", 400);
  const { brand, category } = parsed.data;
  const city = parsed.data.city || null;
  const locale = parsed.data.locale?.startsWith("fr") ? "fr" : "en";
  const domain = normalizeDomain(parsed.data.domain);
  if (!domain) return err("invalid_domain", 400);
  const blocked = blockReason({ brand, domain, category, city });
  if (blocked) return err(blocked, 400);

  const engines = configuredEngines();
  if (!engines.length) return err("unavailable", 503);

  const ip = getClientIp(request.headers);
  const turnstile = await verifyTurnstile(parsed.data.turnstileToken, ip);
  if (turnstile === "unconfigured") return err("unavailable", 503);
  if (turnstile !== "ok") return err("turnstile", 403);

  const cached = await findCached(domain);
  if (cached) return NextResponse.json({ id: cached.id, status: cached.status, cached: true });

  const ipHash = hashIp(ip);
  const allowance = await takeIpAllowance(ipHash);
  if (allowance === "unavailable") return err("unavailable", 503);
  if (allowance === "limited") return err("rate_limited", 429);

  if (!(await lockDomain(domain))) {
    // Someone else is starting this domain right now: hand them theirs.
    await refundIpAllowance(ipHash);
    const racing = await findCached(domain);
    return racing
      ? NextResponse.json({ id: racing.id, status: racing.status, cached: true })
      : err("busy", 409);
  }
  try {
    const run = await createSnapshot({
      brand,
      domain,
      city,
      category,
      location: city,
      locale,
      prompts: buildPrompts({ brand, domain, category, location: city, locale }),
      engines: engines.map((e) => e.engine),
      ipHash,
    });
    await enqueueSnapshot(run.id);
    logger.info({ snapshotId: run.id, domain }, "Snapshot queued");
    return NextResponse.json({ id: run.id, status: run.status, cached: false }, { status: 202 });
  } catch (e) {
    await refundIpAllowance(ipHash);
    logger.error({ err: e, domain }, "Snapshot could not be queued");
    return err("unavailable", 503);
  } finally {
    await unlockDomain(domain);
  }
}
