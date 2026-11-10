"use client";

// The Link Authority Checker's in-app form and report (2026-11-09). POSTs to
// /api/seo/v1/link-authority, which checks the session and the plan; the
// report is the full one (score, link counts, the comparison with up to three
// competitors, the top 10 referring domains), no email gate, with a PDF
// download (PdfButton) that uses no check.
//
// The month's usage line sits above the form. At the limit the panel shows
// used / limit, the reset date and an upgrade link; the form stays, because a
// check whose domains are all in the 7-day cache still runs and is not counted.
//
// Imports only dependency-free modules (copy, config, domains, types).

import { useState } from "react";
import { AUTHORITY_COPY, authorityLocale, type AuthorityErrorCode } from "@/lib/authority-checker/copy";
import { LINK_AUTHORITY_API, LINK_AUTHORITY_PDF_API, MAX_COMPETITORS } from "@/lib/authority-checker/config";
import { normalizeCheck } from "@/lib/authority-checker/domains";
import type { LinkAuthorityReport, LinkAuthorityUsage } from "@/lib/authority-checker/types";

const UPGRADE_HREF = "/billing";

function intlLocale(locale: string): string {
  return locale === "de-CH" ? "de-CH" : locale === "fr" ? "fr-FR" : "en-US";
}

export function LinkAuthorityClient({ locale, initialUsage }: { locale: string; initialUsage: LinkAuthorityUsage | null }) {
  const c = AUTHORITY_COPY[authorityLocale(locale)];
  const intl = intlLocale(locale);
  const [domain, setDomain] = useState("");
  const [competitors, setCompetitors] = useState<string[]>(Array(MAX_COMPETITORS).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<LinkAuthorityReport | null>(null);
  const [usage, setUsage] = useState<LinkAuthorityUsage | null>(initialUsage);

  const date = (iso: string) => new Intl.DateTimeFormat(intl, { dateStyle: "long", timeZone: "UTC" }).format(new Date(iso));
  const atLimit = usage !== null && usage.limit !== null && usage.used >= usage.limit;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input = normalizeCheck({ domain, competitors });
    if (!input.ok) {
      setError(c.errors[input.error]);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(LINK_AUTHORITY_API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ domain, competitors, locale }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 429 && data?.code === "quota" && data.usage) {
        setUsage(data.usage as LinkAuthorityUsage);
        return;
      }
      if (!res.ok || !data?.comparison) {
        const code = typeof data?.code === "string" && data.code in c.errors ? (data.code as AuthorityErrorCode) : "generic";
        setError(data?.error ?? c.errors[code]);
        return;
      }
      const r = data as LinkAuthorityReport;
      setReport(r);
      setUsage(r.usage);
    } catch {
      setError(c.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">{c.appSubtitle}</p>
        {usage && (
          <p className="mt-1 text-xs font-medium text-gray-400" data-testid="link-authority-usage">
            {usage.limit === null ? c.usage.unlimited(usage.used) : c.usage.line(usage.used, usage.limit)} {c.usage.resets(date(usage.resetsAt))}
          </p>
        )}
      </div>

      {atLimit && usage && usage.limit !== null && (
        <div role="status" data-testid="link-authority-quota" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">{c.quota.title}</p>
          <p className="mt-1 text-sm text-amber-900">{c.quota.body(usage.used, usage.limit, date(usage.resetsAt))}</p>
          <p className="mt-1 text-xs text-amber-800">{c.quota.cacheNote}</p>
          <a href={UPGRADE_HREF} className="mt-3 inline-block rounded-lg bg-amber-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800">
            {c.quota.upgrade}
          </a>
        </div>
      )}

      <form onSubmit={submit} noValidate data-testid="link-authority-form" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label htmlFor="la-domain" className="block text-sm font-medium text-gray-700">
          {c.form.domainLabel}
        </label>
        <input
          id="la-domain"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          inputMode="url"
          autoComplete="url"
          required
          maxLength={300}
          placeholder={c.form.domainPlaceholder}
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
        />
        <p id="la-competitors" className="mt-4 text-sm font-medium text-gray-700">
          {c.form.competitorsLabel}
        </p>
        <div role="group" aria-labelledby="la-competitors" className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {competitors.map((value, i) => (
            <input
              key={i}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              inputMode="url"
              maxLength={300}
              aria-label={`${c.form.competitorsLabel} ${i + 1}`}
              placeholder={c.form.competitorPlaceholder(i + 1)}
              value={value}
              onChange={(e) => setCompetitors((cur) => cur.map((v, j) => (j === i ? e.target.value : v)))}
            />
          ))}
        </div>
        <button
          type="submit"
          disabled={busy || !domain.trim()}
          className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {busy ? c.form.checking : c.form.submit}
        </button>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}
      </form>

      {report && (
        <>
          <PdfButton report={report} locale={locale} />
          <Report report={report} locale={locale} />
        </>
      )}
    </div>
  );
}

/**
 * Download the report as a PDF (POST …/pdf). The server rebuilds it from the
 * 7-day cache, so it costs no check; past the cache it says to run it again.
 */
function PdfButton({ report, locale }: { report: LinkAuthorityReport; locale: string }) {
  const c = AUTHORITY_COPY[authorityLocale(locale)];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(LINK_AUTHORITY_PDF_API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ domain: report.domain, competitors: report.competitors, checkedAt: report.checkedAt, locale }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const code = typeof data?.code === "string" && data.code in c.errors ? (data.code as AuthorityErrorCode) : "pdf_failed";
        setError(data?.error ?? c.errors[code]);
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `Echorank-Link-Authority-${report.domain.replace(/[^a-z0-9.-]/gi, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError(c.errors.pdf_failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        data-testid="link-authority-pdf"
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
      >
        {busy ? c.pdf.preparing : c.pdf.download}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function Report({ report, locale }: { report: LinkAuthorityReport; locale: string }) {
  const c = AUTHORITY_COPY[authorityLocale(locale)];
  const intl = intlLocale(locale);
  const nf = new Intl.NumberFormat(intl);
  const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);
  const checked = new Intl.DateTimeFormat(intl, { dateStyle: "medium" }).format(new Date(report.checkedAt));

  return (
    <div className="space-y-6" data-testid="link-authority-report">
      <div className="flex flex-wrap items-center gap-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="text-5xl font-bold tabular-nums text-gray-900" aria-label={`${c.result.scoreLabel}: ${report.authority ?? c.result.noRank}`}>
          {report.authority ?? "—"}
          <span className="ml-1 text-base font-medium text-gray-400">{c.result.outOf}</span>
        </div>
        <div className="min-w-0">
          <p className="truncate font-mono text-sm text-gray-500">{report.domain}</p>
          <p className="text-lg font-semibold text-gray-900">{report.authority === null ? c.result.noRank : c.result.scoreLabel}</p>
          <p className="text-xs text-gray-500">{c.result.scoreSource}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          [nf.format(report.links.referringDomains), c.result.referringDomains],
          [nf.format(report.links.backlinks), c.result.backlinks],
          [pct(report.links.dofollowShare), c.result.dofollowShare],
        ].map(([v, l]) => (
          <div key={l} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-2xl font-bold tabular-nums text-gray-900">{v}</div>
            <div className="text-xs text-gray-500">{l}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        {c.result.checkedOn(checked)} {c.result.dofollowHint} {report.cached && <span data-testid="link-authority-cached">{c.result.cached}</span>}
      </p>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">{c.full.compTitle}</h3>
        {report.comparison.length > 1 ? (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">{c.full.colDomain}</th>
                  <th className="px-3 py-2 text-right">{c.full.colAuthority}</th>
                  <th className="px-3 py-2 text-right">{c.full.colReferring}</th>
                  <th className="px-3 py-2 text-right">{c.full.colBacklinks}</th>
                  <th className="px-3 py-2 text-right">{c.full.colDofollow}</th>
                </tr>
              </thead>
              <tbody>
                {report.comparison.map((row) => (
                  <tr key={row.domain} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      {row.domain}
                      {row.domain === report.domain && <span className="ml-2 text-[11px] uppercase tracking-wide text-blue-600">{c.full.you}</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.authority ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{nf.format(row.referringDomains)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{nf.format(row.backlinks)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct(row.dofollowShare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">{c.full.compNone}</p>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">{c.full.refTitle}</h3>
        {report.referringDomains.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">{c.full.colDomain}</th>
                  <th className="px-3 py-2 text-right">{c.full.colAuthority}</th>
                  <th className="px-3 py-2 text-right">{c.full.colBacklinks}</th>
                </tr>
              </thead>
              <tbody>
                {report.referringDomains.map((row) => (
                  <tr key={row.domain} className="border-t border-gray-100">
                    <td className="px-3 py-2">{row.domain}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.authority ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{nf.format(row.backlinks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">{c.full.refEmpty}</p>
        )}
      </section>
    </div>
  );
}
