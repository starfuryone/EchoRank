// /admin/free-crawler — staff only (PLATFORM_ADMIN_EMAILS): the free public
// crawler's opt-out list. A site owner who writes to support@ asking to be left
// out goes here; the free crawler then refuses that host and its subdomains.
// Anyone else gets a 404.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { platformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { freeCrawlsInLastDays } from "@/lib/site-crawler/free-crawl";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Free crawler · admin", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  if (!(await platformAdmin())) notFound();
  const { saved } = await searchParams;
  const [blocked, last7] = await Promise.all([
    prisma.freeCrawlBlockedHost.findMany({ orderBy: { host: "asc" }, select: { host: true, note: true, addedBy: true, createdAt: true } }),
    freeCrawlsInLastDays(7),
  ]);
  const cell = { padding: "6px 10px", borderBottom: "1px solid #8884", textAlign: "left" as const, fontSize: 13 };

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22 }}>Free site crawler</h1>
      <p style={{ color: "#666", fontSize: 13 }}>
        {last7.toLocaleString("en-US")} free crawls in the last 7 days. Hosts below are refused by the free crawler, subdomains included.
        {saved && <span style={{ color: "#15803d", marginLeft: 8 }}>Saved.</span>}
      </p>

      <form method="post" action="/api/admin/free-crawler" style={{ border: "1px solid #8884", borderRadius: 8, padding: 16, display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
        <input type="hidden" name="action" value="add" />
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Host or domain
          <input name="host" required placeholder="example.com" style={{ padding: 6 }} />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13, flex: 1, minWidth: 200 }}>
          Note (who asked, when)
          <input name="note" maxLength={500} style={{ padding: 6 }} />
        </label>
        <button type="submit" style={{ padding: "6px 12px" }}>
          Block
        </button>
      </form>

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Blocked hosts</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {["Host", "Note", "Added", ""].map((h) => (
              <th key={h} style={cell}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {blocked.map((b) => (
            <tr key={b.host}>
              <td style={cell}>{b.host}</td>
              <td style={cell}>{b.note ?? ""}</td>
              <td style={cell}>
                {b.createdAt.toISOString().slice(0, 10)}
                {b.addedBy ? ` · ${b.addedBy}` : ""}
              </td>
              <td style={cell}>
                <form method="post" action="/api/admin/free-crawler">
                  <input type="hidden" name="action" value="remove" />
                  <input type="hidden" name="host" value={b.host} />
                  <button type="submit" style={{ padding: "2px 8px" }}>
                    Remove
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {blocked.length === 0 && (
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
