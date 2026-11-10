// /admin/crawl-overrides — staff only (PLATFORM_ADMIN_EMAILS): a tenant's site
// crawler overrides (Phase 3d-A, src/lib/site-crawler/tenant-caps.ts) —
// simultaneous crawls, crawls kept with full data, URLs per crawl. Empty =
// the plan's value. Anyone else gets a 404, not a "forbidden" that confirms
// the page exists; signed-out visitors never reach it (proxy auth gate).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { PlanType } from "@/generated/prisma";
import { planConfig } from "@/lib/plan-config";
import { platformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { OVERRIDE_BOUNDS, TENANT_CRAWL_CONCURRENCY_DEFAULT, crawlMaxConcurrent, effectiveCaps } from "@/lib/site-crawler/tenant-caps";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Crawl overrides · admin", robots: { index: false, follow: false } };

const FIELDS = [
  ["crawlConcurrencyOverride", "Simultaneous crawls", "concurrency"],
  ["crawlsKeptOverride", "Crawls kept with full data", "crawlsKept"],
  ["crawlUrlCapOverride", "URLs per crawl", "urlCap"],
  ["crawlPagesPerMonthOverride", "Pages per month (all crawls)", "pagesPerMonth"],
] as const;

const SELECT = {
  slug: true,
  name: true,
  planType: true,
  crawlConcurrencyOverride: true,
  crawlsKeptOverride: true,
  crawlUrlCapOverride: true,
  crawlPagesPerMonthOverride: true,
} as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ slug?: string; saved?: string }> }) {
  if (!(await platformAdmin())) notFound();
  const { slug, saved } = await searchParams;
  const [overridden, tenant] = await Promise.all([
    prisma.tenant.findMany({
      where: {
        OR: [
          { crawlConcurrencyOverride: { not: null } },
          { crawlsKeptOverride: { not: null } },
          { crawlUrlCapOverride: { not: null } },
          { crawlPagesPerMonthOverride: { not: null } },
        ],
      },
      select: SELECT,
      orderBy: { slug: "asc" },
    }),
    slug ? prisma.tenant.findUnique({ where: { slug }, select: SELECT }) : null,
  ]);
  const cell = { padding: "6px 10px", borderBottom: "1px solid #8884", textAlign: "left" as const, fontSize: 13 };
  const plan = (t: { planType: string }) => planConfig(t.planType as PlanType);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22 }}>Site crawler overrides</h1>
      <p style={{ color: "#666", fontSize: 13 }}>
        Per-tenant caps that replace the plan&apos;s. Empty = the plan&apos;s value. Simultaneous crawls default to {TENANT_CRAWL_CONCURRENCY_DEFAULT}; the box
        runs {crawlMaxConcurrent()} crawls at a time (CRAWL_MAX_CONCURRENT) whatever the setting.
      </p>

      <form method="get" style={{ display: "flex", gap: 8, alignItems: "end", margin: "16px 0" }}>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Tenant slug
          <input name="slug" defaultValue={slug ?? ""} style={{ padding: 6 }} />
        </label>
        <button type="submit" style={{ padding: "6px 12px" }}>
          Open
        </button>
      </form>

      {slug && !tenant && <p style={{ color: "#b91c1c" }}>No tenant with slug {slug}.</p>}
      {tenant && (
        <form method="post" action="/api/admin/crawl-overrides" style={{ border: "1px solid #8884", borderRadius: 8, padding: 16, display: "grid", gap: 12 }}>
          <input type="hidden" name="slug" value={tenant.slug} />
          <p style={{ margin: 0 }}>
            <b>{tenant.name}</b> ({tenant.slug}) · plan {tenant.planType}
            {saved === "1" && <span style={{ color: "#15803d", marginLeft: 8 }}>Saved.</span>}
          </p>
          {FIELDS.map(([field, label, key]) => {
            const planValue =
              key === "concurrency"
                ? TENANT_CRAWL_CONCURRENCY_DEFAULT
                : key === "crawlsKept"
                  ? plan(tenant).crawlsKept
                  : key === "pagesPerMonth"
                    ? plan(tenant).crawlPagesPerMonth
                    : plan(tenant).crawlUrlCap;
            const [min, max] = OVERRIDE_BOUNDS[field];
            return (
              <label key={field} style={{ display: "grid", gap: 4, fontSize: 13 }}>
                {label} (plan: {planValue === null ? "unlimited" : planValue.toLocaleString("en-US")}; {min}–{max.toLocaleString("en-US")})
                <input name={field} type="number" min={min} max={max} defaultValue={tenant[field] ?? ""} style={{ padding: 6, maxWidth: 200 }} />
              </label>
            );
          })}
          <button type="submit" style={{ padding: "6px 12px", justifySelf: "start" }}>
            Save
          </button>
        </form>
      )}

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Tenants with overrides</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {["Tenant", "Plan", "Simultaneous", "Kept", "URLs per crawl", "Pages / month"].map((h) => (
              <th key={h} style={cell}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {overridden.map((t) => {
            const eff = effectiveCaps(t.planType as PlanType, t);
            return (
              <tr key={t.slug}>
                <td style={cell}>
                  <a href={`/admin/crawl-overrides?slug=${encodeURIComponent(t.slug)}`}>{t.slug}</a>
                </td>
                <td style={cell}>{t.planType}</td>
                <td style={cell}>{eff.concurrency}</td>
                <td style={cell}>{eff.crawlsKept.toLocaleString("en-US")}</td>
                <td style={cell}>{eff.urlCap.toLocaleString("en-US")}</td>
                <td style={cell}>{eff.pagesPerMonth === null ? "unlimited" : eff.pagesPerMonth.toLocaleString("en-US")}</td>
              </tr>
            );
          })}
          {overridden.length === 0 && (
            <tr>
              <td style={cell} colSpan={6}>
                None.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
