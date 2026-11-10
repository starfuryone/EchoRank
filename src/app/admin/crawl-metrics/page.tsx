// /admin/crawl-metrics — staff only (PLATFORM_ADMIN_EMAILS); anyone else gets
// a 404, like every page under /admin. The crawler's live state: crawls running
// and queued, pages/s, CPU and memory per crawler process, batch-write latency,
// Redis memory and the sidecar's render queue (crawl-admin-metrics.ts).
// Refreshes itself every 10 s. English only, like the rest of /admin.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { platformAdmin } from "@/lib/platform-admin";
import { crawlAdminMetrics } from "@/lib/site-crawler/crawl-admin-metrics";
import { AutoRefresh } from "./refresh";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Crawl metrics · admin", robots: { index: false, follow: false } };

const n = (v: number) => v.toLocaleString("en-US");
const cell = { padding: "6px 10px", borderBottom: "1px solid #8884", textAlign: "left" as const, fontSize: 13 };
const card = { border: "1px solid #8884", borderRadius: 8, padding: "10px 14px", minWidth: 150 };

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
      {note ? <div style={{ fontSize: 12, color: "#666" }}>{note}</div> : null}
    </div>
  );
}

export default async function Page() {
  if (!(await platformAdmin())) notFound();
  const m = await crawlAdminMetrics();
  const q = m.queue;
  const waiting = q ? (q.waiting ?? 0) + (q.prioritized ?? 0) : null;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 1100, margin: "0 auto" }}>
      <AutoRefresh seconds={10} />
      <p style={{ fontSize: 13 }}>
        <Link href="/admin">← Admin</Link>
      </p>
      <h1 style={{ fontSize: 22 }}>Crawl metrics</h1>
      <p style={{ color: "#666", fontSize: 13 }}>Live, refreshed every 10 s. As of {m.at.replace("T", " ").slice(0, 19)} UTC.</p>

      <div data-tiles="" style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "16px 0" }}>
        <Tile label="Crawls running" value={m.crawls ? n(m.crawls.running) : "—"} note={`of ${n(m.slots.live || m.slots.configured)} slots${m.slots.live ? "" : " (configured)"}`} />
        <Tile label="Crawls queued" value={m.crawls ? n(m.crawls.queued) : "—"} note={waiting === null ? undefined : `queue: ${n(waiting)} waiting, ${n(q?.delayed ?? 0)} held back`} />
        <Tile label="Pages / s" value={m.pagesPerSec.toLocaleString("en-US", { maximumFractionDigits: 1 })} note={`${m.processes.length} process(es) reporting`} />
        <Tile
          label="Redis memory"
          value={m.redis ? `${n(m.redis.usedMb)} MB` : "—"}
          note={m.redis ? `peak ${n(m.redis.peakMb)} MB${m.redis.maxMb ? ` · cap ${n(m.redis.maxMb)} MB` : ""}` : undefined}
        />
        <Tile
          label="Render queue"
          value={m.render ? n(m.render.queued) : "—"}
          note={m.render ? `${n(m.render.running)} / ${n(m.render.contexts)} contexts busy` : "sidecar not answering"}
        />
      </div>

      <h2 style={{ fontSize: 16 }}>Crawler processes</h2>
      {m.processes.length === 0 ? (
        <p style={{ fontSize: 13 }}>No process is reporting. Crawls run where the site-crawl worker runs; each one sends a heartbeat every 5 s.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Process", "Crawls", "CPU", "RSS", "Pages / s", "Batch writes", "Write p95 / max", "DB pool"].map((h) => (
                <th key={h} style={cell}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.processes.map((p) => (
              <tr key={p.id} data-process={p.id}>
                <td style={cell}>
                  {p.role}
                  {p.instance === null ? "" : ` #${p.instance}`} · pid {p.pid}
                </td>
                <td style={cell}>
                  {p.active} / {p.concurrency}
                </td>
                <td style={cell}>{p.cpuPct}%</td>
                <td style={cell}>{n(p.rssMb)} MB</td>
                <td style={cell}>{p.pagesPerSec}</td>
                <td style={cell}>{n(p.writes)}</td>
                <td style={cell}>{p.writeMs ? `${p.writeMs.p95} / ${p.writeMs.max} ms` : "—"}</td>
                <td style={cell}>{p.db ? `${p.db.total} open, ${p.db.waiting} waiting` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Postgres connections</h2>
      <p style={{ fontSize: 13 }}>
        Budget {n(m.db.budget)} (under 60% of max_connections {n(m.db.maxConnections)}): web {m.db.web}, workers {m.db.workers}
        {m.db.crawlerProcesses ? `, ${m.db.crawlerProcesses} crawler processes × ${m.db.perCrawler}` : ", crawls inside the workers"} = {n(m.db.total)}.
        Render contexts configured: {m.renderContextsConfigured}.
      </p>
    </main>
  );
}
