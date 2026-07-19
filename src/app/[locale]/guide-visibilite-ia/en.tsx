import Link from "next/link";
import { existsSync } from "node:fs";
import { join } from "node:path";
import s from "./guide-ia.module.css";
import { CONTENT } from "@/lib/i18n/content";
import { isSupportedLocale } from "@/lib/i18n/config";
import Checklist from "./checklist";
import RevenueCalculator from "./calculator";
import BackButton from "../legal/back-button";
import { GuideHeroArt, SerpToAnswerArt, ChecklistArt, CrawlerGateArt, ReviewPulseArt } from "./art";
import { JsonLd } from "@/lib/seo";

export const TITLE_EN = "The complete guide to AI visibility in 2026";
export const SUBTITLE_EN = "How to get recommended by ChatGPT, Google AI, Gemini, Claude and Perplexity.";
export const DESC_EN = "The reference manual on AI visibility and Generative Engine Optimization (GEO): how to appear in ChatGPT, how to get recommended by AI, AI search optimization, with an audit framework and a practical checklist.";

type Foot = { copyright: string; links: { label: string; href: string }[] };

function Cta({ label }: { label?: string }) {
  return (
    <div className={s.ctaBand}>
      <span className={s.ctaText}>
        <b>Assess your business for free</b>
        <span>Get your EchoRank score in under 60 seconds.</span>
      </span>
      <Link href="/register" className={s.ctaBtn}>{label ?? "Run my AI visibility audit →"}</Link>
    </div>
  );
}
function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.callout}>
      <div className={s.calloutTag}>📊 Did you know?</div>
      <p className={s.calloutText}>{children}</p>
    </div>
  );
}
function Figure({ file, caption }: { file: string; caption: string }) {
  if (!existsSync(join(process.cwd(), "public", "guide", file))) return null;
  return (
    <figure className={s.figure}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/guide/${file}`} alt={caption} loading="lazy" />
      <figcaption className={s.figcap}>{caption}</figcaption>
    </figure>
  );
}
function RecoFlowDiagram() {
  return (
    <div className={s.diagram} aria-label="The path of an AI recommendation" role="img">
      <svg viewBox="0 0 560 300" xmlns="http://www.w3.org/2000/svg">
        {["The customer asks a question", "The AI assistant (ChatGPT, Gemini...)", "The sources the AI consults and cites", "Your business is in them... or not"].map((t, i) => (
          <g key={i}>
            <rect x="120" y={12 + i * 74} width="320" height="44" className={s.dbox} rx="8" />
            <text x="280" y={39 + i * 74} textAnchor="middle" className={s.dtext}>{t}</text>
            {i < 3 && <line x1="280" y1={56 + i * 74} x2="280" y2={86 + i * 74} className={`${s.dgold} ${s.dflow}`} />}
          </g>
        ))}
      </svg>
    </div>
  );
}
function ReputationFlowDiagram() {
  const sources = ["Google reviews", "Facebook", "Trustpilot", "Website", "Press", "Schema.org"];
  return (
    <div className={s.diagram} aria-label="The sources that build the reputation AI reads" role="img">
      <svg viewBox="0 0 560 320" xmlns="http://www.w3.org/2000/svg">
        {sources.map((t, i) => {
          const x = 10 + (i % 3) * 185;
          const y = i < 3 ? 12 : 66;
          return (
            <g key={t}>
              <rect x={x} y={y} width="170" height="38" className={s.dbox} rx="8" />
              <text x={x + 85} y={y + 24} textAnchor="middle" className={s.dtext}>{t}</text>
              <line x1={x + 85} y1={y + 38} x2="280" y2="150" className={s.dln} />
            </g>
          );
        })}
        <rect x="150" y="150" width="260" height="44" className={s.dbox} rx="8" />
        <text x="280" y="177" textAnchor="middle" className={s.dtext}>Reputation as AI reads it</text>
        <line x1="280" y1="194" x2="280" y2="238" className={`${s.dgold} ${s.dflow}`} />
        <rect x="120" y="238" width="320" height="44" className={s.dbox} rx="8" />
        <text x="280" y="265" textAnchor="middle" className={s.dtext}>ChatGPT and other AI recommendations</text>
      </svg>
    </div>
  );
}
function TrendGrid() {
  const items = ["AI visibility", "Review velocity", "AI citations", "Qualified leads"];
  return (
    <div className={s.diagram} aria-label="Expected trends after fixes" role="img">
      <svg viewBox="0 0 560 120" xmlns="http://www.w3.org/2000/svg">
        {items.map((t, i) => (
          <g key={t}>
            <path d={`M ${40 + i * 135} 84 L ${90 + i * 135} 40`} className={s.dgold} />
            <path d={`M ${82 + i * 135} 40 L ${90 + i * 135} 40 L ${90 + i * 135} 48`} className={s.dgold} />
            <text x={65 + i * 135} y="106" textAnchor="middle" className={s.dtext}>{t} ↑</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
function CompareTable({ head, rows }: { head: [string, string]; rows: [string, string][] }) {
  return (
    <table className={s.table}>
      <thead><tr><th>{head[0]}</th><th>{head[1]}</th></tr></thead>
      <tbody>{rows.map((r) => (<tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td></tr>))}</tbody>
    </table>
  );
}

const VERTICALS: { name: string; ask: string; signals: string; problems: string; steps: string }[] = [
  { name: "Dentists", ask: "\u201cWhich dentist near me accepts new patients and handles emergencies?\u201d", signals: "Reviews mentioning gentleness and wait times, a team page with credentials, online booking, an FAQ on common procedures.", problems: "Multiple listings per practitioner diluting reviews, no emergency page, hours inconsistent across platforms.", steps: "One listing per clinic, distinct treatment pages (implants, orthodontics, emergencies), MedicalClinic or Dentist schema, systematic review replies." },
  { name: "Lawyers", ask: "\u201cWhich employment lawyer represents employees in my city, and what does a consultation cost?\u201d", signals: "Explicit practice areas, articles answering real legal questions, local press mentions, verifiable bar membership.", problems: "Brochure sites with no per-area content, zero reviews out of excessive caution, jargon AI cannot connect to client questions.", steps: "One page per practice area, an FAQ in client language, Google reviews requested within ethics rules, LegalService schema." },
  { name: "Restaurants", ask: "\u201cWhere can I eat Italian tonight, with a terrace, kid-friendly?\u201d", signals: "Review volume and freshness, menus in real text (not just PDF or images), photos, attributes (terrace, vegetarian).", problems: "Image-only menus unreadable to AI, wrong holiday hours, recent reviews left unanswered.", steps: "HTML menu with Menu schema, complete Google profile attributes, post-reservation review campaigns, replies within 48 hours." },
  { name: "Plumbers", ask: "\u201cEmergency plumber available now, water leak, what is the call-out fee?\u201d", signals: "Explicit 24/7 emergency mention, detailed service area, published call-out fees, reviews citing speed.", problems: "Vague service area, no indicative prices, stale reviews, a different phone number in every directory.", steps: "A dedicated emergency page, one page per city served, identical NAP everywhere, SMS review request after every job." },
  { name: "Electricians", ask: "\u201cCertified electrician for a panel upgrade, fast quote?\u201d", signals: "Visible certifications and licences, job-site photos, reviews mentioning code compliance and tidiness, online quoting.", problems: "Licences absent from the site, no portfolio, residential and commercial mixed together.", steps: "Licence number on every page, separate residential and commercial pages, Electrician schema, post-job review requests." },
  { name: "Hotels", ask: "\u201cQuiet hotel near the centre with parking and free cancellation?\u201d", signals: "Rating consistency across platforms, management replies to criticism, a clear cancellation policy, detailed attributes.", problems: "Diverging scores between Google and booking platforms, ignored criticism, undeclared amenities.", steps: "Reply to every critique, exhaustive attributes (parking, air conditioning, pets), Hotel schema, daily multi-platform monitoring." },
  { name: "Real estate agencies", ask: "\u201cWhich agency sells homes best in my neighbourhood, and at what fee?\u201d", signals: "Reviews from both sellers and buyers, neighbourhood knowledge shown through content, fee transparency, agent profiles.", problems: "Reviews concentrated on one star agent, generic content with no local anchor, hidden fees.", steps: "Per-neighbourhood pages with local data, reviews requested after every transaction, structured agent profiles, RealEstateAgent schema." },
  { name: "Clinics", ask: "\u201cWalk-in clinic open tonight, what are the wait times?\u201d", signals: "Exact hours including exceptions, precisely listed services, reviews on waiting and reception, access information.", problems: "Outdated hours (the worst signal in healthcare), vague services, no dedicated walk-in page.", steps: "Hours verified weekly, one page per service, MedicalClinic schema, empathetic and compliant review replies." },
  { name: "General contractors", ask: "\u201cReliable contractor for an extension, licensed, with verifiable references?\u201d", signals: "Licence displayed, portfolio by project type, detailed reviews citing budgets and deadlines kept, insurance mentioned.", problems: "Projects without photos or context, few reviews despite long contracts, legal information nowhere to be found.", steps: "One page per project type with before-and-after photos, licence and insurance in the footer, review request at handover, consistent local citations." },
];

const GLOSSARY: [string, string][] = [
  ["GEO (Generative Engine Optimization)", "The set of practices that increase the probability that a generative engine (ChatGPT, Gemini, Perplexity) mentions, cites or recommends your business in its answers."],
  ["AI Search", "AI-assisted search, where the user receives a written answer rather than a list of links. Visibility there is measured in mentions, not positions."],
  ["LLM (large language model)", "The statistical engine behind AI assistants. It produces text from what it has learned and, increasingly, from what it retrieves live on the web."],
  ["Citation", "The act, for an AI, of naming your business or pointing to your site as a source. It is the unit of value of AI visibility."],
  ["AI Visibility", "Your measurable presence in AI assistant answers: are you mentioned, described accurately, and recommended when a customer asks?"],
  ["AI Retrieval", "The step where the assistant fetches fresh information (web pages, listings, reviews) before writing its answer. Without access to your content, no citation is possible."],
  ["Hallucination", "A statement invented by the model. Clear, consistent public information about your business reduces the risk that an AI gets you wrong."],
  ["Embeddings", "The mathematical representation of a text's meaning, used to match a customer question to your content. Precise, well-written pages produce better matches."],
  ["Structured Data", "Standardized markup (Schema.org) that describes your business to machines: activity type, hours, reviews, FAQ. The preferred format of automated systems."],
  ["Knowledge Graph", "The knowledge base where engines connect entities, places and facts. A consistent presence across several reliable sources anchors you in it."],
  ["RAG (Retrieval-Augmented Generation)", "The architecture combining information retrieval and text generation. It is what lets an AI cite recent sources rather than only its memory."],
  ["Semantic Search", "Search by meaning rather than exact words. It rewards content that truly answers the intent, not content that repeats a keyword."],
  ["AI Overview", "The generative summary Google displays above results. Being cited there captures attention before the first classic link."],
];

const FAQ: [string, string][] = [
  ["How do I appear in ChatGPT?", "By making your business readable and trustworthy for retrieval systems: AI crawlers allowed, structured data in place, an active Google profile, recent and answered reviews, identical information everywhere. An AI visibility audit identifies precisely which points are blocking you."],
  ["Is classic SEO enough to get recommended by AI?", "No. SEO optimizes a ranking of links; AI visibility optimizes a recommendation. Backlinks matter less than trust, information consistency, and reputation measurable through reviews."],
  ["What is GEO (Generative Engine Optimization)?", "The discipline of optimizing your presence for generative engines. It covers technical access (crawlers, structure), reputation (reviews, consistency) and content (FAQ, service pages, freshness)."],
  ["How long before results show?", "Technical fixes (robots, structured data, NAP) are read on the crawlers' next passes, often within weeks. Reputation builds continuously; that is why daily tracking of AI answers beats a one-off check."],
  ["How do I know whether an AI already recommends me?", "Ask the questions your customers ask, on every assistant, regularly. Or let a platform do it daily for you: EchoRank runs your key queries against the AI engines and alerts you when you appear, are misrepresented, or disappear."],
  ["Why does ChatGPT not recommend my business?", "The most frequent causes: AI crawlers blocked by robots.txt, inconsistent information across your listings, rare or old reviews, missing structured data, pages that do not answer real questions. An AI visibility audit identifies them one by one, each with a prioritized fix."],
  ["Do Google reviews influence ChatGPT?", "Indirectly, but strongly. Assistants rely on sources that reflect your reputation: listings, review platforms, press, directories. Fresh, numerous, answered reviews strengthen the evidence file the AI consults before citing you; abandoned reviews weaken it."],
  ["How do I appear in Google AI Overview?", "The prerequisites: healthy Google indexing, content that answers questions directly, clean structured data, and not blocking Google-Extended. Nobody can guarantee placement in AI Overview, but without these foundations even eligibility is missing."],
  ["Does ChatGPT use Google?", "No. ChatGPT's browsing relies on its own systems and partner indexes, not on Google. The practical consequence: a Google-only strategy no longer covers the field; every AI crawler must be able to read your site, and every assistant is monitored separately."],
  ["What is AI visibility?", "Your measurable presence in AI assistant answers: are you mentioned, described accurately, and recommended when a customer asks? It is measured in citations and accuracy, not in positions."],
  ["What is the difference between SEO and GEO?", "SEO optimizes page rankings inside a list of links; GEO (Generative Engine Optimization) optimizes the probability that a generative engine recommends your business in a written answer. The first is won with keywords and backlinks, the second with trust, consistency and reputation."],
];

export function jsonLdEn() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", headline: TITLE_EN, description: DESC_EN, inLanguage: "en",
        dateModified: "2026-07-06", author: { "@type": "Organization", name: "EchoRank" },
        publisher: { "@type": "Organization", name: "ChatLogic Insights Ltd" } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "EchoRank", item: "https://echorank360.com/en" },
        { "@type": "ListItem", position: 2, name: TITLE_EN, item: "https://echorank360.com/en/guide-visibilite-ia" } ] },
      { "@type": "DefinedTermSet", name: "AI visibility glossary",
        hasDefinedTerm: GLOSSARY.map(([term, def]) => ({ "@type": "DefinedTerm", name: term, description: def })) },
      { "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    ],
  };
}

export default function EnGuide({ locale, foot }: { locale: string; foot: Foot }) {
  const nav = CONTENT[isSupportedLocale(locale) ? locale : "en"].nav;
  const backLabel = locale === "de-CH" ? "← Zurück" : "← Back";
  const chapters: [string, string][] = [
    ["seo-vs-ia", "1. From SEO to GEO: what changed"],
    ["comment-ia-choisit", "2. How ChatGPT chooses a business"],
    ["sources", "3. The sources AI systems read"],
    ["checklist", "4. Is your business AI-ready?"],
    ["technique", "5. Technical optimization: opening the door to AI"],
    ["reputation", "6. Reputation and reviews: the raw material of trust"],
    ["erreurs", "7. The mistakes that keep AI from recommending your business"],
    ["analyse", "8. What we analyzed"],
    ["etudes-de-cas", "9. Case studies: the optimization journey"],
    ["secteurs", "10. Industry guides"],
    ["calculateur", "11. Lost-revenue calculator"],
    ["glossaire", "12. AI visibility glossary"],
    ["faq", "13. Frequently asked questions"],
    ["ressources", "14. Downloadable resources"],
  ];

  return (
    <div className={s.page}>
      <JsonLd graph={jsonLdEn()["@graph"]} />
      <div className={s.wrap}>
        <header className={s.navbar}>
          <Link href={`/${locale}`} className={s.logoLink} aria-label="EchoRank 360, home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/echorank-logo-dark.svg" alt="ECHORANK 360" className={s.logo} />
          </Link>
          <nav className={s.navLinks} aria-label="Main">
            <Link href={`/${locale}`} className={s.navLink}>{nav.product}</Link>
            <Link href={`/${locale}#pricing`} className={s.navLink}>{nav.pricing}</Link>
            <Link href={`/${locale}#field`} className={s.navLink}>{nav.customers}</Link>
            <Link href="/login" className={s.navLink}>{nav.login}</Link>
          </nav>
          <div className={s.navRight}>
            <span className={s.switcher}>
              {nav.switcher.map((l) => (
                <Link key={l} href={`/${l}/guide-visibilite-ia`}
                  className={`${s.switchItem} ${l === locale ? s.switchActive : ""}`}>
                  {l.toUpperCase()}
                </Link>
              ))}
            </span>
            <Link href="/register" className={s.btnPrimary}>{nav.cta}</Link>
          </div>
        </header>

        <div className={s.backRow}>
          <BackButton locale={locale} label={backLabel} className={s.backBtnGrey} />
        </div>

        {locale === "de-CH" && (
          <p className={s.notice}>Dieses Referenzhandbuch ist auf Englisch und auf <Link href="/fr/guide-visibilite-ia">Französisch</Link> verfügbar.</p>
        )}

        <h1 className={s.h1}>{TITLE_EN}</h1>
        <p className={s.subtitle}>{SUBTITLE_EN}</p>
        <p className={s.updated}>Updated July 6, 2026 · EchoRank, AI reputation intelligence platform · <Link href="/fr/guide-visibilite-ia">Version française</Link></p>
        <GuideHeroArt label="An AI answer highlighting one recommendation" />

        <nav className={s.toc} aria-label="Contents">
          <div className={s.tocTitle}>Contents</div>
          {chapters.map(([id, t]) => (<a key={id} href={`#${id}`}>{t}</a>))}
        </nav>

        <h2 id="seo-vs-ia" className={s.h2}>1. From SEO to GEO: what changed</h2>
        <p className={s.p}>For twenty years, being visible meant being ranked: ten blue links and a battle for positions. AI-assisted search replaces the list with an answer. ChatGPT, Google AI, Gemini, Claude and Perplexity do not rank ten options; they recommend two or three, with reasons. That shift creates a new discipline, GEO (Generative Engine Optimization), also called AI search optimization: optimizing not for a ranking, but for a recommendation.</p>
        <p className={s.p}>The difference is not cosmetic. A classic engine evaluates pages; a generative engine evaluates a business. It cross-references your site, your reviews, your listings, the press and the directories, then decides whether it can cite you without being wrong. ChatGPT visibility is therefore won on a wider field than SEO: trust.</p>
        <CompareTable head={["Classic SEO (Google)", "AI visibility (GEO)"]}
          rows={[["Ranking of links", "Direct recommendation"], ["Backlinks", "Trust and consistency"], ["Keywords", "Reputation and reviews"], ["Click-through rate (CTR)", "Citations by AI"], ["Position number 1", "Being mentioned, or not existing"]]} />
        <Callout>When an AI recommends only three businesses, being absent from that list means losing every prospect from that search. There is no page 2 in a generated answer.</Callout>
        <CompareTable head={["Google Search", "ChatGPT and AI assistants"]}
          rows={[["Ten links to compare yourself", "A written answer, two or three names"], ["The user clicks and verifies", "The user trusts the synthesis"], ["Page-by-page optimization", "Whole-business evaluation"], ["Traffic measured in clicks", "Value measured in mentions and citations"]]} />
        <SerpToAnswerArt label="From a list of links to a single answer" />
        <Cta />

        <h2 id="comment-ia-choisit" className={s.h2}>2. How ChatGPT chooses a business</h2>
        <p className={s.p}>An AI assistant does not \u201cprefer\u201d anyone. It assembles an answer from what it can verify, and it discards what is ambiguous. Ten families of signals come up systematically in that evaluation:</p>
        <ul className={s.ul}>
          <li className={s.li}>Reputation: the volume, rating and freshness of your reviews, and how you answer them.</li>
          <li className={s.li}>Information consistency: same name, address, phone and hours everywhere. A contradiction makes citing you risky for the AI.</li>
          <li className={s.li}>Citations: your presence in credible directories, media and third-party sources.</li>
          <li className={s.li}>Customer reviews: not just the score, the content. AI systems read review text to understand what you do well.</li>
          <li className={s.li}>Authority: longevity, mentions by recognized sources, verifiable licences and certifications.</li>
          <li className={s.li}>Content quality: pages that genuinely answer questions, written for humans, usable by machines.</li>
          <li className={s.li}>Freshness: current hours, recent reviews, dated content. The most underrated signal.</li>
          <li className={s.li}>Structured data: Schema.org translates your business into the machines' native language.</li>
          <li className={s.li}>Multi-platform presence: Google, Facebook, industry platforms. Every concordant source increases confidence.</li>
          <li className={s.li}>Trust signals: HTTPS, legal pages, privacy policy, verifiable contact details.</li>
        </ul>
        <RecoFlowDiagram />
        <Figure file="chatgpt-reco.png" caption="ChatGPT recommending businesses: the answer replaces the results list." />
        <Figure file="google-ai-overview.png" caption="Google AI Overview: the generative summary captures attention before the classic links." />
        <p className={s.p}>Each of these ten signals can be verified. That is exactly what the <Link href={`/${locale}/ai-visibility`}>EchoRank AI visibility audit</Link> does: check by check, with a score and a fix roadmap.</p>
        <Cta />

        <h2 id="sources" className={s.h2}>3. The sources AI systems read</h2>
        <p className={s.p}>Before recommending you, an assistant cross-references several public surfaces. Your website is only one piece of the file: Google reviews, your Facebook page, platforms like Trustpilot, the press and your structured data weigh together in the reputation the AI reconstructs about you.</p>
        <ReputationFlowDiagram />
        <p className={s.p}>The practical consequence: working a single surface is not enough. An excellent Google profile with a site AI crawlers cannot read, or a beautiful site with abandoned reviews, produces the same outcome: a recommendation that goes elsewhere.</p>
        <CompareTable head={["Traditional citations (directories)", "AI citations"]}
          rows={[["A static listing", "A mention earned at every answer"], ["Value: a link and a NAP", "Value: the recommendation itself"], ["Verified once", "Monitored continuously, because it can disappear"], ["Fixed local reach", "Reach: every conversation with a customer"]]} />
        <p className={s.p}>An AI citation is never permanent: it can vanish at the next index update. That is the point of <Link href={`/${locale}/live-monitoring`}>continuous monitoring</Link>, which checks every day what the engines actually answer.</p>
        <Figure file="perplexity.png" caption="Perplexity cites its sources in plain sight: citability is visible to the naked eye." />
        <Figure file="gemini.png" caption="Gemini: local recommendation relies on listings and reviews." />
        <Callout>Perplexity displays its sources above every answer. If your competitors appear there and you do not, you know exactly which surfaces to work on first.</Callout>
        <Cta />

        <h2 id="checklist" className={s.h2}>4. Is your business AI-ready?</h2>
        <p className={s.p}>Tick what is true today, without indulgence. Each item corresponds to a check automated systems actually run.</p>
        <ChecklistArt label="A checklist being ticked" />
        <Checklist lang="en" />

        <h2 id="technique" className={s.h2}>5. Technical optimization: opening the door to AI</h2>
        <p className={s.p}>The first cause of invisibility is brutally simple: the door is closed. Assistants rely on dedicated crawlers, including GPTBot (OpenAI), ClaudeBot (Anthropic), PerplexityBot and Google-Extended. An overly strict robots.txt, a rule inherited from a former agency, or a misconfigured anti-bot layer can block them without any human noticing: your site stays perfect for visitors and nonexistent for AI.</p>
        <CrawlerGateArt label="AI crawlers passing through an open gate" />
        <h3 className={s.h3}>The foundations, in order</h3>
        <ul className={s.ul}>
          <li className={s.li}>Robots.txt: explicitly allow AI crawlers, or at minimum do not block them by default.</li>
          <li className={s.li}>HTTPS and a declared XML sitemap: the minimal base of technical trust.</li>
          <li className={s.li}>Schema.org: LocalBusiness (or your precise business type), hours, service area, FAQPage on your question pages.</li>
          <li className={s.li}>Real text content: menus, prices and information locked in images or PDFs are invisible to retrieval.</li>
          <li className={s.li}>Distinct service pages: one precise page per service brings your content closer to real questions (semantic search).</li>
          <li className={s.li}>Freshness: exact hours, dated content, recent reviews. Stale information costs more than missing information.</li>
        </ul>
        <Callout>A crawler block in a robots.txt file triggers no alert anywhere. That is precisely why the EchoRank audit checks access for every AI crawler, and why monitoring alerts you if access flips overnight.</Callout>
        <Cta />

        <h2 id="reputation" className={s.h2}>6. Reputation and reviews: the raw material of trust</h2>
        <p className={s.p}>When an AI must separate three technically readable businesses, reputation decides. Reviews are the richest source: they are dated, written by third parties, distributed across several platforms, and their text describes the experience concretely. Assistants read them like an evidence file.</p>
        <ul className={s.ul}>
          <li className={s.li}>Regularity beats volume: a steady flow of fresh reviews weighs more than an old spike.</li>
          <li className={s.li}>Replies count double: they show a business that listens, and they add your voice to the file.</li>
          <li className={s.li}>Cross-platform consistency reassures: widely diverging scores between Google and another platform are an ambiguity signal.</li>
          <li className={s.li}>Authenticity is verifiable: suspicious review bursts are detectable, and they destroy the trust they claim to build.</li>
        </ul>
        <CompareTable head={["Reviews (the raw material)", "Reputation signals (what AI reads)"]}
          rows={[["A score out of five", "Score, volume, freshness and trend combined"], ["An isolated text", "Recurring themes extracted from all texts"], ["One platform", "Consistency across all platforms"], ["One event", "A dated history, with the business's replies"]]} />
        <ReviewPulseArt label="The pulse of reviews over time" />
        <p className={s.p}>Turning reviews into usable signals is continuous reading work: that is what <Link href={`/${locale}/customer-feedback`}>customer feedback intelligence</Link> does, and the <Link href={`/${locale}/reputation-risk`}>Reputation Risk Score</Link> turns it into a single, explainable measure.</p>
        <Figure file="dashboard-echorank.png" caption="The EchoRank dashboard: reviews, feedback and reputation intelligence in one place." />
        <Figure file="score-visibilite.png" caption="The AI visibility score out of 100, with every check detailed." />
        <Figure file="dashboard-reputation.png" caption="The reputation risk score: five components, every driver named." />
        <Figure file="comparaison-concurrents.png" caption="Competitive comparison: who is gaining ground, and at what pace." />
        <Cta />

        <h2 id="erreurs" className={s.h2}>7. The mistakes that keep AI from recommending your business</h2>
        <p className={s.p}>Across audits, the same causes of invisibility recur. Ten mistakes explain most absences from recommendations. Each one can be fixed.</p>
        <h3 className={s.h3}>1. Few recent reviews</h3>
        <p className={s.p}>A profile whose last review is eight months old tells the story of a business at a standstill. Fix: a steady flow of requests after every job, rather than one-off campaigns. The <Link href={`/${locale}/reputation-engine`}>campaign engine</Link> automates exactly that.</p>
        <h3 className={s.h3}>2. Inconsistent information</h3>
        <p className={s.p}>Two phone numbers, three spellings of the name, contradictory hours: for an AI, citing becomes risky, so it abstains. Fix: an inventory of all your listings, then an identical NAP everywhere.</p>
        <h3 className={s.h3}>3. A slow site</h3>
        <p className={s.p}>AI crawlers work with time budgets. A site that answers in several seconds gets explored less, therefore read less. Fix: measure response time, compress, cache.</p>
        <h3 className={s.h3}>4. Missing structured data</h3>
        <p className={s.p}>Without Schema.org, the machine must guess your activity, your hours, your area. Fix: LocalBusiness (or the precise type), plus FAQPage on your question pages.</p>
        <h3 className={s.h3}>5. Few external mentions</h3>
        <p className={s.p}>A business described only by its own website is unverifiable. Fix: industry directories, local press, chambers of commerce, partners. Each concordant source makes citation safer.</p>
        <h3 className={s.h3}>6. Stale content</h3>
        <p className={s.p}>Last year's prices or the old location's hours do worse than absence: they make the AI that cites you wrong, and it learns to stop. Fix: a dated quarterly review of key pages.</p>
        <h3 className={s.h3}>7. Weak digital authority</h3>
        <p className={s.p}>Authority in the AI sense is not a backlink score: it is verifiability. Displayed licences, documented longevity, a real team, third-party mentions.</p>
        <CompareTable head={["Web authority (SEO)", "AI trust"]}
          rows={[["Backlinks and referring domains", "Concordant, verifiable sources"], ["PageRank and link juice", "Fact consistency across surfaces"], ["Optimized anchors", "Readable reputation: reviews, replies, press"], ["Can be manipulated (and penalized)", "Is built, hard to fake"]]} />
        <h3 className={s.h3}>8. No FAQ</h3>
        <p className={s.p}>Customers ask questions; semantic search matches questions with answers. No answer page, no match. Fix: an FAQ in customer language, marked up as FAQPage.</p>
        <h3 className={s.h3}>9. Bad reputation</h3>
        <p className={s.p}>No technical optimization compensates for negative reviews left unanswered. Fix: reply to everything, fast and well, and treat recurring causes upstream, before the public review.</p>
        <h3 className={s.h3}>10. No AI visibility tracking</h3>
        <p className={s.p}>The most expensive one: not knowing. Without measurement, a disappearance from recommendations goes unnoticed for months. Fix: ask your customers' questions to the AI engines every day, and be alerted on change. That is precisely <Link href={`/${locale}/act-on-signals`}>going from signal to action</Link>.</p>
        <Cta />

        <h2 id="analyse" className={s.h2}>8. What we analyzed</h2>
        <p className={s.p}>EchoRank runs AI visibility audits on the websites of service businesses, shops and clinics. Every audit verifies the same families of criteria: AI crawler access (GPTBot, ClaudeBot, PerplexityBot, Google-Extended), technical foundations (HTTPS, sitemap, response time), machine readability (structured data, page semantics), trust signals (legal pages, verifiable contact details, NAP consistency) and reputation surface (Google profile, review freshness). The result is a score out of 100 and a grade, reproducible from one audit to the next.</p>
        <p className={s.p}>Our tracking methodology completes the snapshot: a business's key queries are asked daily to the AI engines, and every answer is archived. It is this time series, not a single capture, that makes it possible to state that a business appeared, was misrepresented or disappeared from recommendations, and to date the change.</p>
        <h3 className={s.h3}>The EchoRank framework: five components, published weights</h3>
        <p className={s.p}>Our Reputation Risk Score is not a black box, and we publish its structure. Five weighted components, with the current model version's weights:</p>
        <CompareTable head={["Component", "Weight"]}
          rows={[["Negative pressure (unfavourable reviews and feedback, recency-weighted)", "0.40"], ["Review velocity (pace compared to your own history)", "0.25"], ["Recent critical signals (high-severity incidents)", "0.15"], ["AI visibility (crawler access, readability, presence in answers)", "0.15"], ["Stagnation (prolonged absence of fresh signals)", "0.05"]]} />
        <p className={s.p}>Each component is computed from dated signals, with a fourteen-day half-life: yesterday's incident weighs more than last month's. The score recomputes every hour, and every driver that moves it is named. Publishing these weights is a choice: a score you can explain is a score you can challenge, improve and cite.</p>
        <h3 className={s.h3}>The audit's check families</h3>
        <p className={s.p}>The audit examines five families: AI crawler access (GPTBot, ClaudeBot, PerplexityBot, Google-Extended), technical foundations (HTTPS, sitemap, response time), machine readability (structured data, semantics), trust signals (legal pages, verifiable details, NAP consistency) and reputation surface (profile, review freshness). Each check is binary or graded, which makes the score out of 100 reproducible from one audit to the next.</p>
        <p className={s.p}>[TO COMPLETE: a quantified synthesis of your real audits, for example the share of audited sites blocking at least one AI crawler, the average score per industry, or an anonymized before-and-after client case. Publishing figures from your own data will make this section cited; publishing invented figures would make it radioactive.]</p>
        <Cta label="Contribute a data point: audit your site →" />

        <h2 id="etudes-de-cas" className={s.h2}>9. Case studies: the optimization journey</h2>
        <p className={s.p}>The path is always the same: Before, Audit, Fixes, Results. Here is the framework, illustrated by a composite scenario. No client is named and no figure is invented; the marked slots await verified data.</p>
        <div className={s.vertical}>
          <h3 className={s.h3} style={{ marginTop: 0 }}>Composite scenario: a local service business</h3>
          <p className={s.p}><strong>Before:</strong> a loyal clientele, a decent Google profile, but zero mentions in AI assistant answers. Quote requests come mostly by word of mouth.</p>
          <p className={s.p}><strong>Audit:</strong> AI crawlers blocked by an inherited robots.txt rule, no structured data, old reviews without replies, diverging hours across two directories.</p>
          <p className={s.p}><strong>Fixes:</strong> explicit opening to the crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended), LocalBusiness and FAQPage schema, a review campaign relaunched after every job, unified NAP, systematic review replies.</p>
          <p className={s.p}><strong>Results:</strong> [TO COMPLETE: visibility score evolution, first dated appearance in an AI answer, review velocity change, from real dashboard data.]</p>
        </div>
        <TrendGrid />
        <p className={s.p} style={{ fontSize: 12, color: "rgba(17,17,17,.5)" }}>Expected trends of the optimization framework, shown for illustration. Real curves come from each account's daily tracking.</p>
        <Cta />

        <h2 id="secteurs" className={s.h2}>10. Industry guides</h2>
        <p className={s.p}>AI does not recommend a dentist the way it recommends a restaurant. Every industry has its typical questions, its trust signals and its visibility traps.</p>
        {VERTICALS.map((v) => (
          <div key={v.name} className={s.vertical}>
            <h3 className={s.h3} style={{ marginTop: 0 }}>{v.name}</h3>
            <p className={s.p}><strong>How customers ask:</strong> {v.ask}</p>
            <p className={s.p}><strong>Industry trust signals:</strong> {v.signals}</p>
            <p className={s.p}><strong>Common visibility problems:</strong> {v.problems}</p>
            <p className={s.p}><strong>Optimization steps:</strong> {v.steps}</p>
          </div>
        ))}
        <Cta />

        <h2 id="calculateur" className={s.h2}>11. Lost-revenue calculator</h2>
        <p className={s.p}>How much does invisibility cost? Four inputs are enough for an honest order of magnitude.</p>
        <RevenueCalculator lang="en" />

        <h2 id="glossaire" className={s.h2}>12. AI visibility glossary</h2>
        {GLOSSARY.map(([term, def]) => (
          <div key={term}>
            <div className={s.glossTerm}>{term}</div>
            <p className={s.glossDef}>{def}</p>
          </div>
        ))}

        <h2 id="faq" className={s.h2}>13. Frequently asked questions</h2>
        {FAQ.map(([q, a]) => (
          <div key={q}>
            <h3 className={s.h3}>{q}</h3>
            <p className={s.p}>{a}</p>
          </div>
        ))}
        <Cta />

        <h2 id="ressources" className={s.h2}>14. Downloadable resources</h2>
        <p className={s.p}>Concrete tools, no form. The first is available now; more will follow as our analyses do.</p>
        <div className={s.ctaBand}>
          <span className={s.ctaText}>
            <b>AI Visibility Checklist (PDF, French)</b>
            <span>The 10 readiness criteria, ready to print and tick as a team.</span>
          </span>
          <a href="/guide/checklist-visibilite-ia.pdf" download className={s.ctaBtn}>Download the PDF →</a>
        </div>

        <h2 className={s.h2}>About this resource</h2>
        <p className={s.p}>This guide is written and maintained by EchoRank, the AI reputation intelligence platform operated by ChatLogic Insights Ltd. It documents a methodology in production: the weights, cadences and checks described are those of the live system, updated release by release. Reports and corrections: privacy@echorank360.com.</p>
        <h3 className={s.h3}>How to cite this guide</h3>
        <p className={s.p} style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}>EchoRank (2026). The complete guide to AI visibility in 2026. ChatLogic Insights Ltd. https://echorank360.com/en/guide-visibilite-ia</p>

        <div className={s.backRow}>
          <BackButton locale={locale} label={backLabel} className={s.backBtnGrey} />
        </div>

        <footer className={s.footer}>
          <span>{foot.copyright}</span>
          <span>
            {foot.links.map((l) => (
              <Link key={l.label} href={`/${locale}${l.href}`}>{l.label}</Link>
            ))}
          </span>
        </footer>
      </div>
    </div>
  );
}
// EOF-en-guide
