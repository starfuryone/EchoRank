// /admin — the staff overview. Staff only (PLATFORM_ADMIN_EMAILS); anyone
// else gets a 404, like every page under /admin. Signed-out visitors never
// reach it: /admin is behind the proxy's auth gate.
//
// Demand for social posting (2026-11-08): clicks on the CTA of "Social posting,
// by EchoPilot" in the SEO Tools hub (partner_clicks, src/lib/echopilot-clicks.ts).
// Staff-only and English, like the rest of /admin.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { platformAdmin } from "@/lib/platform-admin";
import { ECHOPILOT_CLICK_WINDOW_DAYS, echopilotClickStats } from "@/lib/echopilot-clicks";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

const PAGES = [
  { href: "/admin/snapshots", label: "Snapshots (free AI Visibility Check)" },
  { href: "/admin/sales-inquiries", label: "Sales inquiries" },
  { href: "/admin/crawl-overrides", label: "Crawl overrides" },
  { href: "/admin/free-crawler", label: "Free crawler opt-outs" },
  { href: "/admin/purchase-archive", label: "Purchase archive (purchases, reuse, savings)" },
];

export default async function Page() {
  if (!(await platformAdmin())) notFound();
  const stats = await echopilotClickStats();
  const n = (v: number) => v.toLocaleString("en-US");
  const cell = { padding: "6px 10px", borderBottom: "1px solid #8884", textAlign: "left" as const, fontSize: 13 };

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22 }}>Admin</h1>

      <section data-echopilot-demand="" style={{ border: "1px solid #8884", borderRadius: 8, padding: 16, marginTop: 16 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Social posting demand (EchoPilot clicks)</h2>
        <p style={{ fontSize: 13, color: "#666", margin: "6px 0 12px" }}>
          Clicks on &quot;See EchoPilot pricing&quot; in SEO Tools → Social posting, by EchoPilot.
        </p>
        <p style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>
          {n(stats.recent)}{" "}
          <span style={{ fontSize: 14, fontWeight: 400, color: "#666" }}>
            clicks in the last {ECHOPILOT_CLICK_WINDOW_DAYS} days, from {n(stats.recentTenants)} workspace
            {stats.recentTenants === 1 ? "" : "s"} · {n(stats.total)} all time
          </span>
        </p>
        {stats.recentByPlan.length > 0 && (
          <table style={{ borderCollapse: "collapse", marginTop: 12 }}>
            <thead>
              <tr>
                <th style={cell}>Plan</th>
                <th style={cell}>Clicks ({ECHOPILOT_CLICK_WINDOW_DAYS} days)</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentByPlan.map((r) => (
                <tr key={r.plan}>
                  <td style={cell}>{r.plan}</td>
                  <td style={cell}>{n(r.clicks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Pages</h2>
      <ul style={{ fontSize: 14, lineHeight: 1.8 }}>
        {PAGES.map((p) => (
          <li key={p.href}>
            <Link href={p.href}>{p.label}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
