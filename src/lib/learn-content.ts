// src/lib/learn-content.ts
// Single typed source of truth for the public Knowledge Hub at /[locale]/learn:
// the hub page, the ten course chapters, the five ultimate guides and Echopedia
// all render from this file, and so does every piece of structured data they
// emit. (Pattern: src/lib/seo-tools.ts.)
//
// WHY A TYPED CONFIG AND NOT MARKDOWN: this repo has no markdown loader and no
// MDX pipeline, and the brief was explicit that this feature must not add one.
// The prose below was mechanically converted from the content pack, so it is
// the authored text verbatim rather than a retyping of it.
//
// JSON-LD IS DERIVED FROM THIS FILE, NEVER HAND-MAINTAINED ALONGSIDE IT. The
// Jul 31 incident was a hand-kept copy of the prices in structured data that
// drifted from the real ones; the same mistake here would publish a Course
// whose chapter list disagrees with the chapters that exist.
//
// CONTENT IS EN-ONLY IN THIS PASS. fr/de-CH render this body with localized
// chrome and canonical to the en URL — see the locale note in
// src/app/[locale]/learn/_shared/ArticleShell.tsx. Machine-translating the body
// would be worse than shipping it in English, and French here is real French or
// nothing.

/** One renderable unit of article body. The markdown subset the pack uses. */
export type LearnBlock =
  | { k: "p"; t: string }
  | { k: "h2"; t: string }
  | { k: "h3"; t: string }
  | { k: "ul"; items: string[] }
  | { k: "ol"; items: string[] }
  | { k: "table"; head: string[]; rows: string[][] }
  | { k: "quote"; paras: string[] }
  | { k: "code"; t: string }
  /** Renders the page's `video` through HomeVideo, in prose position. */
  | { k: "video" }
  /** Renders the page's `faq` array — the same array the JSON-LD is built from. */
  | { k: "faq" };

export interface LearnFaqEntry {
  q: string;
  a: string;
}

/**
 * Fields every video carries, whatever its placement.
 *
 * `uploadDate` is the mp4's own date and feeds VideoObject.uploadDate. Like
 * everything else in structured data here it is never invented — see the rule
 * at the top of src/lib/seo/jsonld.ts.
 */
interface LearnVideoBase {
  src: string;
  poster: string;
  title: string;
  uploadDate: string;
}

/**
 * A video the PROSE places, at its own `{k:"video"}` marker.
 *
 * Currently only the extension install walkthrough, which is why the src is
 * absolute: that mp4 is served by Caddy from /opt/echorank/extension-dist,
 * outside this repo. No build ships it and it must not be copied into
 * public/videos/.
 */
export interface InlineVideo extends LearnVideoBase {
  placement: "inline";
}

/**
 * A CHAPTER'S OWN video — the chapter presented in video form.
 *
 * Rendered once, in a fixed structural position (after the intro prose, before
 * the first section heading), with the browser's native controls. It is not
 * placed by the prose and carries no `{k:"video"}` marker.
 *
 * `description` and `durationSeconds` are required here and absent on
 * InlineVideo because a chapter video is the page's primary media and gets a
 * full VideoObject; both fields must be real, measured values.
 */
export interface ChapterVideo extends LearnVideoBase {
  placement: "chapter";
  description: string;
  /** Whole seconds, floored from the file's actual duration. */
  durationSeconds: number;
}

/**
 * The two are one field and two behaviours, discriminated explicitly rather
 * than inferred from whether the body happens to carry a marker. Guessing the
 * player from the prose would make the rendering of a config entry depend on
 * something a copy edit could silently change.
 */
export type LearnVideo = InlineVideo | ChapterVideo;

export interface LearnLink {
  href: string;
  label: string;
  /** Locale-prefixed Next route. Caddy pages, PDFs and the app itself are not. */
  internal?: boolean;
}

/**
 * Which CTA block the page closes with.
 * "audit" — the free, no-account audit widget. "register" — start a trial.
 */
export type LearnCta = "audit" | "register";

export interface LearnChapter {
  slug: string;
  order: number;
  title: string;
  description: string;
  /** Minutes, from the content pack's frontmatter. */
  readingTime: number;
  video?: LearnVideo;
  cta: LearnCta;
  /** At least one live surface per chapter. Asserted in tests/learn-content.test.ts. */
  related: LearnLink[];
  body: LearnBlock[];
}

export interface LearnGuide extends Omit<LearnChapter, "order"> {
  /** Hub display order. */
  order: number;
  /** Card eyebrow on the hub. */
  tag: string;
  /** Card description on the hub. */
  blurb: string;
  /** Present only where the guide carries a real FAQ section. */
  faq?: LearnFaqEntry[];
}

export interface GlossaryTerm {
  term: string;
  definition: string;
}

/** Path after the locale segment. */
export const LEARN_BASE = "/learn";

/**
 * The PDF the hub's closing CTA points at.
 *
 * The email-gated ebook funnel (/[locale]/ebooks) does not exist in this
 * branch — see the same TODO in src/app/[locale]/resources/page.tsx. Until it
 * merges, the CTA links the file directly rather than a route that 404s.
 * This is the August 2026 cut, byte-identical to the PDF in the content pack
 * this course was written from.
 */
export const LEARN_PDF =
  "/whitepapers/From-Zero-Visibility-to-a-Trusted-Online-Reputation-The-Complete-Echorank-Guide-Aug-2026.pdf";

export const LEARN_CHAPTERS: LearnChapter[] = [
  {
    slug: "what-is-reputation-management",
    order: 1,
    title: "What is online reputation management?",
    description: "Why reviews, ratings, and owner responses decide who gets found — in Google, in local search, and now in AI answers.",
    readingTime: 5,
    // Bundled under public/videos/ like the other marketing videos — NOT the
    // Caddy-served extension mp4, so this src is site-relative. Title and
    // description are the chapter's own H1 and summary, read from above rather
    // than restated, so the VideoObject can never describe a different page
    // than the one it sits on.
    video: {
      placement: "chapter",
      src: "/videos/echorank-what-is-reputation-management.mp4",
      poster: "/videos/echorank-what-is-reputation-management-poster.jpg",
      title: "What is online reputation management?",
      description: "Why reviews, ratings, and owner responses decide who gets found — in Google, in local search, and now in AI answers.",
      uploadDate: "2026-08-04",
      // Floored from the file's real 248.49s. Serialized as PT4M8S.
      durationSeconds: 248,
    },
    cta: "audit",
    related: [
      {
        href: "/free-audit",
        label: "Run the free audit — no account needed",
        internal: true,
      },
      {
        href: "/learn/audit-your-starting-point",
        label: "Chapter 2: audit your starting point",
        internal: true,
      },
    ],
    body: [
      {
        k: "p",
        t: "Online reputation management is the practice of collecting, monitoring, analyzing, and responding to what customers say about you in public — and using what you learn to run a better business and a more visible one.",
      },
      {
        k: "p",
        t: "It used to be a defensive discipline: watch for bad reviews, reply politely, hope for the best. That framing is obsolete for three reasons.",
      },
      {
        k: "h2",
        t: "Reviews are a ranking factor",
      },
      {
        k: "p",
        t: "Review quantity, recency, rating, and owner responses are documented factors in Google's local ranking systems, and the text of your reviews feeds the \"justifications\" Google shows under local results. Two identical businesses at the same rank position do not get the same clicks: a listing with 80 recent reviews at 4.7 outperforms one with 6 stale reviews, every time.",
      },
      {
        k: "h2",
        t: "Reviews are a conversion factor",
      },
      {
        k: "p",
        t: "Before anyone calls you, they read what your last ten customers wrote. Your response to a 1-star review is read by a hundred prospects for every one unhappy customer. A calm, specific, signed reply is marketing.",
      },
      {
        k: "h2",
        t: "Reviews now feed AI answers",
      },
      {
        k: "p",
        t: "When someone asks ChatGPT, Claude, or Gemini for \"the best plumber near me\" or \"a durable hiking backpack,\" the assistant leans on review corpora and structured, crawlable content to decide which brands to name. Reputation work and AI visibility are the same discipline now — which is why this course covers both.",
      },
      {
        k: "h2",
        t: "The workflow you'll learn",
      },
      {
        k: "ol",
        items: [
          "**Audit** your starting position honestly (Chapter 2).",
          "**Import** your review history so analysis starts with context, not a blank slate (Chapter 3).",
          "**Analyze** what customers actually say — themes, sentiment, risks (Chapter 4).",
          "**Generate** reviews ethically with repeatable request workflows (Chapter 5) and **respond** to everything (Chapter 6).",
          "**Convert** reputation signals into visibility — on your site, in local search, and in AI answers (Chapters 7–9).",
          "**Execute** a 90-day roadmap with defined KPIs (Chapter 10).",
        ],
      },
      {
        k: "p",
        t: "None of this requires an agency retainer or a marketing degree. It requires sequencing and about ten minutes a day.",
      },
      {
        k: "quote",
        paras: [
          "**Try it now:** run the free Echorank audit on your own site — no account needed — and keep the PDF as your day-zero benchmark.",
        ],
      },
    ],
  },
  {
    slug: "audit-your-starting-point",
    order: 2,
    title: "Audit your starting point",
    description: "A 90-minute honest baseline: branded search, review inventory, response history, website basics, and whether AI assistants know you exist.",
    readingTime: 6,
    cta: "audit",
    related: [
      {
        href: "/free-audit",
        label: "Run the free audit and save your day-zero PDF",
        internal: true,
      },
      {
        href: "/resources",
        label: "Resources: guides, whitepapers and free tools",
        internal: true,
      },
    ],
    body: [
      {
        k: "p",
        t: "\"Zero\" usually means some mix of: fewer than 10 reviews, no claimed business profiles, a website that doesn't rank for your own brand name, and no process for asking customers for feedback. The fix is sequencing, not heroics: claim your assets, capture your history, then build the habit. But first, measure where you stand.",
      },
      {
        k: "p",
        t: "Spend 60–90 minutes answering these questions honestly. Write the answers down — they become your baseline for the 90-day roadmap.",
      },
      {
        k: "h2",
        t: "The seven checks",
      },
      {
        k: "table",
        head: [
          "Area",
          "Question",
          "How to check",
        ],
        rows: [
          [
            "Branded search",
            "What appears when you Google your exact business name in a private window?",
            "Search \"[business name]\" and \"[business name] reviews\".",
          ],
          [
            "Google Business Profile",
            "Does a listing exist? Claimed, accurate, correctly categorized?",
            "Google Maps; look for \"Own this business?\".",
          ],
          [
            "Review inventory",
            "How many reviews across Google, Facebook, Trustpilot, directories? Average rating? Newest date?",
            "Visit each profile; note counts and dates.",
          ],
          [
            "Response history",
            "What percentage of existing reviews have an owner response?",
            "Count on each platform.",
          ],
          [
            "Website basics",
            "Fast, mobile-friendly, clear about what you do and where, consistent contact details?",
            "Open on a phone; run the free Echorank audit.",
          ],
          [
            "AI visibility",
            "Do ChatGPT/Claude/Gemini mention you for recommendations in your category and city?",
            "Ask each assistant 3–5 realistic prompts; record answers.",
          ],
          [
            "Competitors",
            "Who ranks, and who has the reviews you want? What do their customers praise?",
            "Search your top 3 service keywords + city.",
          ],
        ],
      },
      {
        k: "h2",
        t: "Assets to claim before you start",
      },
      {
        k: "ol",
        items: [
          "**Google Business Profile** — claimed, verified, correct name/address/phone (NAP), primary category, hours, photos. The single highest-leverage asset for a local business.",
          "**Website** — at minimum a homepage that says what you do and for whom, a contact page, one page per core service, consistent NAP in the footer.",
          "**Facebook Page** — claimed, reviews enabled if relevant.",
          "**Trustpilot** — claim the free listing if you sell online or serve a wide area.",
          "**Industry directories** — the 2–3 that matter in your vertical.",
          "**One primary review platform** — usually Google. Concentrate requests there for the first 90 days.",
          "**A way to reach past customers** — a list, a CRM export, even invoices.",
        ],
      },
      {
        k: "quote",
        paras: [
          "**Try it now:** enter your URL in the free Echorank audit widget. It returns a score with itemized checks (technical basics, structured data, robots access, AI-visibility signals). Save the PDF — that's your day zero.",
        ],
      },
    ],
  },
  {
    slug: "import-your-review-history",
    order: 3,
    title: "Import your review history",
    description: "Four routes to get every existing review into one place: browser extension, CSV, Google Business Profile connection, and Takeout.",
    readingTime: 7,
    video: {
      placement: "inline",
      src: "https://echorank360.com/extension/echorank-extension-install.mp4",
      poster: "https://echorank360.com/extension/install-video-poster.jpg",
      title: "See the install, start to finish (2 min)",
      uploadDate: "2026-07-27",
    },
    cta: "register",
    related: [
      {
        href: "/learn/guides/install-browser-extension",
        label: "Guide: install the Echorank browser extension",
        internal: true,
      },
      {
        href: "/learn/guides/csv-review-import",
        label: "Guide: CSV review import",
        internal: true,
      },
      {
        href: "/extension/download.html",
        label: "Extension download page",
      },
    ],
    body: [
      {
        k: "p",
        t: "Your review history is data. Importing it means sentiment analysis, trends, and dashboards start with real context instead of an empty chart. Most platforms give you no \"download my reviews\" button — so there are four routes. Pick per platform.",
      },
      {
        k: "h2",
        t: "The four routes",
      },
      {
        k: "table",
        head: [
          "Route",
          "Best for",
          "Effort",
        ],
        rows: [
          [
            "Browser extension",
            "Google, Facebook, Trustpilot listings you can open in a browser",
            "Low",
          ],
          [
            "CSV import",
            "Exports from a previous tool, hand-built spreadsheets, anything else",
            "Medium",
          ],
          [
            "Google Business Profile connection",
            "Your own GBP — connect once, reviews import and stay synced",
            "Low",
          ],
          [
            "Google Takeout",
            "Last resort for your own Google reviews (JSON, often incomplete)",
            "High",
          ],
        ],
      },
      {
        k: "p",
        t: "**Compliance first.** Only collect reviews that are publicly visible or that you own. Respect each platform's terms, robots directives, and privacy law (GDPR/CCPA and local equivalents). Never bypass CAPTCHAs, logins, or paywalls. The Echorank extension deliberately reads only what is already rendered on the page in front of you.",
      },
      {
        k: "h2",
        t: "Google: connect your Business Profile",
      },
      {
        k: "p",
        t: "For the business you own, connecting your GBP is the preferred route: reviews import, scoring starts immediately, and new reviews keep syncing without you touching anything.",
      },
      {
        k: "h2",
        t: "The extension route",
      },
      {
        k: "video",
      },
      {
        k: "quote",
        paras: [
          "**Watch it first (2 min):** the install walkthrough covers download, developer mode, load-unpacked, and connecting your access token, start to finish. The written steps on the [download page](https://echorank360.com/extension/download.html) match the video.",
        ],
      },
      {
        k: "p",
        t: "For listings you manage but haven't connected — and for Facebook and Trustpilot:",
      },
      {
        k: "ol",
        items: [
          "Open the actual listing page (Google Maps place page, Facebook Reviews tab, Trustpilot company page).",
          "Confirm it's the correct listing — chains and common names produce near-duplicates. Check name, address, and review count.",
          "Scroll so the reviews you want are loaded on the page.",
          "Click the extension icon → **Scan & Import Reviews**.",
          "Verify in Monitoring; re-scan any time. Imports are idempotent — duplicates are skipped, so re-scanning is safe.",
        ],
      },
      {
        k: "h2",
        t: "Everything else: one CSV",
      },
      {
        k: "p",
        t: "Normalize other platforms into one CSV (up to 5 MB per file):",
      },
      {
        k: "code",
        t: "reviewer_name,rating,review_text,review_date,platform,review_url,owner_reply\n\"Jane D.\",5,\"Great service, fast and friendly.\",2026-05-14,GOOGLE,https://maps.google.com/...,\"Thanks Jane!\"",
      },
      {
        k: "p",
        t: "Ratings are 1–5 integers, dates are YYYY-MM-DD, platform is an uppercase source name. Leave unknown fields empty rather than guessing.",
      },
      {
        k: "h2",
        t: "Verify before you analyze",
      },
      {
        k: "ul",
        items: [
          "Imported count roughly matches the platform's visible count",
          "Ratings and dates spot-checked against 5 random originals",
          "The right business/tenant received the data (agencies: check twice)",
          "Oldest and newest review dates recorded in your baseline notes",
        ],
      },
    ],
  },
  {
    slug: "analyze-what-customers-say",
    order: 4,
    title: "Analyze what customers actually say",
    description: "Six ways to slice review data, the five patterns that matter, and how one theme becomes one operational fix per month.",
    readingTime: 6,
    cta: "register",
    related: [
      {
        href: "/extension/getting-reviews-in.html",
        label: "All the ways to get reviews in",
      },
      {
        href: "/learn/guides/review-request-templates",
        label: "Guide: review request templates",
        internal: true,
      },
    ],
    body: [
      {
        k: "p",
        t: "Once your history is imported, resist the urge to stare at the average rating. The value is in the text. Slice the data six ways — each slice answers a different question.",
      },
      {
        k: "h2",
        t: "Categorize before you analyze",
      },
      {
        k: "table",
        head: [
          "Slice",
          "Question it answers",
        ],
        rows: [
          [
            "By source",
            "Where does my reputation actually live? Where are the gaps?",
          ],
          [
            "By date",
            "Is this trending up or down? What changed when it turned?",
          ],
          [
            "By rating",
            "What separates my 5-star and 2-star experiences?",
          ],
          [
            "By location",
            "Is one site dragging the brand down?",
          ],
          [
            "By product/service",
            "Which offering generates praise? Which generates complaints?",
          ],
          [
            "By sentiment/theme",
            "What words do customers repeat — good and bad?",
          ],
        ],
      },
      {
        k: "p",
        t: "Sentiment scoring helps here: it separates a polite 3-star from an angry 3-star, something the star count alone can't do.",
      },
      {
        k: "h2",
        t: "The five patterns that matter",
      },
      {
        k: "ol",
        items: [
          "**Recurring complaints** — any negative theme in 3+ reviews is operational, not bad luck. Name it precisely: \"callback delays after quotes,\" not \"communication.\"",
          "**Recurring praise** — your marketing copy is hiding here. Customers' exact phrases become headlines.",
          "**Reputation risks** — mentions of safety, billing disputes, legal threats, or health issues escalate same-day, regardless of star count.",
          "**Service gaps** — requests for things you don't offer (\"wish they did weekends\") are demand signals.",
          "**Competitive advantage** — run the same theme analysis on 2–3 competitors' public reviews. Their recurring complaints are your positioning openings.",
        ],
      },
      {
        k: "h2",
        t: "Trend detection, monthly",
      },
      {
        k: "p",
        t: "Watch: review velocity (new reviews/month), rolling average rating, sentiment mix, response rate, response time. Falling velocity with a stable rating usually means your request process stalled. A falling rating with stable velocity means an operational problem shipped.",
      },
      {
        k: "h2",
        t: "Worked example",
      },
      {
        k: "p",
        t: "A plumbing company imports 84 historical Google reviews. Filtering 1–3 star reviews surfaces \"arrival window\" in 9 of 14. Fix: the booking confirmation SMS now states a 2-hour window plus a 30-minutes-out text. Sixty days later the theme has disappeared from new reviews and the average rating on new reviews is up. The insight cost nothing — it was sitting in already-public data.",
      },
      {
        k: "p",
        t: "That's the loop this whole course builds toward: **one named theme → one operational fix per month → measure whether the theme fades.**",
      },
    ],
  },
  {
    slug: "generate-reviews-ethically",
    order: 5,
    title: "Generate reviews ethically",
    description: "What's banned (gating, incentives, fakes), what works (ask everyone, fast, in one tap), and copy-paste request templates.",
    readingTime: 6,
    cta: "register",
    related: [
      {
        href: "/learn/guides/review-request-templates",
        label: "Guide: the full request templates",
        internal: true,
      },
      {
        href: "/resources",
        label: "Resources: every guide and free tool",
        internal: true,
      },
    ],
    body: [
      {
        k: "p",
        t: "Volume comes from consistency, not cleverness. But before the tactics, the rules — because the penalties are real.",
      },
      {
        k: "h2",
        t: "Never do these",
      },
      {
        k: "ul",
        items: [
          "**No fake reviews** — no purchased reviews, no staff or family posing as customers.",
          "**No review gating** — pre-screening customers and only asking happy ones publicly is explicitly prohibited by Google.",
          "**No incentives that violate platform rules** — Google prohibits offering anything of value for reviews; Trustpilot and Facebook have similar restrictions.",
          "**No reposting** the same review across platforms yourself.",
        ],
      },
      {
        k: "p",
        t: "Violations risk review removal, listing suspension, FTC penalties in the US, and consumer-protection action elsewhere.",
      },
      {
        k: "h2",
        t: "What works and is allowed",
      },
      {
        k: "p",
        t: "Ask **every** customer. Ask **soon** after service. Make it **one tap**. Ask **personally**.",
      },
      {
        k: "table",
        head: [
          "Channel",
          "When",
          "Mechanics",
        ],
        rows: [
          [
            "Email",
            "Same day or +1 day",
            "Short personal note + direct link. One reminder after 5–7 days, then stop.",
          ],
          [
            "SMS",
            "Within hours",
            "Highest response rates. One message, direct link, easy opt-out.",
          ],
          [
            "QR code",
            "At point of service",
            "Counter cards, tables, vans, packaging.",
          ],
          [
            "Website",
            "Always on",
            "\"Review us\" in footer and thank-you pages.",
          ],
          [
            "Invoice",
            "Every bill",
            "One line + link/QR under the total.",
          ],
          [
            "Post-purchase",
            "7–14 days after delivery",
            "After the product has been used.",
          ],
        ],
      },
      {
        k: "p",
        t: "Get your Google review link from \"Ask for reviews\" in your Business Profile, and use that exact short link everywhere. Every extra click halves completion.",
      },
      {
        k: "h2",
        t: "Templates",
      },
      {
        k: "p",
        t: "**Email — service business**",
      },
      {
        k: "quote",
        paras: [
          "Subject: How did we do, {{first_name}}?",
          "Hi {{first_name}}, thanks for choosing {{business}} for your {{service}} today. If you have 60 seconds, a Google review helps neighbours find us and tells us what to keep doing: {{review_link}}. If anything wasn't right, reply to this email and I'll fix it personally. — {{owner_name}}",
        ],
      },
      {
        k: "p",
        t: "**SMS**",
      },
      {
        k: "quote",
        paras: [
          "Hi {{first_name}}, it's {{owner_name}} from {{business}}. Thanks for today! If you'd leave us a quick Google review it would mean a lot: {{review_link}} Reply STOP to opt out.",
        ],
      },
      {
        k: "p",
        t: "Note the email invites unhappy customers to reply privately **in addition to** the public ask, not instead of it. That's service recovery, not gating — everyone gets the same review link.",
      },
      {
        k: "quote",
        paras: [
          "**In Echorank:** Campaigns send requests on a schedule by email or SMS without asking the same customer twice, Templates store your house wording per channel and locale, and Review links keep one short link per platform.",
        ],
      },
    ],
  },
  {
    slug: "respond-to-every-review",
    order: 6,
    title: "Respond to every review",
    description: "The response formula, templates for every star count, what never to say, and same-day escalation rules.",
    readingTime: 6,
    cta: "register",
    related: [
      {
        href: "/learn/analyze-what-customers-say",
        label: "Chapter 4: find the themes worth fixing",
        internal: true,
      },
      {
        href: "/guide",
        label: "The Echorank user guide",
        internal: true,
      },
    ],
    body: [
      {
        k: "p",
        t: "Respond to 100% of negative and neutral reviews within 24–48 hours, and to positive reviews within a week. Your replies are read by every future prospect — write for them, not for the reviewer alone.",
      },
      {
        k: "h2",
        t: "The formula for negatives",
      },
      {
        k: "p",
        t: "**Thank → acknowledge the specific issue → state the fix → take it offline → sign a real name.**",
      },
      {
        k: "p",
        t: "Never argue. Never reveal customer details — critical in healthcare and legal, where you shouldn't even confirm someone is a client. Never copy-paste identical responses.",
      },
      {
        k: "h2",
        t: "Templates",
      },
      {
        k: "p",
        t: "**Positive (5 stars)**",
      },
      {
        k: "quote",
        paras: [
          "Thank you, {{name}} — glad the {{specific_thing_they_praised}} worked well for you. We'll pass this to {{staff_member}}. See you next time! — {{owner_name}}",
        ],
      },
      {
        k: "p",
        t: "**Neutral (3 stars)**",
      },
      {
        k: "quote",
        paras: [
          "Thanks for the honest feedback, {{name}}. Glad {{positive_part}} went well, and you're right that {{issue}} should have been better. We've {{concrete_change}}. If you give us another chance, I'd like to make sure it shows. — {{owner_name}}",
        ],
      },
      {
        k: "p",
        t: "**Negative (1–2 stars)**",
      },
      {
        k: "quote",
        paras: [
          "{{name}}, I'm sorry — {{issue}} is not the experience we aim for. I'd like to understand what happened and put it right: please call me directly at {{phone}} or email {{email}}. We've already {{immediate_step}}. — {{owner_name}}, Owner",
        ],
      },
      {
        k: "p",
        t: "**Suspected fake / not a customer**",
      },
      {
        k: "quote",
        paras: [
          "{{name}}, we take every review seriously, but we can't find any record of serving you. If you believe this is in error, please contact us at {{email}} so we can investigate.",
        ],
      },
      {
        k: "p",
        t: "Then report the review through the platform's flagging process.",
      },
      {
        k: "h2",
        t: "Escalation and closing the loop",
      },
      {
        k: "ul",
        items: [
          "**Escalate same-day:** legal threats, safety allegations, discrimination claims, billing-fraud accusations, anything involving a minor or a health outcome. The owner handles it personally; consider professional advice before replying publicly.",
          "**Catch near-misses before they post.** When an unhappy customer replies privately to a request, treat it as a service-recovery case with a named owner and a deadline — in Echorank that's a Recovery ticket, and the dashboard's open-ticket counter is your daily to-do.",
          "**Log the root cause** of every 1–3 star review. Monthly, pick the #1 recurring complaint, ship one operational fix, and watch whether the theme fades from new reviews.",
        ],
      },
    ],
  },
  {
    slug: "what-is-ai-visibility",
    order: 7,
    title: "What is AI visibility?",
    description: "How AI assistants decide which businesses to recommend, and why crawlable content plus a review corpus is the price of admission.",
    readingTime: 5,
    cta: "audit",
    related: [
      {
        href: "/free-audit",
        label: "Check your AI-visibility signals free",
        internal: true,
      },
      {
        href: "/learn/guides/ai-lens-content-gap",
        label: "Guide: the content gap",
        internal: true,
      },
    ],
    body: [
      {
        k: "p",
        t: "AI visibility is how often — and how favorably — AI assistants like ChatGPT, Claude, and Gemini mention or recommend your brand when people ask them for options.",
      },
      {
        k: "p",
        t: "That's no longer a niche concern. Assistants answer \"best [service] near me\" and \"which [product] should I buy\" questions every day, and for a growing share of buyers that answer replaces the search results page entirely. If the assistant names three competitors and not you, you were invisible in a channel you may not even have been measuring.",
      },
      {
        k: "h2",
        t: "How assistants pick brands",
      },
      {
        k: "p",
        t: "Nobody outside the labs knows the exact recipe, but the observable inputs are consistent:",
      },
      {
        k: "ul",
        items: [
          "**Review corpora.** Assistants lean on what large numbers of customers have written publicly — the same signal that drives local rankings.",
          "**Structured, crawlable content.** Assistants and their crawlers read your HTML. FAQPage and LocalBusiness structured data, clear service descriptions, and plain-text answers to real questions all help.",
          "**Whether crawlers can see your content at all.** Many AI crawlers don't execute JavaScript. If your product detail or service descriptions only exist after JS rendering, those crawlers see an empty shell.",
        ],
      },
      {
        k: "h2",
        t: "The vocabulary",
      },
      {
        k: "ul",
        items: [
          "**Answer tracking** — recording, over time, whether specific prompts (\"best electrician in Lyon\") produce a mention of your brand.",
          "**Prompt trends** — the same measurement charted, so you can see mentions appear or disappear.",
          "**Content gap** — the share of your page content present after JavaScript rendering but absent from the raw HTML: invisible to non-rendering crawlers. 0% means crawlers see everything.",
          "**AI crawler access** — whether your robots rules and rendering let AI crawlers in at all.",
        ],
      },
      {
        k: "h2",
        t: "Why this belongs in a reputation course",
      },
      {
        k: "p",
        t: "The inputs to AI visibility are the outputs of everything you've built in Chapters 1–6: a steady review stream, precise customer language, and content built from it. AI visibility isn't a separate project — it's the measurement layer that tells you whether the reputation work is landing in the newest channel.",
      },
      {
        k: "quote",
        paras: [
          "**Try it now:** the free Echorank audit checks AI-visibility signals on any URL — robots access, structured data, and whether crawlers see your real content. No account needed.",
        ],
      },
    ],
  },
  {
    slug: "track-and-improve-ai-visibility",
    order: 8,
    title: "Track and improve your AI visibility",
    description: "The measurement loop: audit, answer tracking, scheduled monitoring, content-gap fixes, and turning review language into crawlable content.",
    readingTime: 7,
    cta: "audit",
    related: [
      {
        href: "/free-audit",
        label: "Baseline your site with the free audit",
        internal: true,
      },
      {
        href: "/learn/guides/ai-lens-content-gap",
        label: "Guide: measuring and closing the content gap",
        internal: true,
      },
      {
        href: "/visibility/tools",
        label: "AI Lens and Bot Analytics in the tools hub",
      },
    ],
    body: [
      {
        k: "p",
        t: "You can't improve what you don't measure. The AI-visibility loop has four parts: baseline, track, fix, re-check.",
      },
      {
        k: "h2",
        t: "1. Baseline with an audit",
      },
      {
        k: "p",
        t: "Run a site/AI-visibility audit and save the score. It itemizes technical basics, structured data, robots access, and AI-visibility signals — each check is a to-do. Re-run after changes; the delta is your progress report.",
      },
      {
        k: "p",
        t: "Add the site to scheduled monitoring so it re-audits automatically and emails you if the score drops or an AI crawler gets blocked. Regressions get caught without anyone remembering to re-check.",
      },
      {
        k: "h2",
        t: "2. Track the prompts that matter",
      },
      {
        k: "p",
        t: "Pick 5–10 realistic prompts your buyers would actually ask (\"best [service] in [city]\", \"is [brand] any good\", \"[product category] recommendations\"). Track whether assistants mention your brand for each, and watch the trend — first mentions typically appear only after the underlying content work ships, so expect zeroes at the start. Set an alert for lost recommendations: losing a mention you had is the regression worth catching fast.",
      },
      {
        k: "h2",
        t: "3. Fix the content gap",
      },
      {
        k: "p",
        t: "If assistants don't mention you and crawlers visit but come away empty, check the gap between your raw HTML and your rendered page. A large content gap — common on JS-heavy storefront themes — means your product detail and service copy are invisible to non-rendering crawlers. The fix is server-side rendering or pre-rendering for the pages that matter. (In Echorank, AI Lens computes this gap per page; Bot Analytics shows whether the crawlers actually come.)",
      },
      {
        k: "h2",
        t: "4. Feed it the right content",
      },
      {
        k: "p",
        t: "Your review themes are the raw material:",
      },
      {
        k: "ul",
        items: [
          "**Business descriptions** rewritten with the exact phrases customers repeat (\"same-day\", \"no surprise fees\").",
          "**Service pages** where each recurring praise theme becomes a headed section with proof.",
          "**FAQ pages** built from real pre-sale questions, marked up with FAQPage structured data.",
          "**Local landing pages** (\"[service] in [city]\") built around what reviewers from that area actually said.",
        ],
      },
      {
        k: "h2",
        t: "Realistic expectations",
      },
      {
        k: "p",
        t: "An e-commerce brand starting at zero mentions on 10 tracked prompts, after fixing a large content gap and shipping review-vocabulary buying guides, saw first mentions on 3 of 10 prompts by day 90 — illustrative, not guaranteed, but the shape is typical: nothing, nothing, then movement once crawlable content and review volume both exist.",
      },
    ],
  },
  {
    slug: "classic-seo-that-compounds",
    order: 9,
    title: "Classic SEO that compounds your reputation",
    description: "Keyword research from review language, on-page and technical basics, local citations, backlinks, and rank tracking — one paragraph each.",
    readingTime: 7,
    cta: "register",
    related: [
      {
        href: "/visibility/tools",
        label: "The SEO Tools hub",
      },
      {
        href: "/learn/guides/local-seo-checklist",
        label: "Guide: the local SEO checklist",
        internal: true,
      },
    ],
    body: [
      {
        k: "p",
        t: "Reputation work compounds when paired with classic SEO. You don't need every discipline on day one — you need each one at the moment it unlocks the next.",
      },
      {
        k: "h2",
        t: "The disciplines, one paragraph each",
      },
      {
        k: "p",
        t: "**Keyword research.** Find the phrases customers actually type; prioritize by intent (ready-to-buy beats curious) and feasibility. Start from review language, expand in a keyword tool, verify demand, assign one primary keyword per page.",
      },
      {
        k: "p",
        t: "**Competitor analysis.** For your top 5 keywords, study who ranks: their page type, content depth, review counts, and backlinks tell you the price of admission.",
      },
      {
        k: "p",
        t: "**On-page SEO.** One topic per page; keyword in title tag, H1, first paragraph, and URL; descriptive headings; internal links between related pages; unique meta descriptions written to earn the click.",
      },
      {
        k: "p",
        t: "**Technical SEO.** Crawlable, fast, mobile-friendly, HTTPS, XML sitemap submitted, structured data (LocalBusiness, FAQPage) valid — plus the AI-crawler angle most checklists miss: make sure your content exists in the raw HTML.",
      },
      {
        k: "p",
        t: "**Content optimization.** Update beats new — refresh pages ranking 5–20 first; add the questions and vocabulary your reviews surface.",
      },
      {
        k: "p",
        t: "**Backlinks.** Earn local links (chamber of commerce, suppliers, sponsorships, local press) before chasing anything exotic; watch competitors' new links monthly.",
      },
      {
        k: "p",
        t: "**Local SEO & citations.** Consistent NAP everywhere; core citations (Google, Bing Places, Apple Maps, Facebook, Yelp, industry directories); GBP posts and photos on a schedule.",
      },
      {
        k: "p",
        t: "**Rank tracking & reporting.** Track a stable basket of 10–25 keywords; judge 4-week trends, not day-to-day jumps; report monthly.",
      },
      {
        k: "h2",
        t: "Four workflows that connect reputation to SEO",
      },
      {
        k: "p",
        t: "**A — Review language → keyword plan.** Export recurring praise/complaint phrases → keyword tool → keep terms with volume and buying intent → map each to a page → track monthly.",
      },
      {
        k: "p",
        t: "**B — Complaints → FAQ → structured data.** Top 8–12 real customer questions → FAQ page → FAQPage markup → re-audit to confirm detection → watch for question-query impressions.",
      },
      {
        k: "p",
        t: "**C — Local landing page loop.** One service + one city → build the page on that area's review quotes → internal-link it → request reviews from customers in that area → track \"[service] [city]\" and compare calls after 60 days.",
      },
      {
        k: "p",
        t: "**D — Conversion optimization.** Find pages with impressions but poor clicks → rewrite titles/descriptions with review superlatives → add review snippets near CTAs → measure click-through the next month.",
      },
      {
        k: "quote",
        paras: [
          "**In Echorank:** the SEO Tools hub covers all of the above in one place — Keywords Explorer, Rank Tracker, SERP Checker, Backlinks, Site Audit, GSC Insights, and more — with quotas by plan.",
        ],
      },
    ],
  },
  {
    slug: "the-90-day-playbook",
    order: 10,
    title: "The 90-day playbook",
    description: "Days 1–30 foundations, 31–60 analysis and content, 61–90 visibility and reporting — with the KPI tracker to prove it worked.",
    readingTime: 6,
    cta: "register",
    related: [
      {
        href: "/resources",
        label: "Download the complete guide as a PDF",
        internal: true,
      },
      {
        href: "/learn/what-is-reputation-management",
        label: "Back to Chapter 1",
        internal: true,
      },
    ],
    body: [
      {
        k: "p",
        t: "Everything in this course compresses into three 30-day phases. The daily habit is ten minutes; the phases decide what the weekly and monthly time goes to.",
      },
      {
        k: "h2",
        t: "Days 1–30: Foundation & history",
      },
      {
        k: "p",
        t: "**Once (week 1):** complete the Chapter 2 audit; claim every asset; connect your Google Business Profile; run and save the day-zero audit PDF; set up Search Console and GA4; import your full review history (extension + CSV); store your review links; invite whoever will handle responses.",
      },
      {
        k: "p",
        t: "**Daily (10 min):** ask every served customer for a review; respond to any new review.",
      },
      {
        k: "p",
        t: "**Weekly (45 min):** review the monitoring stream; log complaint themes; add 2 photos + 1 post to your GBP; fix one on-page basic.",
      },
      {
        k: "p",
        t: "**By day 30:** full history imported with baseline metrics; first 5–10 new reviews; 100% response rate; keyword shortlist drafted from review language.",
      },
      {
        k: "h2",
        t: "Days 31–60: Analysis & content",
      },
      {
        k: "p",
        t: "**Once:** full theme analysis; ship one operational fix for the top complaint; run the keyword and FAQ workflows; set up a rank-tracking basket of 10–25 terms; claim remaining citations; baseline your AI-visibility prompts; enable scheduled monitoring.",
      },
      {
        k: "p",
        t: "**By day 60:** 15+ total new reviews; FAQ live with structured data; audit score improved; rankings baselined; one measurable operational fix shipped.",
      },
      {
        k: "h2",
        t: "Days 61–90: Visibility & reporting",
      },
      {
        k: "p",
        t: "**Once:** first local landing page; CTR pass on underperforming pages; competitor review analysis; first monthly stakeholder report; content-gap check and fix.",
      },
      {
        k: "p",
        t: "**Monthly, forever:** KPI report; next month's #1 complaint fix; re-run the site audit; backlink snapshot.",
      },
      {
        k: "p",
        t: "**By day 90:** 20–30+ new reviews at a healthy rating; visible local-ranking movement; branded search growing; first AI mentions on tracked prompts (market-dependent); a repeatable monthly rhythm documented.",
      },
      {
        k: "h2",
        t: "The tracker",
      },
      {
        k: "table",
        head: [
          "KPI",
          "Day 0",
          "Day 30",
          "Day 60",
          "Day 90",
        ],
        rows: [
          [
            "Total reviews (primary platform)",
            "",
            "",
            "",
            "",
          ],
          [
            "Average rating (new reviews)",
            "",
            "",
            "",
            "",
          ],
          [
            "Response rate / median response time",
            "",
            "",
            "",
            "",
          ],
          [
            "Audit score",
            "",
            "",
            "",
            "",
          ],
          [
            "Keywords in top 20 / top 3",
            "",
            "",
            "",
            "",
          ],
          [
            "Branded impressions (GSC)",
            "",
            "",
            "",
            "",
          ],
          [
            "AI prompts with brand mention",
            "",
            "",
            "",
            "",
          ],
          [
            "Calls / leads / conversions",
            "",
            "",
            "",
            "",
          ],
        ],
      },
      {
        k: "p",
        t: "Targets are planning aids, not promises — adjust to your market. But if day 90 looks like day 0 on every row, the habit broke somewhere; the tracker tells you where.",
      },
      {
        k: "quote",
        paras: [
          "**Go deeper:** this course is the web edition of the complete Echorank field guide. Download the full 33-page PDF — with checklists, templates, and case studies — from the Resources page.",
        ],
      },
    ],
  },
];

export const LEARN_GUIDES: LearnGuide[] = [
  {
    slug: "review-request-templates",
    order: 1,
    title: "Review request templates that actually get answered",
    description: "Copy-paste email, SMS, invoice, and QR workflows — plus the timing rules and the compliance lines you must not cross.",
    readingTime: 8,
    tag: "Templates",
    blurb: "Email, SMS, invoice, and QR workflows — with the compliance lines you must not cross.",
    cta: "register",
    related: [
      {
        href: "/learn/generate-reviews-ethically",
        label: "Chapter 5: generate reviews ethically",
        internal: true,
      },
      {
        href: "/resources",
        label: "Resources: every guide and free tool",
        internal: true,
      },
    ],
    body: [
      {
        k: "p",
        t: "The difference between 3 reviews a year and 3 a week is rarely the business — it's whether asking is a system or an afterthought. This guide is the system: channel by channel, with the exact copy.",
      },
      {
        k: "h2",
        t: "The four rules",
      },
      {
        k: "ol",
        items: [
          "**Ask everyone.** Selecting who to ask based on how happy they seemed is review gating — prohibited by Google and detectable in your rating distribution.",
          "**Ask fast.** Same-day for services, 7–14 days post-delivery for products (after they've used it).",
          "**One tap.** Use the short share link from your Google Business Profile's \"Ask for reviews\". Every extra click halves completion.",
          "**Ask personally.** A message signed by the owner outperforms a no-reply blast.",
        ],
      },
      {
        k: "h2",
        t: "Email (same day or +1)",
      },
      {
        k: "quote",
        paras: [
          "**Subject:** How did we do, {{first_name}}?",
          "Hi {{first_name}}, thanks for choosing {{business}} for your {{service}} today. If you have 60 seconds, a Google review helps neighbours find us and tells us what to keep doing: {{review_link}}. If anything wasn't right, reply to this email and I'll fix it personally. — {{owner_name}}",
        ],
      },
      {
        k: "p",
        t: "One reminder after 5–7 days. Then stop — a second reminder costs goodwill.",
      },
      {
        k: "p",
        t: "The private-reply invitation is service recovery, not gating: everyone gets the same public link, and unhappy customers get an extra path to you first.",
      },
      {
        k: "h2",
        t: "SMS (within hours)",
      },
      {
        k: "quote",
        paras: [
          "Hi {{first_name}}, it's {{owner_name}} from {{business}}. Thanks for today! If you'd leave us a quick Google review it would mean a lot: {{review_link}} Reply STOP to opt out.",
        ],
      },
      {
        k: "p",
        t: "Highest response rates of any channel. One message, easy opt-out, respect local SMS consent law.",
      },
      {
        k: "h2",
        t: "Invoice / receipt line",
      },
      {
        k: "quote",
        paras: [
          "Happy with our work? A 60-second Google review helps us a lot: {{review_link}} (or scan the QR code).",
        ],
      },
      {
        k: "h2",
        t: "QR at point of service",
      },
      {
        k: "p",
        t: "Counter cards, table tents, van doors, packaging inserts — all pointing at the same short link.",
      },
      {
        k: "h2",
        t: "Post-purchase flow (e-commerce)",
      },
      {
        k: "p",
        t: "Day 7–14, after the product has been used, combined with a support check-in. Earlier asks review the unboxing, not the product.",
      },
      {
        k: "h2",
        t: "Running it without a spreadsheet",
      },
      {
        k: "p",
        t: "In Echorank, **Campaigns** send these on a schedule by email or SMS and guarantee nobody is asked twice; **Templates** store your house wording per channel and per language; **Review links** hold one short link per platform so every request lands in the right place. Requests count against your plan's monthly feedback-request quota, and the email channel is available from Starter, SMS from Growth.",
      },
    ],
  },
  {
    slug: "csv-review-import",
    order: 2,
    title: "CSV review import: the universal fallback",
    description: "One schema that swallows any platform's export — column reference, formatting rules, and the errors that reject rows.",
    readingTime: 6,
    tag: "Data",
    blurb: "One schema that swallows any platform's export, and the errors that reject rows.",
    cta: "register",
    related: [
      {
        href: "/learn/import-your-review-history",
        label: "Chapter 3: import your review history",
        internal: true,
      },
      {
        href: "/extension/howto-import-reviews.html",
        label: "Import reviews from a CSV, step by step",
      },
    ],
    body: [
      {
        k: "p",
        t: "Extensions and API connections cover the big platforms. For everything else — industry directories, a previous reputation tool, marketplace reviews, a spreadsheet someone kept by hand — one normalized CSV is the route.",
      },
      {
        k: "h2",
        t: "The schema",
      },
      {
        k: "code",
        t: "reviewer_name,rating,review_text,review_date,platform,review_url,owner_reply\n\"Jane D.\",5,\"Great service, fast and friendly.\",2026-05-14,GOOGLE,https://maps.google.com/...,\"Thanks Jane!\"\n\"Mark T.\",2,\"Waited too long, no follow-up.\",2026-04-30,TRUSTPILOT,,,",
      },
      {
        k: "table",
        head: [
          "Column",
          "Rules",
        ],
        rows: [
          [
            "reviewer_name",
            "Free text; quote if it contains commas.",
          ],
          [
            "rating",
            "Integer 1–5. Anything else rejects the row.",
          ],
          [
            "review_text",
            "Quote if it contains commas or line breaks.",
          ],
          [
            "review_date",
            "YYYY-MM-DD.",
          ],
          [
            "platform",
            "Uppercase source name: GOOGLE, FACEBOOK, TRUSTPILOT, OTHER.",
          ],
          [
            "review_url",
            "Optional.",
          ],
          [
            "owner_reply",
            "Optional — include your past responses so response-rate metrics start accurate.",
          ],
        ],
      },
      {
        k: "p",
        t: "Leave unknown fields empty rather than guessing. Files up to 5 MB; split larger ones.",
      },
      {
        k: "h2",
        t: "Mapping an export from another tool",
      },
      {
        k: "p",
        t: "Open the old tool's export in a spreadsheet, rename/reorder columns to the schema above, fix dates into YYYY-MM-DD (a single format cell + fill-down), and re-save as CSV. Ten minutes of spreadsheet work beats losing years of history.",
      },
      {
        k: "h2",
        t: "Facebook's odd shape",
      },
      {
        k: "p",
        t: "Facebook \"recommendations\" are yes/no rather than star-rated. If you're normalizing them by hand, a common convention is 5 for recommended and 1 for not recommended — just be consistent, and expect the rating distribution to look bimodal.",
      },
      {
        k: "h2",
        t: "When rows reject",
      },
      {
        k: "p",
        t: "Bad dates, ratings outside 1–5, and malformed quotes are the usual culprits. Fix the flagged rows in the spreadsheet, re-save, re-upload — imports skip duplicates, so partial retries are safe and you only need to correct the failures.",
      },
      {
        k: "h2",
        t: "Google Takeout: last resort",
      },
      {
        k: "p",
        t: "Takeout can export your Business Profile data, but the review export is JSON, arrives one file per location, and sometimes comes back without usable review text. If it does, fall back to the extension or the GBP connection instead of fighting it.",
      },
    ],
  },
  {
    slug: "ai-lens-content-gap",
    order: 3,
    title: "The content gap: why AI crawlers can't see your website",
    description: "Raw HTML vs rendered page, which crawlers execute JavaScript (few), how to measure your gap, and the rendering fixes that close it.",
    readingTime: 7,
    tag: "AI Visibility",
    blurb: "Raw HTML vs rendered page, how to measure the gap, and the rendering fixes that close it.",
    cta: "register",
    related: [
      {
        href: "/free-audit",
        label: "Check your own gap with the free audit",
        internal: true,
      },
      {
        href: "/learn/track-and-improve-ai-visibility",
        label: "Chapter 8: track and improve AI visibility",
        internal: true,
      },
    ],
    body: [
      {
        k: "p",
        t: "You can have perfect content and still be invisible to AI assistants — because many of their crawlers never run your JavaScript. What they see is your raw HTML; what your visitors see is the rendered page. The difference between the two is your **content gap**.",
      },
      {
        k: "h2",
        t: "Why the gap exists",
      },
      {
        k: "p",
        t: "Modern storefront and app frameworks often ship a nearly empty HTML shell and build the page in the browser. Human visitors never notice. Googlebot renders JavaScript (with delays and a budget). Most AI crawlers don't render at all — they read the shell, find nothing, and move on. Result: an assistant asked about your product category recommends competitors whose product detail exists in plain HTML.",
      },
      {
        k: "h2",
        t: "Measuring it",
      },
      {
        k: "p",
        t: "Compare the raw HTML your server sends against the fully rendered page and compute the share of content that only exists after rendering:",
      },
      {
        k: "ul",
        items: [
          "**0% gap** — crawlers see everything. Nothing to do.",
          "**Small gap** — usually widgets and chrome. Fine.",
          "**Large gap on money pages** — product detail, service descriptions, or FAQs invisible to non-rendering crawlers. This is the finding that explains missing AI mentions.",
        ],
      },
      {
        k: "p",
        t: "In Echorank this is the **AI Lens** tool: it computes the gap per page, and **Bot Analytics** shows whether AI and search crawlers actually visit — together they answer \"can they see it?\" and \"do they even come?\".",
      },
      {
        k: "h2",
        t: "Closing it",
      },
      {
        k: "p",
        t: "In order of preference:",
      },
      {
        k: "ol",
        items: [
          "**Server-side rendering (SSR)** for the pages that matter — the content arrives in the HTML.",
          "**Static pre-rendering** at build time for content that doesn't change per-request.",
          "**Selective pre-rendering** of the money pages only, if a full framework change is off the table.",
        ],
      },
      {
        k: "p",
        t: "After the fix, re-run the measurement: the gap on those pages should approach zero. Then give it weeks, not hours — crawlers revisit on their own schedule.",
      },
      {
        k: "h2",
        t: "What it looks like in practice",
      },
      {
        k: "p",
        t: "An outdoor-gear store on a JS-heavy theme tracked 10 category prompts at zero mentions. AI Lens showed product detail invisible to non-rendering crawlers. After pre-rendering product content and adding FAQ/Product structured data, the gap went to near zero — and first AI mentions appeared on 3 of 10 tracked prompts by day 90. Illustrative numbers, but the causal chain is the point: no crawlable content, no mentions.",
      },
    ],
  },
  {
    slug: "local-seo-checklist",
    order: 4,
    title: "The local SEO checklist for review-driven businesses",
    description: "GBP completeness, NAP consistency, core citations, structured data, and the weekly upkeep that keeps local rankings moving.",
    readingTime: 6,
    tag: "Local SEO",
    blurb: "GBP completeness, NAP consistency, citations, structured data, weekly upkeep.",
    cta: "register",
    related: [
      {
        href: "/learn/classic-seo-that-compounds",
        label: "Chapter 9: classic SEO that compounds",
        internal: true,
      },
      {
        href: "/visibility/tools",
        label: "Rank Tracker and Site Audit in the tools hub",
      },
    ],
    body: [
      {
        k: "p",
        t: "Local SEO is mostly a completeness-and-consistency game. This is the full checklist, ordered by leverage.",
      },
      {
        k: "h2",
        t: "1. Google Business Profile, complete",
      },
      {
        k: "ul",
        items: [
          "Claimed and verified",
          "Correct primary category (the single most consequential field)",
          "Services listed, hours accurate, description written from customer language",
          "Photos: add 2 per week; listings with fresh photos earn more actions",
          "The \"Ask for reviews\" short link in active use everywhere you ask",
        ],
      },
      {
        k: "h2",
        t: "2. NAP consistency",
      },
      {
        k: "p",
        t: "Your Name, Address, Phone must be **identical** — character for character — across your website footer, GBP, and every citation. Inconsistency is the classic silent killer of local rankings.",
      },
      {
        k: "h2",
        t: "3. Core citations",
      },
      {
        k: "p",
        t: "Claim these first: Google, Bing Places, Apple Maps, Facebook, Yelp, plus the 2–3 directories that matter in your vertical (Houzz, Avvo, Healthgrades, TripAdvisor…). Bing matters more than its search share suggests — it feeds several AI assistants.",
      },
      {
        k: "h2",
        t: "4. Structured data",
      },
      {
        k: "ul",
        items: [
          "**LocalBusiness** markup on your homepage/contact page, matching your NAP exactly",
          "**FAQPage** markup on a real FAQ built from questions customers actually ask",
          "Validate after every site change; re-run your site audit to confirm detection",
        ],
      },
      {
        k: "h2",
        t: "5. One page per service, city pages where justified",
      },
      {
        k: "p",
        t: "Each core service gets its own page with the keyword in title, H1, first paragraph, and URL. Build \"[service] in [city]\" pages only where you have real proof to show — review quotes from customers in that area are the strongest content those pages can carry.",
      },
      {
        k: "h2",
        t: "6. Weekly upkeep (45 minutes)",
      },
      {
        k: "ul",
        items: [
          "1 GBP post + 2 photos",
          "Respond to every new review (see the response formula in the Learn course)",
          "Fix one on-page basic — a title, an H1, a missing internal link",
        ],
      },
      {
        k: "h2",
        t: "7. Monthly",
      },
      {
        k: "ul",
        items: [
          "Rank check on a stable basket of 10–25 local terms — judge 4-week trends, not daily jumps",
          "Backlink snapshot; pursue one local link (chamber, supplier, sponsorship, local press)",
          "Compare calls and direction requests in GBP insights against last month",
        ],
      },
      {
        k: "p",
        t: "The compounding loop: reviews improve rankings and click-through → more customers → more reviews. The checklist exists to make sure nothing structural is blocking that loop from turning.",
      },
    ],
  },
  {
    slug: "install-browser-extension",
    order: 5,
    title: "Install the Echorank browser extension",
    description: "A five-step unpacked install for Chrome, Brave, Edge, Opera or Vivaldi — plus token setup, updates, and the FAQ.",
    readingTime: 5,
    tag: "Extension",
    blurb: "Five steps in any Chromium browser, token setup, updates — with the 2-minute video.",
    video: {
      placement: "inline",
      src: "https://echorank360.com/extension/echorank-extension-install.mp4",
      poster: "https://echorank360.com/extension/install-video-poster.jpg",
      title: "Watch the whole install in two minutes",
      uploadDate: "2026-07-27",
    },
    faq: [
      {
        q: "Where's my Echorank access token?",
        a: "On your dashboard's Extension page. Log in, choose Extension in the left menu, copy the token displayed, then paste it into the extension's settings and save.",
      },
      {
        q: "Is the \"Disable developer mode extensions\" message a problem?",
        a: "Not at all. Every unpacked extension triggers it. Close the notice and carry on.",
      },
      {
        q: "Can the unzipped folder go in the trash once I'm installed?",
        a: "No. Your browser re-reads the extension from it at every launch. Park it somewhere permanent; if it moves, run **Load unpacked** again from the new spot.",
      },
      {
        q: "The extension reports an unsupported page.",
        a: "It recognizes specific layouts, like your Google Business listing or Facebook business page, and disables import everywhere else on purpose. For those sources, the [CSV import](/learn/guides/csv-review-import) is the route.",
      },
      {
        q: "Is pasting my access token into the extension safe?",
        a: "Yes. It ties the extension to your account only, and imports travel over an encrypted connection. Handle it like a password — never share it, and rotate it from the dashboard's Extension page if it ever leaks.",
      },
      {
        q: "How do updates work?",
        a: "Download the newest zip, extract it over your current folder (or a fresh one), then hit the reload icon on the Echorank card in your extensions page — or remove it and **Load unpacked** once more.",
      },
    ],
    cta: "register",
    related: [
      {
        href: "/extension/download.html",
        label: "Extension download page — the same steps, on one page",
      },
      {
        href: "/learn/import-your-review-history",
        label: "Chapter 3: import your review history",
        internal: true,
      },
      {
        href: "/learn/guides/csv-review-import",
        label: "Guide: CSV review import",
        internal: true,
      },
    ],
    body: [
      {
        k: "p",
        t: "There's no \"export my reviews\" button on Google or Facebook. The Echorank extension captures the reviews already showing on the page and delivers them to your dashboard, where every one is automatically scored for sentiment and risk.",
      },
      {
        k: "p",
        t: "It works in Chromium browsers: Chrome, Brave, Edge, Opera and Vivaldi. Firefox and Safari aren't supported — on those, use the CSV import on the Data Sources page instead.",
      },
      {
        k: "video",
      },
      {
        k: "quote",
        paras: [
          "**Watch the whole install in two minutes:** grab the file, switch on developer mode, load the extension, then link it with your access token — the video shows each step, and the written version below follows it exactly.",
        ],
      },
      {
        k: "h2",
        t: "Five steps in any Chromium browser",
      },
      {
        k: "p",
        t: "This installs as an **unpacked extension** — a standard, supported method for loading extensions that don't come from a web store. One browser setting needs to be switched on.",
      },
      {
        k: "h3",
        t: "1. Get the file and unzip it",
      },
      {
        k: "p",
        t: "Download the zip from the [extension download page](https://echorank360.com/extension/download.html), then extract it to a folder you intend to keep, such as `Documents/echorank-extension`. The browser reads the extension from that folder at every startup, so it can't be deleted or relocated later.",
      },
      {
        k: "h3",
        t: "2. Go to your browser's extensions page",
      },
      {
        k: "table",
        head: [
          "Browser",
          "Address",
          "Developer mode toggle",
        ],
        rows: [
          [
            "Chrome",
            "`chrome://extensions`",
            "Top-right corner",
          ],
          [
            "Brave",
            "`brave://extensions`",
            "Top-right corner",
          ],
          [
            "Edge",
            "`edge://extensions`",
            "Left sidebar",
          ],
          [
            "Opera",
            "`opera://extensions`",
            "Top-right corner",
          ],
          [
            "Vivaldi",
            "`vivaldi://extensions`",
            "Top-right corner",
          ],
        ],
      },
      {
        k: "h3",
        t: "3. Enable Developer mode",
      },
      {
        k: "p",
        t: "Switch on the **Developer mode** toggle (its location is in the table above). Extra buttons appear at the top.",
      },
      {
        k: "h3",
        t: "4. Load unpacked",
      },
      {
        k: "p",
        t: "Hit **Load unpacked** and pick the folder from step 1. Echorank shows up in your extension list — installation complete.",
      },
      {
        k: "h3",
        t: "5. Link your account",
      },
      {
        k: "p",
        t: "Use the puzzle-piece icon in the toolbar to pin Echorank. Open the Extension page in your dashboard, copy your **access token**, drop it into the extension's settings, and save. You're connected.",
      },
      {
        k: "quote",
        paras: [
          "**Seeing \"Disable developer mode extensions\"?** Browsers display this at startup for any unpacked extension. It's expected — close it and everything keeps running.",
        ],
      },
      {
        k: "h2",
        t: "FAQ",
      },
      {
        k: "faq",
      },
      {
        k: "p",
        t: "Next step: [import your review history](/learn/import-your-review-history) — the extension route for Google and Facebook, plus CSV for everything else.",
      },
    ],
  },
];

export const ECHOPEDIA_TERMS: GlossaryTerm[] = [
  {
    term: "AI visibility",
    definition: "How often and how favorably AI assistants (ChatGPT, Claude, Gemini, etc.) mention or recommend a brand.",
  },
  {
    term: "Answer tracking",
    definition: "Recording whether specific AI prompts produce a mention of your brand, over time.",
  },
  {
    term: "Campaign",
    definition: "A scheduled review-request send (email or SMS) to a set of customers; Echorank ensures nobody is asked twice.",
  },
  {
    term: "Citation",
    definition: "Any listing of your business name, address, and phone (NAP) on another site.",
  },
  {
    term: "Content gap",
    definition: "The share of page content present after JavaScript rendering but absent from the raw HTML — invisible to non-rendering crawlers. Measured by AI Lens.",
  },
  {
    term: "CSV",
    definition: "Comma-separated values; a plain spreadsheet file any spreadsheet app can save.",
  },
  {
    term: "Feedback request",
    definition: "A single review-request send made through Campaigns; metered monthly per plan.",
  },
  {
    term: "GBP",
    definition: "Google Business Profile: your listing on Google Search and Maps.",
  },
  {
    term: "GSC",
    definition: "Google Search Console: Google's free tool showing your queries, clicks, and indexing status.",
  },
  {
    term: "Idempotent import",
    definition: "Re-sending the same data has no additional effect; duplicates are skipped automatically.",
  },
  {
    term: "MCP",
    definition: "Model Context Protocol: a standard letting AI agents call a service's tools. Echorank exposes one for its API.",
  },
  {
    term: "NAP",
    definition: "Name, Address, Phone — must be identical everywhere.",
  },
  {
    term: "Recovery ticket",
    definition: "A tracked service-recovery case for an unhappy customer caught before (or after) they post, routed to a named owner.",
  },
  {
    term: "Review gating",
    definition: "Filtering customers by satisfaction before showing them the public review link; prohibited by Google.",
  },
  {
    term: "SERP",
    definition: "Search engine results page.",
  },
  {
    term: "Structured data",
    definition: "Machine-readable markup (Schema.org, e.g. LocalBusiness, FAQPage) describing your content to search engines and AI crawlers.",
  },
  {
    term: "Tenant",
    definition: "One business workspace inside Echorank; agencies run one per client.",
  },
  {
    term: "Token (extension)",
    definition: "A one-time-shown secret key connecting the browser extension to a specific Echorank account.",
  },
];

export const ECHOPEDIA_SLUG = "echopedia";

export const ECHOPEDIA_TITLE = "Echopedia — the reputation & AI visibility glossary";

export const ECHOPEDIA_DESCRIPTION = "Every term from the Echorank guides, defined in one place.";

export function chapterBySlug(slug: string): LearnChapter | undefined {
  return LEARN_CHAPTERS.find((c) => c.slug === slug);
}

export function guideBySlug(slug: string): LearnGuide | undefined {
  return LEARN_GUIDES.find((g) => g.slug === slug);
}

/**
 * The article's own chapter video, if it has one.
 *
 * Narrows the union in ONE place so no page or test branches on `placement`
 * itself. An article whose video is prose-placed returns undefined here — it is
 * rendered by its marker instead.
 */
export function chapterVideoOf(article: {
  video?: LearnVideo;
}): ChapterVideo | undefined {
  return article.video?.placement === "chapter" ? article.video : undefined;
}

/** The article's prose-placed video, if it has one. Counterpart of the above. */
export function inlineVideoOf(article: { video?: LearnVideo }): InlineVideo | undefined {
  return article.video?.placement === "inline" ? article.video : undefined;
}

/** Previous/next in course order. Undefined at the ends — no wrap-around. */
export function chapterNeighbours(slug: string): {
  prev?: LearnChapter;
  next?: LearnChapter;
} {
  const i = LEARN_CHAPTERS.findIndex((c) => c.slug === slug);
  if (i < 0) return {};
  return { prev: LEARN_CHAPTERS[i - 1], next: LEARN_CHAPTERS[i + 1] };
}

/**
 * Anchor id for an h2/h3. Stable across builds because it is a pure function of
 * the heading text, which is what makes the in-page TOC links durable.
 */
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The h2s of a body, for the in-page table of contents. */
export function tableOfContents(body: readonly LearnBlock[]): { id: string; text: string }[] {
  return body
    .filter((b): b is { k: "h2"; t: string } => b.k === "h2")
    .map((b) => ({ id: headingId(b.t), text: b.t }));
}

/**
 * Every Knowledge Hub path, after the locale segment.
 *
 * The sitemap registry and the route-table test both read this, so a chapter
 * that exists in the config but has no page (or the reverse) is a test failure
 * rather than a silent 404 in sitemap.xml.
 */
export function learnRoutes(): string[] {
  return [
    LEARN_BASE,
    ...LEARN_CHAPTERS.map((c) => `${LEARN_BASE}/${c.slug}`),
    ...LEARN_GUIDES.map((g) => `${LEARN_BASE}/guides/${g.slug}`),
    `${LEARN_BASE}/${ECHOPEDIA_SLUG}`,
  ];
}
