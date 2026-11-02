// /admin/snapshots — the free AI Visibility Check, from the inside: every
// run, what it cost, and whether it turned into an email. Staff only
// (PLATFORM_ADMIN_EMAILS); anyone else gets a 404, not a "forbidden" that
// confirms the page exists. Signed-out visitors never reach it: /admin is
// behind the proxy's auth gate.
//
// Queue failures are not shown here: snapshot jobs run on the
// visibility-monitoring queue, which the support@ failure alert already reads
// (src/lib/queue-alerts.ts).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { platformAdmin } from "@/lib/platform-admin";
import { listForAdmin, recentSince } from "@/lib/snapshot/store";
import { runCapUsd } from "@/lib/snapshot/run";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Snapshots · admin", robots: { index: false, follow: false } };

const usd = (n: number) => `$${n.toFixed(4)}`;

export default async function Page() {
  if (!(await platformAdmin())) notFound();
  const runs = await listForAdmin(500);
  const recent = recentSince(runs, 30);
  const done = recent.filter((r) => r.status === "done");
  const cost = recent.reduce((n, r) => n + r.costUsd, 0);
  const withLead = done.filter((r) => r.leads > 0).length;
  const cell = { padding: "6px 10px", borderBottom: "1px solid #8884", textAlign: "left" as const, fontSize: 13 };

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22 }}>Free AI Visibility Check — runs</h1>
      <p style={{ color: "#888", fontSize: 13 }}>
        Last 30 days. Cap per run {usd(runCapUsd())}. Conversion = finished runs with at least one email unlock.
      </p>
      <ul style={{ display: "flex", gap: 24, listStyle: "none", padding: 0, flexWrap: "wrap" }}>
        <li>Runs: <b>{recent.length}</b></li>
        <li>Finished: <b>{done.length}</b></li>
        <li>Failed: <b>{recent.filter((r) => r.status === "failed").length}</b></li>
        <li>Spend: <b>{usd(cost)}</b></li>
        <li>Avg / finished run: <b>{done.length ? usd(done.reduce((n, r) => n + r.costUsd, 0) / done.length) : "—"}</b></li>
        <li>Email conversion: <b>{done.length ? `${Math.round((withLead / done.length) * 100)}%` : "—"}</b> ({withLead}/{done.length})</li>
        <li>Emails: <b>{recent.reduce((n, r) => n + r.leads, 0)}</b></li>
      </ul>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {["Created (UTC)", "Domain", "Brand", "Status", "Cost", "Calls", "Emails", "Error"].map((h) => (
              <th key={h} style={cell}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id}>
              <td style={cell}>{r.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
              <td style={cell}>{r.domain}</td>
              <td style={cell}>{r.brand}</td>
              <td style={cell}>{r.status}</td>
              <td style={cell}>{usd(r.costUsd)}</td>
              <td style={cell}>{r.calls}</td>
              <td style={cell}>{r.leads}</td>
              <td style={{ ...cell, color: "#c55" }}>{r.error ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
