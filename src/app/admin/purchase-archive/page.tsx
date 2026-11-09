// /admin/purchase-archive — the purchase archive (ECHORANK-DATA-ARCHIVE.md):
// purchases vs archive hits per provider per day, and dollars saved. Staff
// only (PLATFORM_ADMIN_EMAILS); anyone else gets a 404, like every page under
// /admin. Counts and sums only: no archived payload is ever shown or linked.
// Staff-only and English, like the rest of /admin.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { platformAdmin } from "@/lib/platform-admin";
import { REPORT_DAYS, archiveReport } from "@/lib/purchase-archive/report";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Purchase archive", robots: { index: false, follow: false } };

export default async function Page() {
  if (!(await platformAdmin())) notFound();
  const rows = await archiveReport();
  const usd = (v: number) => `$${v.toFixed(v < 1 ? 4 : 2)}`;
  const cell = { padding: "6px 10px", borderBottom: "1px solid #8884", textAlign: "left" as const, fontSize: 13 };
  const totals = rows.reduce(
    (t, r) => ({ purchases: t.purchases + r.purchases, purchasedUsd: t.purchasedUsd + r.purchasedUsd, hits: t.hits + r.hits, savedUsd: t.savedUsd + r.savedUsd }),
    { purchases: 0, purchasedUsd: 0, hits: 0, savedUsd: 0 },
  );

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 960, margin: "0 auto" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/admin">← Admin</Link>
      </p>
      <h1 style={{ fontSize: 22 }}>Purchase archive</h1>
      <p style={{ fontSize: 13, color: "#666" }}>
        Last {REPORT_DAYS} days. A purchase is a paid response stored in the archive; a hit is a purchase not made
        because the archive already held the same request inside its freshness window. Saved is what the reused
        purchases cost.
      </p>
      <p style={{ fontSize: 15 }} data-archive-totals="">
        {totals.purchases.toLocaleString("en-US")} purchases ({usd(totals.purchasedUsd)}) · {totals.hits.toLocaleString("en-US")} hits ·{" "}
        <strong>{usd(totals.savedUsd)} saved</strong>
      </p>
      {rows.length === 0 ? (
        <p style={{ fontSize: 13 }}>Nothing archived yet. The archive is off until PURCHASE_ARCHIVE_* is set.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", marginTop: 12, width: "100%" }}>
          <thead>
            <tr>
              <th style={cell}>Day (UTC)</th>
              <th style={cell}>Provider</th>
              <th style={cell}>Purchases</th>
              <th style={cell}>Spent</th>
              <th style={cell}>Archive hits</th>
              <th style={cell}>Saved</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.day}-${r.provider}`}>
                <td style={cell}>{r.day}</td>
                <td style={cell}>{r.provider}</td>
                <td style={cell}>{r.purchases.toLocaleString("en-US")}</td>
                <td style={cell}>{usd(r.purchasedUsd)}</td>
                <td style={cell}>{r.hits.toLocaleString("en-US")}</td>
                <td style={cell}>{usd(r.savedUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
