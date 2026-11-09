import "server-only";

// src/lib/ai-monitor/runner/tracking-calls.ts
//
// Every DataForSEO call the AI visibility tracker makes (Google AI Overviews,
// the ChatGPT and Gemini LLM Scraper) goes through here, so each one is
// recorded as a SeoApiCall with feature "ai_tracking": real billed cost, out of
// the pooled SEO search allowance and out of the SEO data budget. The tracker's
// spend is capped by the AI cap instead (the runner reads it before every
// slot, and meteredAiCall again around the call that spends).
//
// A billed failure is still recorded; an unbilled one (our malformed request)
// is not, exactly as dataforseo/client.ts meteredCallResult does.
import { postTask, DataforseoError, type ApiResult } from "@/lib/dataforseo/client";
import { recordCall } from "@/lib/dataforseo/metering";
import { runWithPurchaseContext } from "@/lib/purchase-archive/context";

export const TRACKING_FEATURE = "ai_tracking" as const;

export async function postTrackingTask<T>(
  tenantId: string,
  path: string,
  task: Record<string, unknown>,
): Promise<ApiResult<T>> {
  try {
    const result = await runWithPurchaseContext({ tenantId, purpose: TRACKING_FEATURE }, () => postTask<T>(path, task));
    await recordCall({
      tenantId,
      feature: TRACKING_FEATURE,
      path: result.billing.path.join("/"),
      costUsd: result.billing.costUsd,
      ok: true,
      // Standard-queue posts carry their task id; live calls do not.
      dataforseoTaskId: result.taskId && /\/task_post$/.test(path) ? result.taskId : null,
    });
    return result;
  } catch (err) {
    if (err instanceof DataforseoError && err.billing) {
      await recordCall({
        tenantId,
        feature: TRACKING_FEATURE,
        path: err.billing.path.join("/"),
        costUsd: err.billing.costUsd,
        ok: false,
      });
    }
    throw err;
  }
}
