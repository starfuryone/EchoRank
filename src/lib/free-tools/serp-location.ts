// src/lib/free-tools/serp-location.ts
//
// The free SERP Location Changer: what a keyword's results look like from
// another country.
//
// REUSES THE PAID FLOW END TO END. task_post → the existing standard-queue
// poller → a results page. The row is a SerpCheck like any other, owned by the
// sentinel free-tools tenant; SerpCheck.tenantId has no foreign key and
// serp/task-owner.ts's findPending is tenant-agnostic, so the sweep that
// already runs collects these without knowing they are free. No second poller,
// no second table, no duplicated parsing.
//
// LOCATIONS ARE COUNTRIES ONLY. The brief asked for a country/city picker
// reusing a ported keyword-locations.ts; no such file exists in this repo and
// DataForSEO city codes are not derivable — a wrong location_code returns
// plausible results for the wrong place, which is worse than not offering the
// choice. This reuses the seven codes serp/options.ts already verifies and
// labels in all three catalogs; city support needs the real locations dataset.

import { prisma } from "@/lib/prisma";
import { seoMeteredCallResult } from "@/lib/dataforseo/metering";
import { SERP } from "@/lib/dataforseo/endpoints";
import { SERP_LOCATION_CODES, type SerpLocationCode } from "@/lib/serp/options";
import { FREE_TOOLS_TENANT_ID } from "./spend";
import { FREE_VISIBLE_POSITIONS } from "./public-constants";

/** Free runs are desktop-only: device doubles the cache keys for little gain. */
export const FREE_DEVICE = "desktop" as const;
export const FREE_LANGUAGE = "en";

/**
 * Depth 10 — the free tool shows a top-10 only.
 *
 * DataForSEO bills the standard queue per result page, so asking for 100 and
 * showing 10 would cost the same as the paid tool for a tenth of the value.
 */
export const FREE_SERP_DEPTH = 10;

// Client components need this number too, so it lives in public-constants.ts —
// importing it from here would pull Prisma into the browser bundle.
export { FREE_VISIBLE_POSITIONS } from "./public-constants";

export function isSupportedLocation(code: number): code is SerpLocationCode {
  return (SERP_LOCATION_CODES as readonly number[]).includes(code);
}

export interface StartedCheck {
  id: string;
  status: string;
}

/**
 * Post a standard-queue task and record the row the poller will complete.
 *
 * The SeoApiCall row carries the task id, so it bills against the free daily
 * cap immediately (the money is spent at task_post) while the poller stamps
 * resultAt later — the same two-phase accounting paid tenants get.
 */
export async function startFreeSerpCheck(
  keyword: string,
  locationCode: SerpLocationCode,
): Promise<StartedCheck> {
  // Metered against the sentinel tenant: the wrapper writes the SeoApiCall row
  // with the task id, so the spend registers now and the poller stamps the
  // result later — the same two-phase accounting paid tenants get.
  const posted = await seoMeteredCallResult<unknown[]>(
    FREE_TOOLS_TENANT_ID,
    SERP.organicTaskPost,
    {
      keyword,
      location_code: locationCode,
      language_code: FREE_LANGUAGE,
      device: FREE_DEVICE,
      os: "windows",
      // priority 1 = standard queue, the cheap one.
      priority: 1,
      depth: FREE_SERP_DEPTH,
    },
  );

  const row = await prisma.serpCheck.create({
    data: {
      tenantId: FREE_TOOLS_TENANT_ID,
      keyword,
      locationCode,
      languageCode: FREE_LANGUAGE,
      device: FREE_DEVICE,
      dataforseoTaskId: posted.taskId ?? null,
      status: "queued",
      costUsd: posted.billing.costUsd,
    },
  });

  return { id: row.id, status: row.status };
}

export interface FreeSerpItem {
  position: number;
  title: string;
  url: string;
  domain: string;
  /** Null once blurred — the row is withheld server-side, not hidden in CSS. */
  description: string | null;
  locked: boolean;
}

interface StoredItem {
  position?: unknown;
  title?: unknown;
  url?: unknown;
  domain?: unknown;
  description?: unknown;
}

/**
 * Shape a completed check for the public page.
 *
 * Positions past FREE_VISIBLE_POSITIONS are returned WITHOUT their title, URL
 * or description. Blurring in CSS would ship the answer to anyone who opens
 * devtools, which is not a paywall — it is a rumour of one.
 */
export function toPublicResults(results: unknown): FreeSerpItem[] {
  const items = (results as { items?: StoredItem[] })?.items;
  if (!Array.isArray(items)) return [];

  return items.slice(0, FREE_SERP_DEPTH).map((item, index) => {
    const position = typeof item.position === "number" ? item.position : index + 1;
    const locked = position > FREE_VISIBLE_POSITIONS;
    return {
      position,
      locked,
      title: locked ? "" : String(item.title ?? ""),
      url: locked ? "" : String(item.url ?? ""),
      domain: locked ? "" : String(item.domain ?? ""),
      description: locked ? null : (item.description ? String(item.description) : null),
    };
  });
}

/** The newest completed free check for this exact query, if one is fresh. */
export async function findCachedCheck(
  keyword: string,
  locationCode: number,
  since: Date,
) {
  return prisma.serpCheck.findFirst({
    where: {
      tenantId: FREE_TOOLS_TENANT_ID,
      keyword,
      locationCode,
      languageCode: FREE_LANGUAGE,
      device: FREE_DEVICE,
      status: "completed",
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
  });
}
