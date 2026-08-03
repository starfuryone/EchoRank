import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, requireQuota, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { sidecarPost } from "@/lib/av-sidecar";
import { cachedAiCall } from "@/lib/ai-cache";

/**
 * POST /api/ai/visibility/remediate — AI-generated fixes for a page.
 *
 * The sidecar's /remediate makes one Anthropic call (remediate.py). It is
 * cached HERE rather than in Python: av-service has no redis client installed,
 * and an in-process Python cache would reset on every restart. Skipping the
 * sidecar call skips the Anthropic call inside it.
 *
 * KEY: { url, crawl }. The brief anticipated hashing an audit result, but this
 * endpoint does not receive one — `crawl` is a boolean and the sidecar fetches
 * the page itself, so the request identity IS the full input. A page that
 * changes within the 24h TTL will serve the previous fixes; that is the same
 * trade every other cache here makes, and re-running is one `fresh: true` away.
 *
 * Cache is checked BEFORE requireQuota, per the ordering content-explorer
 * establishes: serving a stored result costs nothing, so it must not consume an
 * allowance.
 */
export async function POST(request: NextRequest) {
  try {
    const membership = await requireTenant();
    await requireFeature("ai_visibility");

    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json({ error: "Enter a URL to remediate." }, { status: 400 });
    }
    const crawl = body?.crawl !== false;
    const fresh = body?.fresh === true;

    let upstreamStatus = 200;
    const { value, cached } = await cachedAiCall(
      { namespace: "remediate", tenantId: membership.tenantId, inputs: { url, crawl }, fresh },
      async () => {
        await requireQuota("AI_INFERENCE");
        const { status, data } = await sidecarPost("/remediate", { url, crawl });
        upstreamStatus = status;
        // Never cache a failure: a 502 from a transient sidecar blip would
        // otherwise be served for 24 hours.
        if (status !== 200) throw new SidecarFailed(status, data);
        return data;
      },
    );

    return NextResponse.json({ ...(value as object), cached }, { status: upstreamStatus });
  } catch (error) {
    if (error instanceof SidecarFailed) {
      return NextResponse.json(error.data as object, { status: error.status });
    }
    const enforcement = enforcementErrorResponse(error);
    if (enforcement) return enforcement;
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error generating visibility fixes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Carries a non-200 sidecar response out past the cache without storing it. */
class SidecarFailed extends Error {
  constructor(readonly status: number, readonly data: unknown) {
    super("sidecar returned non-200");
    this.name = "SidecarFailed";
  }
}
