// /[locale]/free-tools/site-crawler/r/<token> — a free crawl's result. Public
// to whoever holds the link, never indexed, gone after FREE_CRAWL_RETENTION_DAYS
// (404). While the crawl is queued or running it shows the progress view; once
// it has ended: the lockup, host, pages crawled, Site health, kind totals and
// the top FREE_FIX_FIRST rules. The full list and the CSV are only rendered for
// a browser holding this result's unlock cookie (free-result.ts); everyone else
// gets a placeholder and the email form. Behind crawl.free.

import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isSupportedLocale } from "@/lib/i18n/config";
import { flag } from "@/lib/flags";
import { FREE_TOOLS_BASE, ctaHref, freeToolById } from "@/lib/free-tools";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { FREE_CRAWLER_COPY, freeBase } from "@/lib/site-crawler/free-copy";
import { freeCrawlByToken, freeExpiresAt, freeFullList, freePreview, isUnlocked, paidCrawlCeiling, unlockCookieName } from "@/lib/site-crawler/free-result";
import { PublicFooter } from "@/components/PublicFooter";
import { NosyBatLogo } from "@/components/brand/NosyBatLogo";
import { PublicNav } from "../../../../PublicNav";
import { FreeResultProgress, FreeUnlockForm, ShareResultButton } from "../../result-client";
import s from "../../../../home2.module.css";
import f from "../../../_shared/free-tools.module.css";
import c from "../../../../site-crawler/site-crawler.module.css";

export const dynamic = "force-dynamic";

const TOOL = freeToolById("site_crawler");

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = FREE_CRAWLER_COPY[freeBase(locale)];
  return { title: `${t.result.kicker.toLowerCase()} · ${t.name}`, robots: { index: false, follow: false } };
}

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string; token: string }>; searchParams: Promise<{ reused?: string }> }) {
  const { locale, token } = await params;
  if (!isSupportedLocale(locale) || !flag("crawl.free")) notFound();
  const row = await freeCrawlByToken(token);
  if (!row) notFound();
  const { reused } = await searchParams;
  const t = FREE_CRAWLER_COPY[freeBase(locale)];
  const r = t.result;
  const fr = freeBase(locale) === "fr";
  const int = new Intl.NumberFormat(fr ? "fr-CA" : "en-US");
  const date = new Intl.DateTimeFormat(fr ? "fr-CA" : "en-US", { dateStyle: "long" }).format(freeExpiresAt(row));
  const status = row.crawlJob.status;
  const ended = status === "COMPLETED" || status === "FAILED" || status === "CANCELLED";
  const unlocked = isUnlocked(row.token, (await cookies()).get(unlockCookieName(row.token))?.value);
  const p = status === "COMPLETED" ? freePreview(row) : null;
  const full = p && unlocked ? freeFullList(row) : null;

  return (
    <div className={s.page}>
      <PublicNav locale={locale} />
      <section className={s.section}>
        <div className={s.container}>
          <div className={c.lockup} data-testid="free-result-lockup">
            <NosyBatLogo height={36} alt={CRAWLER_BRAND.name} tone="dark" themed />
            <p className={c.byline}>{r.byline}</p>
          </div>
          <p className={s.label}>
            <b>{r.kicker}</b>
          </p>
          <h1 className={f.heroH1} data-testid="free-result-host">
            {row.host}
          </h1>

          <div className={f.toolWide} style={{ display: "grid", gap: 18, marginTop: 18 }}>
            {!ended && <FreeResultProgress token={row.token} locale={locale} reused={reused === "1"} />}

            {ended && !p && (
              <div className={f.panel}>
                <p>{t.progress.failed}</p>
                <Link className={`${s.btn} ${s.btnPrimary}`} href={`/${locale}${FREE_TOOLS_BASE}/${TOOL.slug}`}>
                  {r.again}
                </Link>
              </div>
            )}

            {p && (
              <>
                {reused === "1" && <p className={f.note}>{t.progress.reused}</p>}
                <div className={f.panel} data-testid="free-result-summary">
                  <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, margin: 0 }}>
                    <div>
                      <dt className={f.label}>{r.pagesCrawled}</dt>
                      <dd className={f.scoreBig} style={{ margin: 0 }}>
                        {int.format(p.pagesCrawled)}
                      </dd>
                    </div>
                    <div>
                      <dt className={f.label}>{r.health}</dt>
                      <dd className={f.scoreBig} style={{ margin: 0 }} data-testid="free-result-health">
                        {p.health ?? "–"}
                        <span className={f.note} style={{ fontSize: 14 }}>
                          {" "}
                          / 100
                        </span>
                      </dd>
                    </div>
                    {(["issue", "warning", "opportunity"] as const).map((k) => (
                      <div key={k} data-kind={k}>
                        <dt className={f.label}>{r.kinds[k]}</dt>
                        <dd className={f.scoreBig} style={{ margin: 0, fontSize: 30 }}>
                          {int.format(p.byKind[k])}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className={f.note}>
                    {r.healthHelp}
                    {p.stoppedReason && r.stopped[p.stoppedReason] ? ` ${r.stopped[p.stoppedReason]}` : ""}
                  </p>
                </div>

                <div className={f.panel}>
                  <h2 className={f.resultH}>{r.fixFirst}</h2>
                  <p className={f.note} style={{ marginTop: 0 }}>
                    {r.fixFirstHelp}
                  </p>
                  {p.fixFirst.length === 0 ? (
                    <p>{r.fixFirstNone}</p>
                  ) : (
                    <ol className={f.results} data-testid="free-fix-first">
                      {p.fixFirst.map((it) => (
                        <li key={it.ruleId} className={f.result} data-rule={it.ruleId}>
                          <h3 className={f.resultH}>{it.name}</h3>
                          {it.why && <p style={{ margin: "2px 0 6px", fontSize: 14 }}>{it.why}</p>}
                          <span className={f.resultMeta}>
                            {r.pages(int.format(it.pages))} · {r.findings(int.format(it.count))}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <div className={f.panel} data-testid="free-full-list" data-locked={full ? "false" : "true"}>
                  <h2 className={f.resultH}>{r.fullTitle}</h2>
                  <p className={f.note} style={{ marginTop: 0 }}>
                    {r.fullHelp}
                  </p>
                  {full ? (
                    <>
                      <ul className={f.results}>
                        {full.map((x) => (
                          <li key={x.ruleId} className={f.result} data-rule={x.ruleId}>
                            <h3 className={f.resultH}>{x.name}</h3>
                            <span className={f.resultMeta}>
                              {r.kindLabel[x.kind]} · {r.priority[x.priority]} · {r.pages(int.format(x.pages))} · {r.findings(int.format(x.count))}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p style={{ marginTop: 16 }}>
                        <a className={`${s.btn} ${s.btnPrimary}`} href={`/api/free/v1/site-crawler/${encodeURIComponent(row.token)}/export`} data-testid="free-csv">
                          {r.csv}
                        </a>
                      </p>
                    </>
                  ) : (
                    <>
                      {/* No data behind the blur: the server sent none. */}
                      <div className={`${f.results} ${f.locked}`} aria-hidden="true" style={{ filter: "blur(3px)" }}>
                        {Array.from({ length: Math.min(6, Math.max(3, p.rulesFired)) }, (_, i) => (
                          <div key={i} className={f.result}>
                            <div className={f.lockedBar} />
                            <div className={f.lockedBar} />
                            <div className={f.lockedBar} />
                          </div>
                        ))}
                      </div>
                      <p className={f.note}>{r.lockedNote}</p>
                      <FreeUnlockForm token={row.token} locale={locale} />
                    </>
                  )}
                </div>

                <div className={f.row}>
                  <ShareResultButton locale={locale} />
                  <span className={f.note} style={{ margin: 0 }}>
                    {r.kept(date)}
                  </span>
                </div>
              </>
            )}

            <div className={f.upsell} data-testid="free-cta">
              <h2 className={f.cardH} style={{ fontSize: 20 }}>
                {r.ctaTitle(paidCrawlCeiling(locale))}
              </h2>
              <p className={f.upsellP}>{r.ctaBody}</p>
              <Link className={`${s.btn} ${s.btnPrimary}`} href={ctaHref(TOOL, locale)}>
                {r.ctaButton}
              </Link>{" "}
              <Link className={s.btn} href={`/${locale}${FREE_TOOLS_BASE}/${TOOL.slug}`}>
                {r.again}
              </Link>
            </div>

            <p className={f.note} data-testid="free-crawl-abuse">
              {t.abuse}
            </p>
          </div>
        </div>
      </section>
      <PublicFooter locale={locale} />
    </div>
  );
}
