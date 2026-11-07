// /[locale]/enterprise: the page for agencies and multi-location brands.
//
// A React page, not a standalone payload. It was one (a route handler serving
// a complete HTML document) and that left it with its own small top bar and
// no way into the rest of the site. Now it carries the shared PublicNav (its
// Enterprise item marked current), the Enterprise sub-nav under it (the
// sections below, sticky) and the shared footer. The body is the draft's
// (/opt/echorank/prompts/echorank-enterprise.html, 2026-11-07), English on
// every locale, so the canonical is the en URL; its styles are scoped in
// enterprise.module.css.
//
// Kept from the payload: every "Talk to us" goes to the sales form with
// ?src= naming the button; the crawler's name comes from brand.ts and the AI
// label from the AI-labels catalog. New: the plan numbers come from
// PLAN_CONFIGS instead of being typed into the copy.
import { Fragment, type ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUPPORTED_LOCALES, isSupportedLocale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { AI_LABELS } from "@/lib/i18n/ai-labels";
import { COMPANY } from "@/lib/brand/company";
import { PLAN_CONFIGS, TRIAL_DAYS } from "@/lib/plan-config";
import { salesContactHref } from "@/lib/sales/inquiry-options";
import { PublicNav } from "../PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import s from "../home2.module.css";
import e from "./enterprise.module.css";
import { EnterpriseSubnav } from "./EnterpriseSubnav";
import type { EnterpriseSectionId } from "./sections";

export const dynamic = "force-static";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

const TITLE = "Echorank Enterprise";
const DESCRIPTION =
  "Echorank for agencies and multi-location brands: reviews, AI answers and technical SEO for every client and location in one workspace.";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  return buildMetadata({ locale, path: "/enterprise", title: TITLE, description: DESCRIPTION, canonicalLocale: "en" });
}

const n = (v: number) => v.toLocaleString("en-US");
/** A section the sub-nav links to: the id is typed against sections.ts. */
const sid = (id: EnterpriseSectionId) => id;

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();

  const agency = PLAN_CONFIGS.AGENCY;
  const q = agency.quotaDefaults;
  const crawler = CRAWLER_BRAND.nameTm;
  const talk = (src: string) => salesContactHref(locale, src);
  const L = (p: string) => `/${locale}${p}`;

  return (
    <div className={s.page}>
      <PublicNav locale={locale} current="enterprise" />
      <EnterpriseSubnav locale={locale} page="overview" />

      <main className={e.root}>
        <header className={e.hero}>
          <div className={`${e.wrap} ${e.heroGrid}`}>
            <div>
              <div className={e.eyebrow}>For agencies &amp; multi-location brands</div>
              <h1>
                Echorank <span>Enterprise</span>
              </h1>
              <p className={e.lead}>
                One workspace where your team tracks reviews, AI answers and technical SEO for every client and every
                location, then proves the fixes worked.
              </p>
              <div className={e.ctas}>
                <a className={`${e.btn} ${e.btnY}`} href={talk("enterprise-hero")}>
                  Talk to us
                </a>
                <a className={`${e.btn} ${e.btnO}`} href={L("/pricing")}>
                  See the Agency plan
                </a>
              </div>
              <p className={e.fine}>
                Agency from ${n(agency.monthlyPrice)}/month · {TRIAL_DAYS}-day free trial · priced per workspace, not
                per seat
              </p>
            </div>

            <div
              className={e.panel}
              role="img"
              aria-label="Sample workspace showing four clients with AI mention rate, rating and site health"
            >
              <div className={e.panelH}>
                <div className={e.dots}>
                  <b />
                  <b />
                  <b />
                </div>
                <span>Portfolio · sample data</span>
              </div>
              <table className={e.ws}>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>AI mentions</th>
                    <th className={e.hideS}>Rating</th>
                    <th>Site health</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_CLIENTS.map((row) => (
                    <tr key={row.name}>
                      <td className={e.n}>{row.name}</td>
                      <td>
                        <svg className={e.spark} viewBox="0 0 84 26" aria-hidden="true" focusable="false">
                          <polyline points={row.spark} fill="none" stroke={row.stroke} strokeWidth="2" />
                        </svg>{" "}
                        {row.mentions}
                      </td>
                      <td className={e.hideS}>{row.rating} ★</td>
                      <td>
                        <span className={`${e.pill} ${e[row.health]}`}>{row.score}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className={e.panelF}>Illustration with invented clients. Your workspace shows your own.</div>
            </div>
          </div>
        </header>

        <div className={e.strip} aria-label="What one workspace covers">
          <div className={e.wrap}>
            <span>Reputation</span>
            <span>AI visibility</span>
            <span>{crawler} crawler</span>
            <span>SEO data</span>
            <span>Reports</span>
            <span>API &amp; MCP</span>
          </div>
        </div>

        <section className={e.statement}>
          <div className={e.wrap}>
            <div className={e.eyebrow}>Why it matters</div>
            <h2 style={{ marginTop: 14 }}>You can&apos;t manage a reputation you can&apos;t see.</h2>
            <p className={e.lead}>
              Customers read reviews. AI assistants read them too, along with your site, directories and forums, and
              then recommend a handful of businesses. Echorank shows what both are saying about each client, where the
              gaps are, and which fix matters first.
            </p>
          </div>
        </section>

        <section className={e.alt} id={sid("crawler")}>
          <div className={e.wrap}>
            <div className={e.split}>
              <div>
                <div className={e.eyebrow}>Hosted crawling</div>
                <h2>{crawler} crawls on our servers, not your laptop.</h2>
                <p className={e.lead}>
                  Schedule crawls for every client, compare each run with the last, and get the results by email. Every
                  finding shows the evidence the rule saw, so your team can check it before a developer touches the
                  site.
                </p>
              </div>
              <div>
                <Finding
                  title="Canonical points to a redirect"
                  rows={[
                    ["Page", "/shoes/running?color=blue"],
                    ["Evidence", "canonical → /shoes/running/ → 301 → /running-shoes/"],
                  ]}
                  fix="Point the canonical at the final URL."
                />
                <Finding
                  title="Broken internal link"
                  rows={[
                    ["Link", "/spring-promo → 404"],
                    ["Evidence", "found on 37 pages, incl. /, /blog/"],
                  ]}
                  fix="Update the links or redirect the old URL."
                />
              </div>
            </div>
            <div className={e.stats}>
              <div className={e.stat}>
                <b>340+</b>
                <span>checks per crawl, with evidence on every finding</span>
              </div>
              <div className={e.stat}>
                <b>{n(agency.crawlUrlCap)}</b>
                <span>URLs per crawl on Agency, custom on Enterprise</span>
              </div>
              <div className={e.stat}>
                <b>{agency.crawlsPerMonth === null ? "∞" : n(agency.crawlsPerMonth)}</b>
                <span>crawls a month on Agency, scheduled or on demand</span>
              </div>
              <div className={e.stat}>
                <b>0</b>
                <span>installs. Your whole team works from the same results</span>
              </div>
            </div>
          </div>
        </section>

        <section id={sid("features")}>
          <div className={e.wrap}>
            <div className={e.eyebrow}>Built for teams</div>
            <h2 style={{ marginTop: 14, maxWidth: 820 }}>Larger teams need more than a dashboard.</h2>
            <div className={e.grid5}>
              {[
                ["White-label workspace", "Your logo and your domain on the dashboard clients log into."],
                [`${q.maxLocations} locations`, "Reviews, requests and tracking per location, rolled up per brand."],
                [
                  "Review requests at volume",
                  `${n(q.maxRequestsPerMonth)} email and SMS requests a month, with templates and campaigns.`,
                ],
                ["Recovery tickets", "Catch unhappy customers before they post, and track each case to closed."],
                ["Competitor tracking", "Follow rivals' ratings and review counts over time."],
                ["Crawl comparison", "Daily, weekly or monthly crawls. See what broke and what got fixed."],
                ["Custom extraction", "Pull prices, SKUs, schema or any field with CSS, XPath or regex."],
                ["Search Console inside", "Clicks, impressions and index status joined to every crawled page."],
                ["PDF reports", "A ready-to-send report for every crawl and audit."],
                ["No per-seat pricing", "Invite the whole team. Plans are priced per workspace."],
              ].map(([title, body], i) => (
                <div key={title} className={e.card}>
                  <span className={e.ix}>{String(i + 1).padStart(2, "0")}</span>
                  <h4>{title}</h4>
                  <p>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={e.alt}>
          <div className={e.wrap}>
            <div className={e.eyebrow}>AI where it saves time</div>
            <h2 style={{ marginTop: 14, maxWidth: 860 }}>AI does the busywork. Your team makes the calls.</h2>
            <div className={e.grid3}>
              <div className={e.ai}>
                <Icon>
                  <path d="M21 12a9 9 0 1 1-3-6.7" />
                  <path d="M21 4v5h-5" />
                </Icon>
                <h4>AI answer tracking</h4>
                <p>See when AI assistants name your client, who they name instead, and which sources they cite.</p>
              </div>
              <div className={e.ai}>
                <Icon>
                  <path d="M4 20h4L19 9l-4-4L4 16z" />
                  <path d="M14 6l4 4" />
                </Icon>
                <h4>Review reply drafts</h4>
                <p>
                  A drafted reply for every review, in your client&apos;s tone. Your team approves before anything is
                  posted.
                </p>
                <span className={e.tag}>{AI_LABELS.en.draftedByAi}</span>
              </div>
              <div className={e.ai}>
                <Icon>
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </Icon>
                <h4>AI Lens</h4>
                <p>
                  Compare what AI crawlers read on a page with what visitors see, and find the content that only appears
                  with JavaScript.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id={sid("api")}>
          <div className={e.wrap}>
            <div className={e.eyebrow}>API &amp; automation</div>
            <h2 style={{ marginTop: 14, maxWidth: 860 }}>Put Echorank data where your team already works.</h2>
            <div className={e.api}>
              <div className={e.box}>
                <h3>REST API</h3>
                <p>Pull visibility, audits and crawl results into your own dashboards and client reports.</p>
                <pre>
                  <span className={e.c}># Latest AI visibility summary for a workspace</span>
                  {"\n"}
                  <span className={e.k}>curl</span>
                  {" https://echorank360.com/api/public/v1/visibility/summary \\\n  -H "}
                  <span className={e.s}>{'"Authorization: Bearer er_api_…"'}</span>
                </pre>
                <div className={e.mini}>
                  <div>
                    <b>{n(q.maxApiRequestsPerDay)}</b>
                    <span>requests a day on Agency</span>
                  </div>
                  <div>
                    <b>CSV</b>
                    <span>export on every table</span>
                  </div>
                </div>
              </div>
              <div className={e.box}>
                <h3>MCP server</h3>
                <p>Let any MCP-compatible AI assistant query your Echorank data in plain language.</p>
                <div className={e.tools}>
                  <code>get_visibility_summary</code>
                  <code>get_latest_audit</code>
                  <code>suggest_keywords</code>
                  <code>get_crawl_summary</code>
                </div>
                <ul className={e.list} style={{ marginTop: 24 }}>
                  <li>Same API key and limits as the REST API</li>
                  <li>Read-only, scoped to one workspace</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className={e.alt} id={sid("security")}>
          <div className={e.wrap}>
            <div className={e.split} style={{ alignItems: "start" }}>
              <div>
                <div className={e.eyebrow}>Enterprise</div>
                <h2 style={{ marginTop: 14 }}>Need more than Agency?</h2>
                <ul className={e.list}>
                  <li>
                    <span>
                      <b>Custom limits</b> for locations, crawls, URLs per crawl and API calls.
                    </span>
                  </li>
                  <li>
                    <span>
                      <b>Annual billing</b> on one invoice for the whole workspace.
                    </span>
                  </li>
                  <li>
                    <span>
                      <b>A Data Processing Agreement</b> for your legal team.
                    </span>
                  </li>
                  <li>
                    <span>
                      <b>A call to plan your rollout</b> across clients and locations.
                    </span>
                  </li>
                </ul>
                <div className={e.ctas}>
                  <a className={`${e.btn} ${e.btnY}`} href={talk("enterprise-more-than-agency")}>
                    Talk to us
                  </a>
                </div>
              </div>
              <div className={e.grid3} style={{ gridTemplateColumns: "1fr", marginTop: 0, gap: 14 }}>
                <div className={`${e.ai} ${e.sec}`}>
                  <Icon>
                    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
                  </Icon>
                  <h4>UK company, UK GDPR</h4>
                  <p>
                    {COMPANY.name}, registered in {COMPANY.jurisdiction}. Data export, deletion and a complaints process
                    built in.
                  </p>
                </div>
                <div className={`${e.ai} ${e.sec}`}>
                  <Icon>
                    <path d="M12 3v12" />
                    <path d="M7 10l5 5 5-5" />
                    <path d="M5 21h14" />
                  </Icon>
                  <h4>Your data stays yours</h4>
                  <p>Export everything at any time. We don&apos;t train AI models on your data.</p>
                </div>
                <div className={`${e.ai} ${e.sec}`}>
                  <Icon>
                    <rect x="3" y="4" width="18" height="6" rx="1.5" />
                    <rect x="3" y="14" width="18" height="6" rx="1.5" />
                  </Icon>
                  <h4>Backed up off-site, daily</h4>
                  <p>Nightly database backups to a separate cloud provider.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className={e.wrap}>
            <div className={e.eyebrow}>Proof you can check</div>
            <h2 style={{ marginTop: 14, maxWidth: 860 }}>Don&apos;t take our word for it. Run it on a client&apos;s site.</h2>
            <div className={e.proof}>
              <a href={L("/free-audit")}>
                <div className={e.eyebrow}>Free · no account</div>
                <h3>AI visibility audit</h3>
                <p>A score from 0 to 100 for how ready a site is for AI search, with every check explained.</p>
                <span className={e.go}>Run the audit →</span>
              </a>
              <a href={L("/free-tools/site-crawler")}>
                <div className={e.eyebrow}>Free · 100 pages</div>
                <h3>{crawler} crawl</h3>
                <p>The full rule library on 100 pages, with the five problems to fix first.</p>
                <span className={e.go}>Crawl 100 pages →</span>
              </a>
            </div>
          </div>
        </section>

        <section className={e.cta} id="contact">
          <div className={e.wrap}>
            <h2>Let&apos;s talk.</h2>
            <p className={e.lead}>
              Tell us how many clients, locations and sites you manage. We&apos;ll tell you which plan fits, or set
              custom limits.
            </p>
            <div className={e.ctas}>
              <a className={`${e.btn} ${e.btnY}`} href={talk("enterprise-cta")}>
                Talk to us
              </a>
              <a className={`${e.btn} ${e.btnO}`} href={L("/pricing")}>
                See plans
              </a>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter locale={locale} />
    </div>
  );
}

/** The hero's invented portfolio. Health names a pill class in the module. */
const SAMPLE_CLIENTS: Array<{
  name: string;
  spark: string;
  stroke: string;
  mentions: string;
  rating: string;
  health: "pOk" | "pWarn" | "pBad";
  score: number;
}> = [
  { name: "Northside Dental", spark: "0,20 14,18 28,19 42,13 56,11 70,7 84,5", stroke: "#0ECB81", mentions: "62%", rating: "4.8", health: "pOk", score: 91 },
  { name: "Harbor Plumbing", spark: "0,8 14,9 28,12 42,11 56,15 70,17 84,19", stroke: "#F6465D", mentions: "18%", rating: "4.2", health: "pWarn", score: 74 },
  { name: "Cedar Law Group", spark: "0,16 14,15 28,15 42,14 56,13 70,13 84,12", stroke: "#F0B90B", mentions: "35%", rating: "4.6", health: "pOk", score: 88 },
  { name: "Lumen Fitness", spark: "0,22 14,21 28,17 42,18 56,12 70,10 84,9", stroke: "#0ECB81", mentions: "47%", rating: "4.4", health: "pBad", score: 58 },
];

function Finding({ title, rows, fix }: { title: string; rows: Array<[string, string]>; fix: string }) {
  return (
    <div className={e.finding}>
      <div className={e.findingH}>
        <h4>{title}</h4>
        <span className={`${e.pill} ${e.pBad}`}>Issue</span>
      </div>
      <dl className={e.kv}>
        {rows.map(([k, v]) => (
          <Fragment key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </Fragment>
        ))}
        <dt>Fix</dt>
        <dd className={e.fix}>{fix}</dd>
      </dl>
    </div>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <div className={e.icon}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {children}
      </svg>
    </div>
  );
}
