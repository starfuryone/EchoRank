/**
 * Site Audit end-to-end: start -> OnPage crawl -> poller -> stored audit.
 * Runs the REAL service and poller code, not a simulation.
 *
 *   # Live. Costs one crawl (billed per page). DATAFORSEO_RECORD=1 also writes
 *   # fixtures/dataforseo/*.json for task_post, summary and pages.
 *   DATAFORSEO_RECORD=1 npx tsx scripts/site-audit-e2e.ts <tenantId> <domain>
 *
 *   # Replay. Zero spend, zero network.
 *   DATAFORSEO_FIXTURES=1 npx tsx scripts/site-audit-e2e.ts <tenantId> <domain>
 *
 * Crawls take MINUTES. This script polls the real sweep until the row settles,
 * which is exactly what the worker does on its 60 s tick.
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { fixturesEnabled } from "@/lib/dataforseo/fixtures";
import { startAudit } from "@/lib/site-audit/service";
import { processSiteAuditSweep } from "@/lib/site-audit/poll";
import { siteAuditsUsed } from "@/lib/site-audit/quota";
import { auditLimit, crawlPageLimit } from "@/lib/site-audit/options";
import { SEVERITY_ORDER } from "@/lib/site-audit/checks";
import type { IssuesSection, PagesSection, SummarySection } from "@/lib/site-audit/types";

const POLL_INTERVAL_MS = 20_000;
const MAX_POLLS = 90; // 30 minutes

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [tenantId, domainArg] = process.argv.slice(2);
  if (!tenantId || !domainArg) {
    console.error("usage: npx tsx scripts/site-audit-e2e.ts <tenantId> <domain>");
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, planType: true },
  });
  if (!tenant) throw new Error(`No tenant ${tenantId}`);

  const replay = fixturesEnabled();
  console.log(
    `[e2e] ${replay ? "REPLAY (fixtures, $0.00)" : "LIVE (one crawl, billed per page)"} — ` +
      `tenant ${tenant.name} (${tenant.planType}), domain "${domainArg}", ` +
      `page cap ${crawlPageLimit(tenant.planType)}`,
  );

  // Both modes clear prior rows: the 24 h cache would otherwise short-circuit
  // a second run, and in replay the fixture always returns the same task id
  // (SiteAudit.dataforseoTaskId is unique).
  const cleared = await prisma.siteAudit.deleteMany({
    where: { tenantId, domain: domainArg.replace(/^https?:\/\//, "").replace(/^www\./, "") },
  });
  if (cleared.count) console.log(`[e2e] cleared ${cleared.count} prior row(s)`);

  const { audit, cached } = await startAudit(tenantId, tenant.planType, domainArg);
  if (cached) {
    console.log(`[e2e] cache hit — audit ${audit.id}, no crawl started.`);
    return report(audit.id);
  }
  console.log(
    `[e2e] crawl posted: row ${audit.id}, task ${audit.status}, ` +
      `post cost $${audit.costUsd.toFixed(6)}`,
  );

  for (let poll = 1; poll <= MAX_POLLS; poll++) {
    await sleep(replay ? 500 : POLL_INTERVAL_MS);
    await processSiteAuditSweep();

    const row = await prisma.siteAudit.findUnique({
      where: { id: audit.id },
      select: { status: true, pagesCrawled: true },
    });
    if (!row) break;
    if (row.status === "completed" || row.status === "failed") {
      console.log(`[e2e] ${row.status} after ${poll} sweep(s)`);
      return report(audit.id);
    }
    console.log(
      `[e2e] sweep ${poll}/${MAX_POLLS} — ${row.status}, ${row.pagesCrawled} page(s) crawled`,
    );
  }

  console.error("[e2e] crawl never settled within the poll window");
  process.exitCode = 1;
  await report(audit.id);
}

async function report(id: string) {
  const row = await prisma.siteAudit.findUnique({ where: { id } });
  if (!row) return;

  const summary = row.summary as SummarySection | null;
  const issues = row.issues as IssuesSection | null;
  const pages = row.pages as PagesSection | null;

  console.log("─".repeat(72));
  console.log(`id            ${row.id}`);
  console.log(`domain        ${row.domain} (cap ${row.maxPages} pages)`);
  console.log(`status        ${row.status}${row.error ? ` — ${row.error}` : ""}`);
  console.log(`task id       ${row.dataforseoTaskId ?? "—"}`);
  console.log(`costUsd       ${Number(row.costUsd).toFixed(6)}`);
  console.log(`pages crawled ${row.pagesCrawled}`);
  if (row.pagesCrawled > 0) {
    console.log(
      `cost/page     $${(Number(row.costUsd) / row.pagesCrawled).toFixed(8)}`,
    );
  }

  if (summary) {
    console.log(`OnPage score  ${summary.onPageScore ?? "—"}`);
    console.log(
      `totals        broken links ${summary.brokenLinks} · broken resources ${summary.brokenResources} · ` +
        `dup titles ${summary.duplicateTitles} · 4xx ${summary.responses4xx} · 5xx ${summary.responses5xx}`,
    );
  }

  if (issues) {
    console.log(
      `issues        ${SEVERITY_ORDER.map((s) => `${s}: ${issues.totals[s]}`).join(" · ")}`,
    );
    for (const item of issues.items.slice(0, 10)) {
      console.log(`  [${item.severity.padEnd(7)}] ${item.key.padEnd(38)} ${item.count}`);
    }
    if (issues.unclassified.length) {
      console.log(`  uncatalogued checks: ${issues.unclassified.join(", ")}`);
    }
  }

  if (pages) {
    console.log(`pages stored  ${pages.items.length} of ${pages.totalCount}`);
    for (const page of pages.items.slice(0, 5)) {
      console.log(
        `  ${String(page.issueCount).padStart(2)} issue(s)  score ${String(page.onPageScore ?? "—").padStart(5)}  ${page.url}`,
      );
    }
  }

  console.log(
    `quota         ${await siteAuditsUsed(row.tenantId)} of ${auditLimit((await prisma.tenant.findUnique({ where: { id: row.tenantId }, select: { planType: true } }))!.planType)} used this month`,
  );
  console.log("─".repeat(72));
}

main()
  .catch((err) => {
    console.error("[e2e] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
