/**
 * /api/seo/v1/ai-keys — the tenant's own OpenAI / Gemini keys for the Site
 * Crawler's AI prompts (Phase 4e, crawl.ai). Tenant-scoped through
 * requirePaidPlan.
 *
 *   GET                         → { openai: {set, createdAt, lastUsedAt}, gemini: … }
 *   PUT { provider, key }       → the same; the key is encrypted at rest
 *   DELETE ?provider=openai|gemini → 204
 *
 * The key is never returned, logged or echoed in an error, not even in part.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { flag } from "@/lib/flags";
import { rateLimit } from "@/lib/rate-limit";
import { AI_KEY_PROVIDERS, aiKeyStatus, deleteAiKey, plausibleAiKey, saveAiKey } from "@/lib/site-crawler/ai-keys";
import { crawlRouteError } from "@/lib/site-crawler/http";

const BodySchema = z.object({ provider: z.enum(AI_KEY_PROVIDERS), key: z.string().max(512) });
const off = () => NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

export async function GET() {
  try {
    if (!flag("crawl.ai")) return off();
    const tenant = await requirePaidPlan();
    return NextResponse.json(await aiKeyStatus(tenant.tenantId));
  } catch (err) {
    return crawlRouteError(err);
  }
}

export async function PUT(request: Request) {
  try {
    if (!flag("crawl.ai")) return off();
    const tenant = await requirePaidPlan();
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    // Never parsed.error: zod's issue would carry the received value.
    if (!parsed.success) return NextResponse.json({ error: "Invalid request body", code: "INVALID_REQUEST" }, { status: 400 });
    const key = parsed.data.key.trim();
    if (!plausibleAiKey(key)) return NextResponse.json({ error: "That does not look like an API key.", code: "INVALID_KEY" }, { status: 400 });
    const limited = await rateLimit(`ai-keys:${tenant.tenantId}`, 10, 60_000);
    if (!limited.success) return NextResponse.json({ error: "Too many changes in a row. Wait a minute.", code: "RATE_LIMITED" }, { status: 429 });
    await saveAiKey(tenant.tenantId, parsed.data.provider, key);
    return NextResponse.json(await aiKeyStatus(tenant.tenantId));
  } catch (err) {
    return crawlRouteError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    if (!flag("crawl.ai")) return off();
    const tenant = await requirePaidPlan();
    const provider = z.enum(AI_KEY_PROVIDERS).safeParse(new URL(request.url).searchParams.get("provider"));
    if (!provider.success) return NextResponse.json({ error: "Unknown provider", code: "INVALID_REQUEST" }, { status: 400 });
    await deleteAiKey(tenant.tenantId, provider.data);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return crawlRouteError(err);
  }
}
