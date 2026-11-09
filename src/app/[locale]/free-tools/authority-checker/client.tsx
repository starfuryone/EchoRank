// The Link Authority Checker landing page's SAMPLE report (2026-11-09): what
// the paid tool shows, as a static example labelled "Sample". No form, no
// fetch, no state: it renders on the server and ships no JavaScript.
//
// The file keeps its old name (it held the free tool's client-side form until
// the checker became a paid tool); `git mv client.tsx sample.tsx` is safe,
// page.tsx is its only importer.
//
// Imports only dependency-free modules (copy, types).

import { AUTHORITY_COPY, authorityLocale } from "@/lib/authority-checker/copy";
import type { DomainRow, ReferringDomainRow } from "@/lib/authority-checker/types";
import f from "../_shared/free-tools.module.css";
import a from "./authority.module.css";

/** Illustrative numbers on reserved example domains, never a real site's. */
export const SAMPLE = {
  domain: "example.com",
  checkedAt: "2026-11-02T09:00:00.000Z",
  comparison: [
    { domain: "example.com", authority: 41, referringDomains: 1_284, backlinks: 23_910, dofollowShare: 0.72 },
    { domain: "example.net", authority: 48, referringDomains: 2_046, backlinks: 41_377, dofollowShare: 0.68 },
    { domain: "example.org", authority: 36, referringDomains: 903, backlinks: 12_455, dofollowShare: 0.77 },
  ] satisfies DomainRow[],
  referringDomains: [
    { domain: "news.example", authority: 78, backlinks: 14 },
    { domain: "guide.example", authority: 71, backlinks: 6 },
    { domain: "directory.example", authority: 64, backlinks: 3 },
    { domain: "association.example", authority: 59, backlinks: 2 },
    { domain: "blog.example", authority: 52, backlinks: 9 },
  ] satisfies ReferringDomainRow[],
};

export function AuthoritySample({ locale }: { locale: string }) {
  const c = AUTHORITY_COPY[authorityLocale(locale)];
  const nf = new Intl.NumberFormat(locale);
  const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(SAMPLE.checkedAt));
  const own = SAMPLE.comparison[0]!;

  return (
    <div data-testid="authority-landing">
      <div className={a.shows}>
        <h2 className={a.h3}>{c.shows.title}</h2>
        <ul>
          {c.shows.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <figure className={a.sample} data-testid="authority-sample" aria-label={`${c.sample.badge}: ${c.name}`}>
        <span className={a.sampleBadge}>{c.sample.badge}</span>
        <div className={a.result}>
          <div className={a.scoreCard}>
            <div className={a.score} aria-label={`${c.result.scoreLabel}: ${own.authority}`}>
              {own.authority}
              <span className={a.scoreDen}>{c.result.outOf}</span>
            </div>
            <div>
              <p className={a.scoreDomain}>{own.domain}</p>
              <p className={a.scoreLabel}>{c.result.scoreLabel}</p>
              <p className={a.scoreSource}>{c.result.scoreSource}</p>
            </div>
          </div>

          <div className={a.tiles}>
            <div className={a.tile}>
              <div className={a.tileV}>{nf.format(own.referringDomains)}</div>
              <div className={a.tileL}>{c.result.referringDomains}</div>
            </div>
            <div className={a.tile}>
              <div className={a.tileV}>{nf.format(own.backlinks)}</div>
              <div className={a.tileL}>{c.result.backlinks}</div>
            </div>
            <div className={a.tile} title={c.result.dofollowHint}>
              <div className={a.tileV}>{pct(own.dofollowShare)}</div>
              <div className={a.tileL}>{c.result.dofollowShare}</div>
            </div>
          </div>

          <div>
            <h3 className={a.h3}>{c.full.compTitle}</h3>
            <div className={a.tableWrap}>
              <table className={a.table}>
                <thead>
                  <tr>
                    <th>{c.full.colDomain}</th>
                    <th className={a.num}>{c.full.colAuthority}</th>
                    <th className={a.num}>{c.full.colReferring}</th>
                    <th className={a.num}>{c.full.colBacklinks}</th>
                    <th className={a.num}>{c.full.colDofollow}</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE.comparison.map((row) => (
                    <tr key={row.domain}>
                      <td>
                        {row.domain}
                        {row.domain === SAMPLE.domain && <span className={a.you}>{c.full.you}</span>}
                      </td>
                      <td className={a.num}>{row.authority}</td>
                      <td className={a.num}>{nf.format(row.referringDomains)}</td>
                      <td className={a.num}>{nf.format(row.backlinks)}</td>
                      <td className={a.num}>{pct(row.dofollowShare)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className={a.h3}>{c.full.refTitle}</h3>
            <div className={a.tableWrap}>
              <table className={a.table}>
                <thead>
                  <tr>
                    <th>{c.full.colDomain}</th>
                    <th className={a.num}>{c.full.colAuthority}</th>
                    <th className={a.num}>{c.full.colBacklinks}</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE.referringDomains.map((row) => (
                    <tr key={row.domain}>
                      <td>{row.domain}</td>
                      <td className={a.num}>{row.authority}</td>
                      <td className={a.num}>{nf.format(row.backlinks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <figcaption className={f.note}>
          {c.sample.caption} {c.result.checkedOn(date)}
        </figcaption>
      </figure>
    </div>
  );
}
