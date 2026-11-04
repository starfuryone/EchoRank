// src/lib/site-crawler/free-crawl.ts
//
// The free public site crawler's crawl: FREE_CRAWL_URL_CAP pages, spider mode,
// raw HTML, the default configuration (Echorank360Bot UA, robots.txt obeyed,
// 2 requests a second, no opt-ins), owned by the system tenant
// (free-tenant.ts) and queued behind every paid crawl. It bypasses startCrawl
// on purpose: no plan, no quota, no saved site defaults, no segments.

import "server-only";
import { addJob } from "@/infrastructure/queue/registry";
import { prisma } from "@/lib/prisma";
import { FREE_CRAWL_PRIORITY, freeTenantId } from "./free-tenant";

export const FREE_CRAWL_URL_CAP = 100;

/** Create and queue one free crawl of an already-validated root URL. */
export async function enqueueFreeCrawl(rootUrl: string): Promise<{ id: string; tenantId: string }> {
  const tenantId = await freeTenantId();
  const job = await prisma.crawlJob.create({
    data: {
      tenantId,
      rootUrl,
      mode: "spider",
      urlCap: FREE_CRAWL_URL_CAP,
      renderMode: "none",
      renderCap: 0,
      status: "QUEUED",
      // No config: the defaults, which are robots.txt obeyed at 2 req/s as
      // Echorank360Bot, with no opt-in of any kind.
    },
    select: { id: true, tenantId: true },
  });
  await addJob("site-crawl", "crawl", { crawlJobId: job.id, tenantId }, { priority: FREE_CRAWL_PRIORITY });
  return job;
}
