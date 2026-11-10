// /admin/link-authority — staff only (PLATFORM_ADMIN_EMAILS): a tenant's
// monthly Link Authority Checker allowance above its plan's default (an
// Enterprise contract). Empty = the plan's value. Anyone else gets a 404;
// signed-out visitors never reach it (proxy auth gate).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { PlanType } from "@/generated/prisma";
import { LINK_AUTHORITY_OVERRIDE_BOUNDS } from "@/lib/authority-checker/override";
import { effectiveLinkAuthorityLimit, linkAuthorityUsed } from "@/lib/authority-checker/quota";
import { linkAuthorityChecksLimit } from "@/lib/plan-config";
import { platformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Link Authority allowances · admin", robots: { index: false, follow: false } };

const SELECT = { id: true, slug: true, name: true, planType: true, linkAuthorityChecksOverride: true } as const;
const n = (v: number | null) => (v === null ? "unlimited" : v.toLocaleString("en-US"));

export default async function Page({ searchParams }: { searchParams: Promise<{ slug?: string; saved?: string }> }) {
  if (!(await platformAdmin())) notFound();
  const { slug, saved } = await searchParams;
  const [overridden, tenant] = await Promise.all([
    prisma.tenant.findMany({ where: { linkAuthorityChecksOverride: { not: null } }, select: SELECT, orderBy: { slug: "asc" } }),
    slug ? prisma.tenant.findUnique({ where: { slug }, select: SELECT }) : null,
  ]);
  const used = tenant ? await linkAuthorityUsed(tenant.id) : 0;
  const cell = { padding: "6px 10px", borderBottom: "1px solid #8884", textAlign: "left" as const, fontSize: 13 };
  const [min, max] = LINK_AUTHORITY_OVERRIDE_BOUNDS;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22 }}>Link Authority Checker allowances</h1>
      <p style={{ color: "#666", fontSize: 13 }}>
        Checks a month per tenant, replacing the plan&apos;s default (plan-config linkAuthorityChecksPerMonth). Empty = the plan&apos;s value. Applies
        from the next check; this month&apos;s count is kept.
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
        <form method="post" action="/api/admin/link-authority" style={{ border: "1px solid #8884", borderRadius: 8, padding: 16, display: "grid", gap: 12 }}>
          <input type="hidden" name="slug" value={tenant.slug} />
          <p style={{ margin: 0 }}>
            <b>{tenant.name}</b> ({tenant.slug}) · plan {tenant.planType} · {n(used)} used this month
            {saved === "1" && <span style={{ color: "#15803d", marginLeft: 8 }}>Saved.</span>}
          </p>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Checks a month (plan: {n(linkAuthorityChecksLimit(tenant.planType as PlanType))}; {min}–{max.toLocaleString("en-US")})
            <input
              name="linkAuthorityChecksOverride"
              type="number"
              min={min}
              max={max}
              defaultValue={tenant.linkAuthorityChecksOverride ?? ""}
              style={{ padding: 6, maxWidth: 200 }}
            />
          </label>
          <button type="submit" style={{ padding: "6px 12px", justifySelf: "start" }}>
            Save
          </button>
        </form>
      )}

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Tenants with an override</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {["Tenant", "Plan", "Plan default", "Checks a month"].map((h) => (
              <th key={h} style={cell}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {overridden.map((t) => (
            <tr key={t.slug}>
              <td style={cell}>
                <a href={`/admin/link-authority?slug=${encodeURIComponent(t.slug)}`}>{t.slug}</a>
              </td>
              <td style={cell}>{t.planType}</td>
              <td style={cell}>{n(linkAuthorityChecksLimit(t.planType as PlanType))}</td>
              <td style={cell}>{n(effectiveLinkAuthorityLimit(t.planType as PlanType, t.linkAuthorityChecksOverride))}</td>
            </tr>
          ))}
          {overridden.length === 0 && (
            <tr>
              <td style={cell} colSpan={4}>
                None.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
