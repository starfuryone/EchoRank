// /admin/sales-inquiries — sales inquiries from /{locale}/enterprise/contact.
// Staff only (PLATFORM_ADMIN_EMAILS); anyone else gets a 404. Filter with
// ?status=new|contacted|closed; the select on each row changes it. Closed
// inquiries are deleted 24 months after closing (src/lib/sales/inquiries.ts).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { platformAdmin } from "@/lib/platform-admin";
import { INQUIRY_RETENTION_MONTHS, listInquiries, type InquiryStatusValue } from "@/lib/sales/inquiries";
import { SALES_COPY } from "@/lib/sales/inquiry-copy";
import { StatusSelect } from "./status-select";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sales inquiries · admin", robots: { index: false, follow: false } };

const FILTERS = ["all", "new", "contacted", "closed"] as const;
const en = SALES_COPY.en;
const utc = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace("T", " ") : "—");

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  if (!(await platformAdmin())) notFound();
  const raw = ((await searchParams).status ?? "all").toLowerCase();
  const filter = (FILTERS as readonly string[]).includes(raw) ? raw : "all";
  const rows = await listInquiries(filter === "all" ? undefined : (filter.toUpperCase() as InquiryStatusValue));
  const cell = { padding: "6px 10px", borderBottom: "1px solid #8884", textAlign: "left" as const, fontSize: 13, verticalAlign: "top" as const };

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 1400, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22 }}>Sales inquiries</h1>
      <p style={{ color: "#888", fontSize: 13 }}>
        From /enterprise/contact. Reply from the support@ email (reply-to is the submitter). Closed inquiries are deleted{" "}
        {INQUIRY_RETENTION_MONTHS} months after closing.
      </p>
      <nav style={{ display: "flex", gap: 16, margin: "12px 0 16px" }} aria-label="Filter by status">
        {FILTERS.map((f) => (
          <Link key={f} href={f === "all" ? "/admin/sales-inquiries" : `/admin/sales-inquiries?status=${f}`} style={{ fontWeight: f === filter ? 700 : 400 }}>
            {f}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p>No inquiries{filter === "all" ? "" : ` with status ${filter}`}.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Received (UTC)", "Status", "Who", "Company", "Country", "Size", "Needs", "Message", "Source", "Contacted", "Closed"].map((h) => (
                <th key={h} style={cell}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={cell}>{utc(r.createdAt)}</td>
                <td style={cell}><StatusSelect id={r.id} status={r.status} /></td>
                <td style={cell}>
                  {r.name}
                  <br />
                  <a href={`mailto:${r.email}`}>{r.email}</a>
                  {r.marketingConsent ? <><br /><small>marketing opt-in</small></> : null}
                </td>
                <td style={cell}>
                  {r.company}
                  <br />
                  <small>{r.website}</small>
                </td>
                <td style={cell}>{r.country}{r.ipCountry && r.ipCountry !== r.country ? ` (IP ${r.ipCountry})` : ""}</td>
                <td style={cell}>{r.size}</td>
                <td style={cell}>{r.needs.map((n) => en.needOptions[n as keyof typeof en.needOptions] ?? n).join(", ") || "—"}</td>
                <td style={{ ...cell, maxWidth: 360, whiteSpace: "pre-wrap" }}>{r.message ?? "—"}</td>
                <td style={cell}>
                  {r.source ?? "—"}
                  {r.referrer ? <><br /><small>{r.referrer}</small></> : null}
                  <br />
                  <small>{r.locale}</small>
                </td>
                <td style={cell}>{utc(r.contactedAt)}</td>
                <td style={cell}>{utc(r.closedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
