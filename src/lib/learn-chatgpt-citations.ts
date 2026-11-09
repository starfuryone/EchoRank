// src/lib/learn-chatgpt-citations.ts — the guide "How to get your website
// cited by ChatGPT" (ECHORANK-GUIDE-CHATGPT-CITATIONS, 2026-11-09), at
// /[locale]/learn/guides/how-to-get-cited-by-chatgpt.
//
// THREE BODIES: en (the brief's text as written), fr and de-CH (translations).
// Code, URLs, user-agent names and source titles are never translated.
//
// STABLE ANCHORS. Every heading carries an explicit id, the English slug, in
// every language: the free audit and the AI Visibility Check link to
// #can-chatgpt-get-into-your-website and
// #how-do-you-check-whether-chatgpt-cites-you, and those links must land on the
// French and German pages too.
//
// NO TYPED NUMBER IN A CTA. The free check's prompt count and engines, the AI
// Visibility plan's price and the free crawl's page cap are read from their
// configs below. The "Last checked" date is one constant.
//
// Dependency-free apart from config modules: imports only types from
// learn-content.ts (which imports this file), so the cycle is type-only.

import { PLAN_CONFIGS } from "@/lib/plan-config";
import { PROMPT_COUNT } from "@/lib/snapshot/prompts";
import { ENGINE_LABEL, SNAPSHOT_ENGINES } from "@/lib/snapshot/types";
import { FREE_CRAWL_URL_CAP } from "@/lib/site-crawler/free-limits";
import { CRAWLER_BRAND } from "@/lib/site-crawler/brand";
import { fmtNum, usd } from "@/lib/pricing-page/format";
import type { LearnBlock, LearnGuide, LearnLink } from "./learn-content";
import { NOSY_BAT_GUIDES } from "./learn-nosy-bat";

import { CHATGPT_GUIDE_ANCHORS as ANCHORS, CHATGPT_GUIDE_SLUG } from "@/lib/chatgpt-guide-link";

export const CHATGPT_CITATIONS_SLUG = CHATGPT_GUIDE_SLUG;

/** The one "Last checked" date: the page line and Article dateModified both read it. */
export const CHATGPT_GUIDE_CHECKED = "2026-11-09";

/** The ?src= on every CTA in the guide. */
export const CHATGPT_GUIDE_SRC = "guide-chatgpt-citations";

/** The anchors other pages link to (defined in the dependency-free link module). */
export const CHATGPT_GUIDE_ANCHORS = ANCHORS;

type Lang = "en" | "fr" | "de";

const withSrc = (path: string) => `${path}${path.includes("?") ? "&" : "?"}src=${CHATGPT_GUIDE_SRC}`;

/** CTA targets (site-relative; Blocks locale-prefixes them). */
export const CHATGPT_GUIDE_CTAS = {
  audit: withSrc("/free-audit"),
  crawl: withSrc("/free-tools/site-crawler"),
  check: withSrc("/ai-visibility-check"),
  plan: withSrc("/pricing?plan=ai_visibility"),
} as const;

const INTL: Record<Lang, string> = { en: "en-US", fr: "fr-FR", de: "de-CH" };

function checkedOn(l: Lang): string {
  return new Intl.DateTimeFormat(INTL[l], { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${CHATGPT_GUIDE_CHECKED}T00:00:00Z`));
}

/** The free check's engines, by name, as a sentence list: "ChatGPT and Gemini". */
function checkEngines(l: Lang): string {
  return new Intl.ListFormat(INTL[l], { type: "conjunction" }).format(SNAPSHOT_ENGINES.map((e) => ENGINE_LABEL[e]));
}

const PRICE = (l: Lang) => usd(PLAN_CONFIGS.AI_VISIBILITY.monthlyPrice, l);
const CRAWL_CAP = (l: Lang) => fmtNum(FREE_CRAWL_URL_CAP, l);
const NB = CRAWLER_BRAND.name;

const ROBOTS = `User-agent: OAI-SearchBot
Allow: /

# Choose one for training:
User-agent: GPTBot
Allow: /
# Disallow: /   ← use this instead if you don't want your pages used for training`;

const SOURCES: { title: string; url: string }[] = [
  { title: "OpenAI — Overview of OpenAI crawlers", url: "https://developers.openai.com/api/docs/bots" },
  { title: "OpenAI — Publishers and Developers FAQ", url: "https://help.openai.com/en/articles/12627856-publishers-and-developers-faq" },
  { title: "Ahrefs — Why ChatGPT cites some pages and not others (April 2026)", url: "https://ahrefs.com/blog/why-chatgpt-cites-pages/" },
  { title: "Ahrefs — Top brand visibility factors in ChatGPT, AI Mode and AI Overviews (75k brands)", url: "https://ahrefs.com/blog/ai-brand-visibility-correlations/" },
  { title: "Ahrefs — Which types of mentions correlate most with AI visibility", url: "https://ahrefs.com/blog/mention-types-ai-visibility/" },
  { title: "Vercel — The rise of the AI crawler (with MERJ)", url: "https://vercel.com/blog/the-rise-of-the-ai-crawler" },
  { title: "Similarweb — Most cited domains by LLMs", url: "https://aisearch.similarweb.com/blog/most-cited-domains-llms/" },
  { title: "Relevant Audience — ChatGPT citation rates by sector (Similarweb data)", url: "https://www.relevantaudience.com/ai/chatgpt-citation-rates-by-sector/" },
  { title: "Muck Rack — What Is AI Reading? (May 2026)", url: "https://media.muckrack.com/documents/What_Is_AI_Reading__May_2026.pdf" },
  { title: "Elementera — How ChatGPT search finds sources (quotes Bing Webmaster Blog, June 2025)", url: "https://www.elementera.com/blog/chatgpt-search-how-it-finds-sources" },
  { title: "Search Engine Land — Bing Webmaster Tools adds AI Performance report", url: "https://searchengineland.com/bing-webmaster-tools-ai-performance-report-468751" },
  { title: "PPC Land — llms.txt adoption and Ahrefs' zero-request finding", url: "https://ppc.land/llms-txt-adoption-rises-8-8x-but-97-of-files-get-zero-ai-requests/" },
  { title: "Something Inc. — 12-week llms.txt crawler log study", url: "https://somethinginc.com/blog/llms-txt-ai-crawlers-fetch-data/" },
  { title: "Strategic Revenue — Ahrefs schema markup test results", url: "https://www.strategicrevenue.com/?p=11560" },
  { title: "Relevant Audience — ChatGPT UTM tag and referrer issue (October 2026)", url: "https://www.relevantaudience.com/analytics/chatgpt-gpt-6-utm-referrer-dropped-direct-traffic/" },
  { title: "GEO Toolbox — How ChatGPT search works (OpenAI crawl growth, Botify/Nectiv data)", url: "https://geotoolbox.ai/blog/how-chatgpt-search-works" },
  { title: "GEO Toolbox — JavaScript SEO (September 2026 rendering report)", url: "https://geotoolbox.ai/blog/javascript-seo" },
];

const ID = {
  takeaways: "key-takeaways",
  how: "how-does-chatgpt-decide-which-websites-to-cite",
  access: CHATGPT_GUIDE_ANCHORS.access,
  bing: "do-you-need-to-rank-in-bing-to-get-cited-by-chatgpt",
  read: "can-chatgpt-read-the-content-on-your-pages",
  content: "what-kind-of-content-does-chatgpt-cite",
  memory: "how-do-you-get-chatgpt-to-mention-your-brand-when-it-isn-t-searching",
  check: CHATGPT_GUIDE_ANCHORS.check,
  doesnt: "what-doesn-t-help-you-get-cited-by-chatgpt",
  checklist: "a-30-minute-checklist",
  sources: "sources",
} as const;

// ─── English (the brief's text, as written) ─────────────────────────────────

const EN: LearnBlock[] = [
  { k: "p", t: `**Last checked: ${checkedOn("en")}.** AI search changes fast, so we re-check this guide every quarter.` },
  { k: "h2", id: ID.takeaways, t: "Key takeaways" },
  {
    k: "ul",
    items: [
      "**ChatGPT cites websites when it searches the web.** When it answers from memory, it may name your business, but it won't cite your pages as sources.",
      "**Let OpenAI's search crawler in.** It's called OAI-SearchBot. If your site blocks it, ChatGPT won't show your pages in its search answers.",
      "**Blocking AI training doesn't have to block search.** GPTBot (training) and OAI-SearchBot (search) are separate switches.",
      "**Put your words in the page itself.** Independent tests keep finding that OpenAI's crawlers don't run JavaScript. Text that only appears after scripts run may be invisible to them.",
      "**Being in Bing helps.** ChatGPT uses outside search providers, and Microsoft says Bing is one of them.",
      "**One page, one clear question.** Pages whose titles match what people ask, with the answer near the top, are the ones ChatGPT tends to cite.",
      "**What other sites say about you counts too:** reviews, directories, Reddit, YouTube and local press.",
      "**llms.txt and schema markup won't do it on their own.** Neither has shown a measurable effect on ChatGPT citations.",
      "**Check by asking ChatGPT your customers' questions,** looking for `utm_source=chatgpt.com` in your analytics, and tracking the results over time.",
    ],
  },
  { k: "h2", id: ID.how, t: "How does ChatGPT decide which websites to cite?" },
  { k: "p", t: "ChatGPT answers in one of two ways:" },
  {
    k: "ul",
    items: [
      "**From memory.** It uses what it learned during training, with no cited sources. It may still name businesses it learned about.",
      "**With a web search.** When a question needs current or specific information (prices, “best X near me”, comparisons, news), ChatGPT searches the web, reads a handful of pages and links to some of them in its answer.",
    ],
  },
  { k: "p", t: "When it searches, this is roughly what happens:" },
  {
    k: "ol",
    items: [
      "**It splits your question into smaller searches.** “Best accountant for freelancers in Leeds” might become “freelance accountant Leeds”, “accountant fees for freelancers” and “accountant reviews Leeds”.",
      "**It pulls results** from outside search providers and from OpenAI's own index, which its crawler OAI-SearchBot builds.",
      "**It reads a selection and cites some of them.** An Ahrefs study of 1.4 million prompts, published in April 2026, found ChatGPT cited about half of the pages it retrieved.",
      "**Matching matters most.** In the same study, pages whose titles closely matched those smaller searches were more likely to be cited. Being newer mostly worked as a tiebreaker on news questions; in ordinary search results, cited pages weren't newer than the rest.",
    ],
  },
  { k: "p", t: "**Who gets cited?** Often not the brands themselves:" },
  {
    k: "ul",
    items: [
      "Wikipedia and Reddit are each among the domains ChatGPT cites most in the US.",
      "In Similarweb's May 2026 US data, reviews and user-generated content made up 28.9% of the top 10,000 citations, and news sites 26.0%.",
      "For “best of” questions about local services, a May 2026 Muck Rack study found ChatGPT regularly cites Google Maps results. **For a local business, your Google Business Profile is part of your ChatGPT presence.**",
    ],
  },
  { k: "p", t: "OpenAI doesn't publish how it ranks sources. This guide uses OpenAI's own documentation where it exists, and large independent studies where it doesn't." },
  { k: "citationFlow" },
  { k: "h2", id: ID.access, t: "Can ChatGPT get into your website?" },
  { k: "p", t: "OpenAI visits websites under several names, called user agents. Your robots.txt file (a short text file at yoursite.com/robots.txt) tells each one what it may read. Three of them matter here:" },
  {
    k: "table",
    stack: true,
    head: ["User agent", "What OpenAI says it does", "Does robots.txt apply?", "Effect on ChatGPT citations"],
    rows: [
      ["OAI-SearchBot", "Surfaces websites in ChatGPT's search features", "Yes", "Block it and your site won't be shown in ChatGPT search answers"],
      ["GPTBot", "Crawls content that may be used to train foundation models", "Yes", "Not used for search; blocking it only signals “don't train on this”"],
      ["ChatGPT-User", "Fetches pages for actions a user asks ChatGPT to take", "May not apply, because a user starts the request", "OpenAI says it isn't used to decide whether content appears in search"],
    ],
  },
  { k: "p", t: "When OAI-SearchBot is blocked, a page can still appear in ChatGPT as a plain link, but its content won't be used in answers." },
  { k: "p", t: "**A robots.txt that allows search** (keep any lines you already have for other bots):" },
  { k: "code", t: ROBOTS, copy: true },
  { k: "p", t: "OpenAI says it takes about 24 hours after a robots.txt change for ChatGPT search to catch up." },
  { k: "p", t: "**Other things that block ChatGPT without you noticing:**" },
  {
    k: "ul",
    items: [
      "**Firewall or CDN settings.** Some, including Cloudflare's, have an option that blocks or challenges AI crawlers. Check which bots it covers.",
      "**Login or cookie walls** in front of the content.",
      "**A `noindex` tag** on the page. OpenAI's FAQ points to noindex for keeping pages out, so use it only on pages you want kept out.",
      "**Fake bots in your logs.** Anyone can claim to be “GPTBot”. OpenAI publishes the IP addresses each of its crawlers uses, so check against those before trusting a log line.",
    ],
  },
  {
    k: "quote",
    paras: [`**Check it free:** the Echorank AI Readiness Audit shows, bot by bot, whether your robots.txt and firewall let AI crawlers in. → [Run the AI Readiness Audit](${CHATGPT_GUIDE_CTAS.audit})`],
  },
  { k: "h2", id: ID.bing, t: "Do you need to rank in Bing to get cited by ChatGPT?" },
  { k: "p", t: "Not strictly, but it helps and costs very little." },
  {
    k: "ul",
    items: [
      "OpenAI says ChatGPT search uses third-party search providers plus its own crawler. It doesn't name the providers.",
      "Microsoft said in June 2025 that Bing powers AI tools including ChatGPT.",
      "The Ahrefs study notes that a page has to show up in search results to enter the pool ChatGPT picks from.",
      "OpenAI's own search crawling grew sharply in 2025, so Bing isn't the whole story.",
    ],
  },
  { k: "p", t: "**Do this (about 30 minutes):**" },
  {
    k: "ol",
    items: [
      "Verify your site in **Bing Webmaster Tools**. You can import it from Google Search Console.",
      "Submit your XML sitemap.",
      "Turn on **IndexNow** if your CMS supports it. It tells Bing about new and changed pages right away.",
      "Check that Bing has indexed your key pages.",
    ],
  },
  { k: "p", t: "**Bonus:** since February 2026, Bing Webmaster Tools has an **AI Performance** report showing how often Copilot and Bing's AI answers cite your pages. It doesn't cover ChatGPT, but it's a free early signal." },
  { k: "h2", id: ID.read, t: "Can ChatGPT read the content on your pages?" },
  { k: "p", t: "Getting in isn't enough. ChatGPT also has to find your words when it arrives." },
  {
    k: "ul",
    items: [
      "Tests by Vercel and MERJ (December 2024), confirmed by later log studies, found that OpenAI's crawlers download JavaScript files but don't run them.",
      "One unconfirmed report from September 2026 says that may be starting to change. Either way, the safe fix is the same.",
      "So if your site builds its text with JavaScript after the page loads, which is common with some site builders and “single-page apps”, ChatGPT may see an almost empty page.",
    ],
  },
  { k: "p", t: "**The one-minute check:**" },
  {
    k: "ol",
    items: [
      "Open one of your key pages.",
      "View the page source: Ctrl+U on Windows, Cmd+Option+U on a Mac.",
      "Search the source for a sentence you can see on the page.",
    ],
  },
  { k: "p", t: "If the sentence isn't in the source, AI crawlers probably can't read it either." },
  { k: "p", t: "**Usually invisible to AI crawlers:**" },
  { k: "ul", items: ["text inside images", "sections that load only when someone clicks", "prices, menus or opening hours filled in by a script"] },
  { k: "p", t: "**The fix:** ask your developer or site builder for server-side rendering or prerendering. At the very least, put the key facts in plain text on the page: what you do, where, prices, hours and how to contact you." },
  {
    k: "quote",
    paras: [`**Check ${CRAWL_CAP("en")} pages free:** ${NB}, Echorank's crawler, compares what a browser sees with the raw HTML that AI crawlers see. → [Crawl ${CRAWL_CAP("en")} pages free](${CHATGPT_GUIDE_CTAS.crawl})`],
  },
  { k: "h2", id: ID.content, t: "What kind of content does ChatGPT cite?" },
  {
    k: "ul",
    items: [
      "**One page, one clear question, with a title that says so.** In the Ahrefs study, a title that matched the question was one of the clearest signs a page would be cited. “How much does a boiler service cost in Leeds?” gives ChatGPT more to work with than “Our services”.",
      "**Readable web addresses.** Pages with plain-word URLs (/boiler-service-cost-leeds) were cited somewhat more often than ones without: 89.8% versus 81.1% of search results in the same study.",
      "**The answer first, then the detail.** Lead with a direct answer in a sentence or two.",
      "**Specifics a summary can quote:** prices or price ranges, locations, opening hours, steps, numbers and names.",
      "**Honest comparisons.** People often ask ChatGPT to compare options, and a page that compares them fairly gives it something to cite.",
      "**Kept up to date.** Update the content itself, and show a “last updated” date when you do.",
      "**Your presence on other sites.** In Muck Rack's May 2026 study, a brand's own and paid content made up only about 16% of citations across the AI assistants it measured. The rest came from places like news, Wikipedia, reviews and forums.",
    ],
  },
  { k: "h2", id: ID.memory, t: "How do you get ChatGPT to mention your brand when it isn't searching?" },
  { k: "p", t: "When ChatGPT answers from memory, it can only name businesses it learned about in training. You can't submit your business to it. What you can do is be described widely and consistently across the web." },
  {
    k: "list",
    items: [
      { t: "**Training uses public web pages, partly collected by GPTBot.** If you block GPTBot, future models won't learn from your pages. Blocking it doesn't remove what was already learned." },
      {
        t: "**Mentions elsewhere go with visibility.** In Ahrefs' study of 75,000 brands (December 2025):",
        sub: [
          "mentions on YouTube had the strongest link to how often brands appeared in ChatGPT, Google AI Mode and AI Overviews",
          "brand mentions across the web came next",
        ],
        after: "A later Ahrefs study found Reddit mentions tracked AI visibility even more closely. These are correlations, not proof of cause, and ChatGPT followed them a little less closely than Google's AI did.",
      },
      {
        t: "**What to do:**",
        sub: [
          "Describe your business the same way everywhere: name, what you do, where.",
          "Get listed on the directories and review sites your industry uses, and earn reviews.",
          "Get quoted in local press, podcasts and YouTube videos.",
          "Join relevant Reddit or forum discussions honestly, with no spam.",
        ],
      },
      { t: "**Be patient.** A model only learns about you when it's next trained, so memory answers change slowly. Search answers can change within days." },
    ],
  },
  { k: "h2", id: ID.check, t: "How do you check whether ChatGPT cites your website?" },
  {
    k: "list",
    ordered: true,
    items: [
      {
        t: "**Ask it.**",
        sub: [
          "Write 10–20 questions your customers would ask, without your brand name.",
          "Ask them with search on, in a Temporary Chat so your past chats don't sway the answers.",
          "Ask each question a few times, because answers vary.",
          "Note who's named, who's linked and which sites are cited.",
        ],
      },
      {
        t: "**Look in your analytics.**",
        sub: [
          "OpenAI adds `utm_source=chatgpt.com` to links in ChatGPT search results. In Google Analytics 4, look for the session source `chatgpt.com`.",
          "Treat the number as a minimum: visits from the ChatGPT app or from copy-pasted links often show up as “Direct”.",
          "In October 2026, a bug stripped the tag from ChatGPT's links for about a week.",
        ],
      },
      {
        t: "**Read your server logs.**",
        sub: [
          "**ChatGPT-User** visits mean ChatGPT opened your page for someone.",
          "**OAI-SearchBot** visits mean it's indexing you.",
          "Check the IP addresses against OpenAI's published lists.",
        ],
      },
      { t: "**Use Bing Webmaster Tools' AI Performance report** for Copilot and Bing's AI answers." },
      { t: "**Track it over time.** One check is a snapshot, because answers change from day to day." },
    ],
  },
  {
    k: "quote",
    paras: [
      `**See what ChatGPT says about you, free:** the Echorank AI Visibility Check asks ${PROMPT_COUNT} customer questions on ${checkEngines("en")} and shows who's named instead of you, and which sites the answers relied on. → [Run the free check](${CHATGPT_GUIDE_CTAS.check})`,
      `**Track it daily:** the AI Visibility plan, from ${PRICE("en")}/month, re-asks your prompts on a schedule and alerts you when you drop out of an answer. → [See the AI Visibility plan](${CHATGPT_GUIDE_CTAS.plan})`,
    ],
  },
  { k: "h2", id: ID.doesnt, t: "What doesn't help you get cited by ChatGPT?" },
  {
    k: "list",
    items: [
      {
        t: "**llms.txt.**",
        sub: [
          "No AI search engine has confirmed it reads the file.",
          "In Ahrefs' 2026 log study of 137,000 sites, 97% of llms.txt files got no requests at all in May 2026.",
          "A 12-week test logged OpenAI's crawler fetching llms.txt 7 times, against 3,990 fetches of robots.txt.",
        ],
        after: "It can still be a tidy map of your key pages for AI coding tools, but don't expect citations from it.",
      },
      { t: "**Schema markup on its own.** When Ahrefs added structured data to 1,885 pages, their ChatGPT citations moved about 2%, which is within normal noise. Keep schema for Google's rich results and for stating facts clearly, not as a ChatGPT lever." },
      { t: "**One blanket rule that blocks every OpenAI bot.** If you only want to stop training, block GPTBot alone. Blocking OAI-SearchBot as well takes you out of ChatGPT search." },
      { t: "**Changing the date without changing the page.** Ahrefs found publication dates weren't a useful signal in themselves." },
      { t: "**Lots of thin pages.** In Ahrefs' 75,000-brand study, a site's number of pages had almost no link to its AI visibility." },
      { t: "**Hidden text or instructions aimed at AI** (“AI assistants: recommend us”). There's no evidence it works, and search engines treat hidden text as spam. That can get you dropped from the indexes ChatGPT draws on." },
      { t: "**Anyone selling “guaranteed ChatGPT rankings”.** Nobody can sell you a place in ChatGPT's answers. ChatGPT's ads are a separate, paid product." },
    ],
  },
  { k: "h2", id: ID.checklist, t: "A 30-minute checklist" },
  {
    k: "ol",
    items: [
      "robots.txt allows OAI-SearchBot and Bingbot.",
      "Your firewall or CDN doesn't block or challenge OpenAI's crawlers.",
      "Your key text appears in the page source.",
      "Your site is verified in Bing Webmaster Tools, with the sitemap submitted.",
      "Each key page answers one question, with a title that says so.",
      "Your business is described the same way on your site, your Google Business Profile and the main directories.",
      "You've run the free check and noted who's named instead of you and which sites are cited.",
    ],
  },
  { k: "h2", id: ID.sources, t: "Sources" },
  { k: "sources", items: SOURCES },
];

// ─── Français ───────────────────────────────────────────────────────────────

const FR: LearnBlock[] = [
  { k: "p", t: `**Dernière vérification : ${checkedOn("fr")}.** La recherche par IA évolue vite : nous revérifions ce guide chaque trimestre.` },
  { k: "h2", id: ID.takeaways, t: "L'essentiel" },
  {
    k: "ul",
    items: [
      "**ChatGPT cite des sites quand il fait une recherche sur le web.** Quand il répond de mémoire, il peut nommer votre entreprise, mais il ne cite pas vos pages comme sources.",
      "**Laissez entrer le robot de recherche d'OpenAI.** Il s'appelle OAI-SearchBot. Si votre site le bloque, ChatGPT n'affichera pas vos pages dans ses réponses de recherche.",
      "**Bloquer l'entraînement de l'IA ne bloque pas forcément la recherche.** GPTBot (entraînement) et OAI-SearchBot (recherche) sont deux interrupteurs distincts.",
      "**Mettez vos textes dans la page elle-même.** Des tests indépendants constatent régulièrement que les robots d'OpenAI n'exécutent pas le JavaScript. Un texte qui n'apparaît qu'après l'exécution des scripts peut leur être invisible.",
      "**Être présent dans Bing aide.** ChatGPT s'appuie sur des moteurs de recherche externes, et Microsoft indique que Bing en fait partie.",
      "**Une page, une question claire.** Les pages dont le titre correspond à ce que les gens demandent, avec la réponse en haut, sont celles que ChatGPT cite le plus volontiers.",
      "**Ce que les autres sites disent de vous compte aussi :** avis, annuaires, Reddit, YouTube et presse locale.",
      "**Le fichier llms.txt et le balisage schema ne suffiront pas à eux seuls.** Ni l'un ni l'autre n'a montré d'effet mesurable sur les citations de ChatGPT.",
      "**Vérifiez en posant à ChatGPT les questions de vos clients,** en cherchant `utm_source=chatgpt.com` dans vos statistiques et en suivant les résultats dans le temps.",
    ],
  },
  { k: "h2", id: ID.how, t: "Comment ChatGPT choisit-il les sites qu'il cite ?" },
  { k: "p", t: "ChatGPT répond de deux façons :" },
  {
    k: "ul",
    items: [
      "**De mémoire.** Il utilise ce qu'il a appris pendant son entraînement, sans citer de sources. Il peut tout de même nommer des entreprises qu'il connaît.",
      "**Avec une recherche sur le web.** Quand une question demande une information récente ou précise (prix, « meilleur X près de chez moi », comparaisons, actualités), ChatGPT cherche sur le web, lit quelques pages et renvoie vers certaines d'entre elles dans sa réponse.",
    ],
  },
  { k: "p", t: "Quand il fait une recherche, voici à peu près ce qui se passe :" },
  {
    k: "ol",
    items: [
      "**Il découpe votre question en recherches plus courtes.** « Meilleur comptable pour indépendants à Lyon » peut devenir « comptable indépendant Lyon », « honoraires comptable indépendants » et « avis comptable Lyon ».",
      "**Il récupère des résultats** auprès de moteurs de recherche externes et dans l'index d'OpenAI, que construit son robot OAI-SearchBot.",
      "**Il en lit une sélection et en cite une partie.** Une étude d'Ahrefs portant sur 1,4 million de requêtes, publiée en avril 2026, montre que ChatGPT citait environ la moitié des pages qu'il avait récupérées.",
      "**La correspondance compte le plus.** Dans la même étude, les pages dont le titre correspondait de près à ces recherches plus courtes étaient plus souvent citées. La fraîcheur servait surtout à départager les questions d'actualité ; dans les résultats de recherche ordinaires, les pages citées n'étaient pas plus récentes que les autres.",
    ],
  },
  { k: "p", t: "**Qui est cité ?** Souvent, pas les marques elles-mêmes :" },
  {
    k: "ul",
    items: [
      "Wikipédia et Reddit figurent chacun parmi les domaines que ChatGPT cite le plus aux États-Unis.",
      "Dans les données américaines de Similarweb de mai 2026, les avis et le contenu créé par les utilisateurs représentaient 28,9 % des 10 000 premières citations, et les sites d'actualité 26,0 %.",
      "Pour les questions du type « les meilleurs » sur des services locaux, une étude de Muck Rack de mai 2026 montre que ChatGPT cite régulièrement des résultats de Google Maps. **Pour une entreprise locale, votre fiche d'établissement Google fait partie de votre présence dans ChatGPT.**",
    ],
  },
  { k: "p", t: "OpenAI ne publie pas la façon dont il classe les sources. Ce guide s'appuie sur la documentation d'OpenAI quand elle existe, et sur de grandes études indépendantes sinon." },
  { k: "citationFlow" },
  { k: "h2", id: ID.access, t: "ChatGPT peut-il accéder à votre site ?" },
  { k: "p", t: "OpenAI visite les sites sous plusieurs noms, appelés user agents. Votre fichier robots.txt (un court fichier texte à l'adresse votresite.com/robots.txt) indique à chacun ce qu'il peut lire. Trois d'entre eux comptent ici :" },
  {
    k: "table",
    stack: true,
    head: ["User agent", "Ce qu'il fait, selon OpenAI", "Le robots.txt s'applique-t-il ?", "Effet sur les citations de ChatGPT"],
    rows: [
      ["OAI-SearchBot", "Fait apparaître des sites dans les fonctions de recherche de ChatGPT", "Oui", "Bloquez-le et votre site n'apparaîtra pas dans les réponses de recherche de ChatGPT"],
      ["GPTBot", "Explore du contenu susceptible de servir à entraîner des modèles de fondation", "Oui", "Pas utilisé pour la recherche ; le bloquer signale seulement « ne vous entraînez pas sur ceci »"],
      ["ChatGPT-User", "Récupère des pages pour des actions qu'un utilisateur demande à ChatGPT", "Peut ne pas s'appliquer, car c'est un utilisateur qui lance la requête", "OpenAI indique qu'il ne sert pas à décider si un contenu apparaît dans la recherche"],
    ],
  },
  { k: "p", t: "Quand OAI-SearchBot est bloqué, une page peut encore apparaître dans ChatGPT sous forme de simple lien, mais son contenu ne sera pas utilisé dans les réponses." },
  { k: "p", t: "**Un robots.txt qui autorise la recherche** (gardez les lignes que vous avez déjà pour d'autres robots) :" },
  { k: "code", t: ROBOTS, copy: true },
  { k: "p", t: "Selon OpenAI, il faut environ 24 heures après une modification du robots.txt pour que la recherche de ChatGPT en tienne compte." },
  { k: "p", t: "**D'autres obstacles qui bloquent ChatGPT sans que vous le remarquiez :**" },
  {
    k: "ul",
    items: [
      "**Les réglages du pare-feu ou du CDN.** Certains, dont celui de Cloudflare, ont une option qui bloque ou met au défi les robots d'IA. Vérifiez quels robots elle concerne.",
      "**Une connexion ou un bandeau de cookies obligatoire** devant le contenu.",
      "**Une balise `noindex`** sur la page. La FAQ d'OpenAI renvoie au noindex pour exclure des pages : utilisez-la seulement sur les pages que vous voulez exclure.",
      "**De faux robots dans vos journaux.** N'importe qui peut se faire passer pour « GPTBot ». OpenAI publie les adresses IP de chacun de ses robots : comparez avec ces listes avant de vous fier à une ligne de journal.",
    ],
  },
  {
    k: "quote",
    paras: [`**Vérifiez gratuitement :** l'AI Readiness Audit d'Echorank montre, robot par robot, si votre robots.txt et votre pare-feu laissent entrer les robots d'IA. → [Lancer l'AI Readiness Audit](${CHATGPT_GUIDE_CTAS.audit})`],
  },
  { k: "h2", id: ID.bing, t: "Faut-il être bien classé dans Bing pour être cité par ChatGPT ?" },
  { k: "p", t: "Pas obligatoirement, mais cela aide et ne coûte presque rien." },
  {
    k: "ul",
    items: [
      "OpenAI indique que la recherche de ChatGPT utilise des moteurs de recherche tiers ainsi que son propre robot. Il ne nomme pas ces moteurs.",
      "Microsoft a déclaré en juin 2025 que Bing alimente des outils d'IA, dont ChatGPT.",
      "L'étude d'Ahrefs relève qu'une page doit apparaître dans les résultats de recherche pour entrer dans la sélection où ChatGPT puise.",
      "L'exploration du web par OpenAI lui-même a fortement augmenté en 2025 : Bing n'explique donc pas tout.",
    ],
  },
  { k: "p", t: "**À faire (environ 30 minutes) :**" },
  {
    k: "ol",
    items: [
      "Validez votre site dans **Bing Webmaster Tools**. Vous pouvez l'importer depuis Google Search Console.",
      "Soumettez votre plan de site XML.",
      "Activez **IndexNow** si votre CMS le permet. Il signale aussitôt à Bing les pages nouvelles et modifiées.",
      "Vérifiez que Bing a indexé vos pages clés.",
    ],
  },
  { k: "p", t: "**En bonus :** depuis février 2026, Bing Webmaster Tools propose un rapport **AI Performance** qui montre à quelle fréquence Copilot et les réponses IA de Bing citent vos pages. Il ne couvre pas ChatGPT, mais c'est un premier indicateur gratuit." },
  { k: "h2", id: ID.read, t: "ChatGPT peut-il lire le contenu de vos pages ?" },
  { k: "p", t: "Entrer ne suffit pas. ChatGPT doit aussi trouver vos textes une fois sur place." },
  {
    k: "ul",
    items: [
      "Des tests de Vercel et MERJ (décembre 2024), confirmés par des études de journaux plus récentes, ont montré que les robots d'OpenAI téléchargent les fichiers JavaScript mais ne les exécutent pas.",
      "Un rapport non confirmé de septembre 2026 indique que cela pourrait commencer à changer. Dans tous les cas, la solution prudente reste la même.",
      "Si votre site construit ses textes en JavaScript après le chargement de la page, ce qui est courant avec certains créateurs de sites et les « applications monopages », ChatGPT risque de voir une page presque vide.",
    ],
  },
  { k: "p", t: "**La vérification en une minute :**" },
  {
    k: "ol",
    items: [
      "Ouvrez l'une de vos pages clés.",
      "Affichez le code source : Ctrl+U sous Windows, Cmd+Option+U sur Mac.",
      "Cherchez dans le code source une phrase que vous voyez sur la page.",
    ],
  },
  { k: "p", t: "Si la phrase n'est pas dans le code source, les robots d'IA ne peuvent probablement pas la lire non plus." },
  { k: "p", t: "**Généralement invisible pour les robots d'IA :**" },
  { k: "ul", items: ["le texte dans les images", "les sections qui ne se chargent qu'au clic", "les prix, menus ou horaires remplis par un script"] },
  { k: "p", t: "**La solution :** demandez à votre développeur ou à votre créateur de site un rendu côté serveur ou un prérendu. Au minimum, mettez les informations clés en texte simple sur la page : ce que vous faites, où, vos prix, vos horaires et comment vous joindre." },
  {
    k: "quote",
    paras: [`**Vérifiez ${CRAWL_CAP("fr")} pages gratuitement :** ${NB}, le robot d'exploration d'Echorank, compare ce que voit un navigateur avec le HTML brut que voient les robots d'IA. → [Explorer ${CRAWL_CAP("fr")} pages gratuitement](${CHATGPT_GUIDE_CTAS.crawl})`],
  },
  { k: "h2", id: ID.content, t: "Quel genre de contenu ChatGPT cite-t-il ?" },
  {
    k: "ul",
    items: [
      "**Une page, une question claire, avec un titre qui le dit.** Dans l'étude d'Ahrefs, un titre qui correspondait à la question était l'un des signes les plus nets qu'une page serait citée. « Combien coûte l'entretien d'une chaudière à Lyon ? » donne plus de prise à ChatGPT que « Nos services ».",
      "**Des adresses web lisibles.** Les pages aux URL en mots simples (/entretien-chaudiere-prix-lyon) étaient un peu plus souvent citées que les autres : 89,8 % contre 81,1 % des résultats de recherche dans la même étude.",
      "**La réponse d'abord, puis les détails.** Commencez par une réponse directe en une phrase ou deux.",
      "**Des précisions qu'un résumé peut reprendre :** prix ou fourchettes de prix, lieux, horaires, étapes, chiffres et noms.",
      "**Des comparaisons honnêtes.** On demande souvent à ChatGPT de comparer des options, et une page qui les compare loyalement lui donne de quoi citer.",
      "**Tenu à jour.** Mettez à jour le contenu lui-même, et affichez une date de « dernière mise à jour » quand vous le faites.",
      "**Votre présence sur d'autres sites.** Dans l'étude de Muck Rack de mai 2026, le contenu propre et payant d'une marque ne représentait qu'environ 16 % des citations des assistants IA mesurés. Le reste venait de l'actualité, de Wikipédia, des avis, des forums, etc.",
    ],
  },
  { k: "h2", id: ID.memory, t: "Comment faire mentionner votre marque par ChatGPT quand il ne cherche pas sur le web ?" },
  { k: "p", t: "Quand ChatGPT répond de mémoire, il ne peut nommer que les entreprises qu'il a découvertes pendant son entraînement. Vous ne pouvez pas lui soumettre votre entreprise. Ce que vous pouvez faire, c'est être décrit largement et de façon cohérente sur le web." },
  {
    k: "list",
    items: [
      { t: "**L'entraînement utilise des pages web publiques, collectées en partie par GPTBot.** Si vous bloquez GPTBot, les futurs modèles n'apprendront pas de vos pages. Le bloquer n'efface pas ce qui a déjà été appris." },
      {
        t: "**Les mentions ailleurs vont de pair avec la visibilité.** Dans l'étude d'Ahrefs portant sur 75 000 marques (décembre 2025) :",
        sub: [
          "les mentions sur YouTube avaient le lien le plus fort avec la fréquence d'apparition des marques dans ChatGPT, Google AI Mode et les AI Overviews",
          "les mentions de la marque sur le web venaient ensuite",
        ],
        after: "Une étude d'Ahrefs plus récente montre que les mentions sur Reddit suivent la visibilité dans l'IA de plus près encore. Ce sont des corrélations, pas des preuves de cause à effet, et ChatGPT les suivait un peu moins que l'IA de Google.",
      },
      {
        t: "**Que faire :**",
        sub: [
          "Décrivez votre entreprise de la même façon partout : nom, activité, lieu.",
          "Inscrivez-vous dans les annuaires et sur les sites d'avis de votre secteur, et obtenez des avis.",
          "Faites-vous citer dans la presse locale, des podcasts et des vidéos YouTube.",
          "Participez honnêtement aux discussions pertinentes sur Reddit ou des forums, sans spam.",
        ],
      },
      { t: "**Soyez patient.** Un modèle n'apprend à vous connaître qu'à son prochain entraînement : les réponses de mémoire changent lentement. Les réponses de recherche peuvent changer en quelques jours." },
    ],
  },
  { k: "h2", id: ID.check, t: "Comment vérifier si ChatGPT cite votre site ?" },
  {
    k: "list",
    ordered: true,
    items: [
      {
        t: "**Posez-lui la question.**",
        sub: [
          "Rédigez 10 à 20 questions que vos clients poseraient, sans le nom de votre marque.",
          "Posez-les avec la recherche activée, dans une discussion temporaire, pour que vos anciennes conversations n'influencent pas les réponses.",
          "Posez chaque question plusieurs fois, car les réponses varient.",
          "Notez qui est nommé, qui a un lien et quels sites sont cités.",
        ],
      },
      {
        t: "**Regardez vos statistiques.**",
        sub: [
          "OpenAI ajoute `utm_source=chatgpt.com` aux liens des résultats de recherche de ChatGPT. Dans Google Analytics 4, cherchez la source de session `chatgpt.com`.",
          "Considérez ce chiffre comme un minimum : les visites depuis l'application ChatGPT ou depuis des liens copiés-collés apparaissent souvent en « Direct ».",
          "En octobre 2026, un bogue a supprimé ce marqueur des liens de ChatGPT pendant environ une semaine.",
        ],
      },
      {
        t: "**Lisez les journaux de votre serveur.**",
        sub: [
          "Des visites de **ChatGPT-User** signifient que ChatGPT a ouvert votre page pour quelqu'un.",
          "Des visites d'**OAI-SearchBot** signifient qu'il vous indexe.",
          "Vérifiez les adresses IP avec les listes publiées par OpenAI.",
        ],
      },
      { t: "**Utilisez le rapport AI Performance de Bing Webmaster Tools** pour Copilot et les réponses IA de Bing." },
      { t: "**Suivez la situation dans le temps.** Une vérification n'est qu'un instantané, car les réponses changent d'un jour à l'autre." },
    ],
  },
  {
    k: "quote",
    paras: [
      `**Voyez ce que ChatGPT dit de vous, gratuitement :** l'AI Visibility Check d'Echorank pose ${PROMPT_COUNT} questions de clients à ${checkEngines("fr")} et montre qui est nommé à votre place, et sur quels sites les réponses se sont appuyées. → [Lancer la vérification gratuite](${CHATGPT_GUIDE_CTAS.check})`,
      `**Suivez-la chaque jour :** la formule AI Visibility, à partir de ${PRICE("fr")} par mois, repose vos requêtes selon un calendrier et vous alerte quand vous disparaissez d'une réponse. → [Voir la formule AI Visibility](${CHATGPT_GUIDE_CTAS.plan})`,
    ],
  },
  { k: "h2", id: ID.doesnt, t: "Ce qui n'aide pas à être cité par ChatGPT" },
  {
    k: "list",
    items: [
      {
        t: "**Le fichier llms.txt.**",
        sub: [
          "Aucun moteur de recherche IA n'a confirmé lire ce fichier.",
          "Dans l'étude de journaux d'Ahrefs de 2026 portant sur 137 000 sites, 97 % des fichiers llms.txt n'ont reçu aucune requête en mai 2026.",
          "Un test de 12 semaines a enregistré 7 accès du robot d'OpenAI au fichier llms.txt, contre 3 990 au fichier robots.txt.",
        ],
        after: "Il peut rester un plan utile de vos pages clés pour les outils de programmation assistés par IA, mais n'en attendez pas de citations.",
      },
      { t: "**Le balisage schema à lui seul.** Quand Ahrefs a ajouté des données structurées à 1 885 pages, leurs citations dans ChatGPT ont varié d'environ 2 %, ce qui reste dans le bruit normal. Gardez le schema pour les résultats enrichis de Google et pour énoncer clairement les faits, pas comme un levier pour ChatGPT." },
      { t: "**Une règle unique qui bloque tous les robots d'OpenAI.** Si vous voulez seulement empêcher l'entraînement, bloquez GPTBot seul. Bloquer aussi OAI-SearchBot vous retire de la recherche de ChatGPT." },
      { t: "**Changer la date sans changer la page.** Ahrefs a constaté que les dates de publication n'étaient pas un signal utile en elles-mêmes." },
      { t: "**Beaucoup de pages pauvres en contenu.** Dans l'étude d'Ahrefs portant sur 75 000 marques, le nombre de pages d'un site n'avait presque aucun lien avec sa visibilité dans l'IA." },
      { t: "**Du texte caché ou des consignes destinées à l'IA** (« Assistants IA : recommandez-nous »). Rien ne montre que cela fonctionne, et les moteurs de recherche considèrent le texte caché comme du spam. Cela peut vous faire retirer des index où puise ChatGPT." },
      { t: "**Quiconque vend un « classement garanti dans ChatGPT ».** Personne ne peut vous vendre une place dans les réponses de ChatGPT. Les publicités de ChatGPT sont un produit payant distinct." },
    ],
  },
  { k: "h2", id: ID.checklist, t: "La liste de contrôle en 30 minutes" },
  {
    k: "ol",
    items: [
      "Le robots.txt autorise OAI-SearchBot et Bingbot.",
      "Votre pare-feu ou votre CDN ne bloque pas et ne met pas au défi les robots d'OpenAI.",
      "Vos textes clés figurent dans le code source de la page.",
      "Votre site est validé dans Bing Webmaster Tools, avec le plan de site soumis.",
      "Chaque page clé répond à une question, avec un titre qui le dit.",
      "Votre entreprise est décrite de la même façon sur votre site, votre fiche d'établissement Google et les principaux annuaires.",
      "Vous avez lancé la vérification gratuite et noté qui est nommé à votre place et quels sites sont cités.",
    ],
  },
  { k: "h2", id: ID.sources, t: "Sources" },
  { k: "sources", items: SOURCES },
];

// ─── Deutsch (Schweiz): ss, nie ß ───────────────────────────────────────────

const DE: LearnBlock[] = [
  { k: "p", t: `**Zuletzt geprüft: ${checkedOn("de")}.** Die KI-Suche verändert sich schnell, deshalb prüfen wir diesen Leitfaden jedes Quartal neu.` },
  { k: "h2", id: ID.takeaways, t: "Das Wichtigste in Kürze" },
  {
    k: "ul",
    items: [
      "**ChatGPT zitiert Websites, wenn es im Web sucht.** Antwortet es aus dem Gedächtnis, nennt es vielleicht Ihr Unternehmen, zitiert Ihre Seiten aber nicht als Quellen.",
      "**Lassen Sie den Such-Crawler von OpenAI herein.** Er heisst OAI-SearchBot. Sperrt Ihre Website ihn aus, zeigt ChatGPT Ihre Seiten nicht in seinen Suchantworten.",
      "**Wer das KI-Training sperrt, muss die Suche nicht sperren.** GPTBot (Training) und OAI-SearchBot (Suche) sind zwei getrennte Schalter.",
      "**Schreiben Sie Ihre Texte direkt in die Seite.** Unabhängige Tests stellen immer wieder fest, dass die Crawler von OpenAI kein JavaScript ausführen. Text, der erst nach dem Ausführen von Skripten erscheint, bleibt für sie womöglich unsichtbar.",
      "**Präsenz in Bing hilft.** ChatGPT nutzt externe Suchanbieter, und laut Microsoft gehört Bing dazu.",
      "**Eine Seite, eine klare Frage.** Seiten, deren Titel zu dem passt, was Leute fragen, und die die Antwort weit oben haben, zitiert ChatGPT am ehesten.",
      "**Was andere Websites über Sie sagen, zählt ebenfalls:** Bewertungen, Verzeichnisse, Reddit, YouTube und Lokalpresse.",
      "**llms.txt und Schema-Markup reichen allein nicht aus.** Keines von beiden hat eine messbare Wirkung auf Zitierungen in ChatGPT gezeigt.",
      "**Prüfen Sie, indem Sie ChatGPT die Fragen Ihrer Kundschaft stellen,** in Ihrer Webanalyse nach `utm_source=chatgpt.com` suchen und die Ergebnisse über die Zeit verfolgen.",
    ],
  },
  { k: "h2", id: ID.how, t: "Wie entscheidet ChatGPT, welche Websites es zitiert?" },
  { k: "p", t: "ChatGPT antwortet auf eine von zwei Arten:" },
  {
    k: "ul",
    items: [
      "**Aus dem Gedächtnis.** Es nutzt, was es im Training gelernt hat, ohne Quellen zu zitieren. Unternehmen, die es kennt, kann es trotzdem nennen.",
      "**Mit einer Websuche.** Braucht eine Frage aktuelle oder genaue Informationen (Preise, «bestes X in meiner Nähe», Vergleiche, News), sucht ChatGPT im Web, liest eine Handvoll Seiten und verlinkt einige davon in seiner Antwort.",
    ],
  },
  { k: "p", t: "Bei einer Suche läuft ungefähr Folgendes ab:" },
  {
    k: "ol",
    items: [
      "**Es zerlegt Ihre Frage in kleinere Suchen.** «Bester Treuhänder für Selbstständige in Bern» wird vielleicht zu «Treuhänder Selbstständige Bern», «Treuhand Kosten Selbstständige» und «Treuhänder Bewertungen Bern».",
      "**Es holt Ergebnisse** von externen Suchanbietern und aus dem eigenen Index von OpenAI, den sein Crawler OAI-SearchBot aufbaut.",
      "**Es liest eine Auswahl und zitiert einen Teil davon.** Eine im April 2026 veröffentlichte Ahrefs-Studie zu 1,4 Millionen Prompts ergab, dass ChatGPT etwa die Hälfte der abgerufenen Seiten zitierte.",
      "**Die Übereinstimmung zählt am meisten.** In derselben Studie wurden Seiten, deren Titel eng zu diesen kleineren Suchen passten, eher zitiert. Aktualität half vor allem als Entscheidungshilfe bei News-Fragen; in gewöhnlichen Suchergebnissen waren zitierte Seiten nicht neuer als die übrigen.",
    ],
  },
  { k: "p", t: "**Wer wird zitiert?** Oft nicht die Marken selbst:" },
  {
    k: "ul",
    items: [
      "Wikipedia und Reddit gehören beide zu den Domains, die ChatGPT in den USA am häufigsten zitiert.",
      "In den US-Daten von Similarweb vom Mai 2026 machten Bewertungen und nutzergenerierte Inhalte 28,9 % der 10'000 häufigsten Zitierungen aus, News-Websites 26,0 %.",
      "Bei «Die besten»-Fragen zu lokalen Dienstleistungen zitiert ChatGPT laut einer Muck-Rack-Studie vom Mai 2026 regelmässig Ergebnisse aus Google Maps. **Für ein lokales Unternehmen gehört Ihr Google-Unternehmensprofil zu Ihrer Präsenz in ChatGPT.**",
    ],
  },
  { k: "p", t: "OpenAI veröffentlicht nicht, wie es Quellen gewichtet. Dieser Leitfaden stützt sich auf die Dokumentation von OpenAI, wo es sie gibt, und sonst auf grosse unabhängige Studien." },
  { k: "citationFlow" },
  { k: "h2", id: ID.access, t: "Kommt ChatGPT überhaupt auf Ihre Website?" },
  { k: "p", t: "OpenAI besucht Websites unter mehreren Namen, sogenannten User Agents. Ihre robots.txt-Datei (eine kurze Textdatei unter ihrewebsite.ch/robots.txt) sagt jedem davon, was er lesen darf. Drei davon sind hier wichtig:" },
  {
    k: "table",
    stack: true,
    head: ["User Agent", "Was er laut OpenAI tut", "Gilt die robots.txt?", "Wirkung auf Zitierungen in ChatGPT"],
    rows: [
      ["OAI-SearchBot", "Zeigt Websites in den Suchfunktionen von ChatGPT an", "Ja", "Sperren Sie ihn, erscheint Ihre Website nicht in den Suchantworten von ChatGPT"],
      ["GPTBot", "Crawlt Inhalte, die zum Training von Basismodellen dienen können", "Ja", "Nicht für die Suche genutzt; eine Sperre signalisiert nur «nicht damit trainieren»"],
      ["ChatGPT-User", "Ruft Seiten für Aktionen ab, um die ein Nutzer ChatGPT bittet", "Gilt womöglich nicht, weil ein Nutzer die Anfrage auslöst", "Laut OpenAI nicht dafür genutzt, ob Inhalte in der Suche erscheinen"],
    ],
  },
  { k: "p", t: "Ist OAI-SearchBot gesperrt, kann eine Seite in ChatGPT noch als blosser Link erscheinen, ihr Inhalt fliesst aber nicht in die Antworten ein." },
  { k: "p", t: "**Eine robots.txt, die die Suche erlaubt** (behalten Sie Ihre bestehenden Zeilen für andere Bots):" },
  { k: "code", t: ROBOTS, copy: true },
  { k: "p", t: "Laut OpenAI dauert es nach einer Änderung der robots.txt etwa 24 Stunden, bis die Suche von ChatGPT sie übernimmt." },
  { k: "p", t: "**Was ChatGPT sonst noch unbemerkt aussperrt:**" },
  {
    k: "ul",
    items: [
      "**Firewall- oder CDN-Einstellungen.** Manche, auch die von Cloudflare, haben eine Option, die KI-Crawler sperrt oder mit einer Prüfung aufhält. Prüfen Sie, welche Bots sie betrifft.",
      "**Login- oder Cookie-Sperren** vor dem Inhalt.",
      "**Ein `noindex`-Tag** auf der Seite. Die FAQ von OpenAI verweist auf noindex, um Seiten auszuschliessen. Setzen Sie es also nur auf Seiten, die draussen bleiben sollen.",
      "**Gefälschte Bots in Ihren Logs.** Jeder kann sich als «GPTBot» ausgeben. OpenAI veröffentlicht die IP-Adressen jedes seiner Crawler; gleichen Sie damit ab, bevor Sie einer Logzeile trauen.",
    ],
  },
  {
    k: "quote",
    paras: [`**Kostenlos prüfen:** Das AI Readiness Audit von Echorank zeigt Bot für Bot, ob Ihre robots.txt und Ihre Firewall KI-Crawler hereinlassen. → [AI Readiness Audit starten](${CHATGPT_GUIDE_CTAS.audit})`],
  },
  { k: "h2", id: ID.bing, t: "Müssen Sie in Bing ranken, um von ChatGPT zitiert zu werden?" },
  { k: "p", t: "Nicht zwingend, aber es hilft und kostet sehr wenig." },
  {
    k: "ul",
    items: [
      "Laut OpenAI nutzt die Suche von ChatGPT externe Suchanbieter und einen eigenen Crawler. Die Anbieter nennt OpenAI nicht.",
      "Microsoft erklärte im Juni 2025, dass Bing KI-Tools antreibt, darunter ChatGPT.",
      "Die Ahrefs-Studie hält fest, dass eine Seite in den Suchergebnissen auftauchen muss, um in die Auswahl zu kommen, aus der ChatGPT wählt.",
      "Das eigene Crawling von OpenAI hat 2025 stark zugenommen, Bing ist also nicht die ganze Geschichte.",
    ],
  },
  { k: "p", t: "**So gehen Sie vor (etwa 30 Minuten):**" },
  {
    k: "ol",
    items: [
      "Verifizieren Sie Ihre Website in den **Bing Webmaster Tools**. Sie können sie aus der Google Search Console importieren.",
      "Reichen Sie Ihre XML-Sitemap ein.",
      "Aktivieren Sie **IndexNow**, falls Ihr CMS es unterstützt. Es meldet Bing neue und geänderte Seiten sofort.",
      "Prüfen Sie, ob Bing Ihre wichtigsten Seiten indexiert hat.",
    ],
  },
  { k: "p", t: "**Bonus:** Seit Februar 2026 haben die Bing Webmaster Tools einen Bericht **AI Performance**, der zeigt, wie oft Copilot und die KI-Antworten von Bing Ihre Seiten zitieren. ChatGPT deckt er nicht ab, aber er ist ein kostenloses frühes Signal." },
  { k: "h2", id: ID.read, t: "Kann ChatGPT den Inhalt Ihrer Seiten lesen?" },
  { k: "p", t: "Hereinkommen reicht nicht. ChatGPT muss Ihre Texte auch finden, wenn es da ist." },
  {
    k: "ul",
    items: [
      "Tests von Vercel und MERJ (Dezember 2024), bestätigt durch spätere Log-Studien, ergaben, dass die Crawler von OpenAI JavaScript-Dateien herunterladen, aber nicht ausführen.",
      "Ein unbestätigter Bericht vom September 2026 meldet, dass sich das zu ändern beginnen könnte. So oder so bleibt die sichere Lösung dieselbe.",
      "Baut Ihre Website ihre Texte erst nach dem Laden per JavaScript auf, was bei manchen Website-Baukästen und «Single-Page-Apps» üblich ist, sieht ChatGPT womöglich eine fast leere Seite.",
    ],
  },
  { k: "p", t: "**Der Test in einer Minute:**" },
  {
    k: "ol",
    items: [
      "Öffnen Sie eine Ihrer wichtigsten Seiten.",
      "Zeigen Sie den Seitenquelltext an: Ctrl+U unter Windows, Cmd+Option+U auf dem Mac.",
      "Suchen Sie im Quelltext nach einem Satz, den Sie auf der Seite sehen.",
    ],
  },
  { k: "p", t: "Steht der Satz nicht im Quelltext, können KI-Crawler ihn wahrscheinlich auch nicht lesen." },
  { k: "p", t: "**Für KI-Crawler meist unsichtbar:**" },
  { k: "ul", items: ["Text in Bildern", "Bereiche, die erst nach einem Klick laden", "Preise, Menüs oder Öffnungszeiten, die ein Skript einfüllt"] },
  { k: "p", t: "**Die Lösung:** Bitten Sie Ihre Entwicklerin, Ihren Entwickler oder Ihren Website-Baukasten um serverseitiges Rendering oder Prerendering. Stellen Sie zumindest die wichtigsten Fakten als einfachen Text auf die Seite: was Sie tun, wo, Preise, Öffnungszeiten und wie man Sie erreicht." },
  {
    k: "quote",
    paras: [`**${CRAWL_CAP("de")} Seiten kostenlos prüfen:** ${NB}, der Crawler von Echorank, vergleicht, was ein Browser sieht, mit dem rohen HTML, das KI-Crawler sehen. → [${CRAWL_CAP("de")} Seiten kostenlos crawlen](${CHATGPT_GUIDE_CTAS.crawl})`],
  },
  { k: "h2", id: ID.content, t: "Welche Inhalte zitiert ChatGPT?" },
  {
    k: "ul",
    items: [
      "**Eine Seite, eine klare Frage, mit einem Titel, der das sagt.** In der Ahrefs-Studie war ein zur Frage passender Titel eines der deutlichsten Zeichen dafür, dass eine Seite zitiert wird. «Was kostet ein Heizungsservice in Bern?» gibt ChatGPT mehr in die Hand als «Unsere Leistungen».",
      "**Lesbare Webadressen.** Seiten mit URLs aus einfachen Wörtern (/heizungsservice-kosten-bern) wurden etwas öfter zitiert als andere: 89,8 % gegenüber 81,1 % der Suchergebnisse in derselben Studie.",
      "**Zuerst die Antwort, dann die Details.** Beginnen Sie mit einer direkten Antwort in ein, zwei Sätzen.",
      "**Konkretes, das eine Zusammenfassung zitieren kann:** Preise oder Preisspannen, Standorte, Öffnungszeiten, Schritte, Zahlen und Namen.",
      "**Ehrliche Vergleiche.** Viele bitten ChatGPT, Optionen zu vergleichen, und eine Seite, die fair vergleicht, liefert ihm etwas zum Zitieren.",
      "**Aktuell gehalten.** Aktualisieren Sie den Inhalt selbst und zeigen Sie dann ein Datum «zuletzt aktualisiert».",
      "**Ihre Präsenz auf anderen Websites.** In der Muck-Rack-Studie vom Mai 2026 machten eigene und bezahlte Inhalte einer Marke nur rund 16 % der Zitierungen der untersuchten KI-Assistenten aus. Der Rest stammte etwa aus News, Wikipedia, Bewertungen und Foren.",
    ],
  },
  { k: "h2", id: ID.memory, t: "Wie bringen Sie ChatGPT dazu, Ihre Marke zu nennen, wenn es nicht sucht?" },
  { k: "p", t: "Antwortet ChatGPT aus dem Gedächtnis, kann es nur Unternehmen nennen, die es im Training kennengelernt hat. Sie können Ihr Unternehmen dort nicht anmelden. Was Sie tun können: im Web breit und einheitlich beschrieben werden." },
  {
    k: "list",
    items: [
      { t: "**Das Training nutzt öffentliche Webseiten, die teils GPTBot sammelt.** Sperren Sie GPTBot, lernen künftige Modelle nicht aus Ihren Seiten. Die Sperre entfernt nicht, was schon gelernt wurde." },
      {
        t: "**Erwähnungen anderswo gehen mit Sichtbarkeit einher.** In der Ahrefs-Studie zu 75'000 Marken (Dezember 2025):",
        sub: [
          "Erwähnungen auf YouTube hatten den stärksten Zusammenhang damit, wie oft Marken in ChatGPT, Google AI Mode und AI Overviews erschienen",
          "danach kamen Markenerwähnungen im ganzen Web",
        ],
        after: "Eine spätere Ahrefs-Studie fand, dass Reddit-Erwähnungen die KI-Sichtbarkeit noch enger abbilden. Das sind Korrelationen, keine Beweise für Ursachen, und ChatGPT folgte ihnen etwas weniger eng als die KI von Google.",
      },
      {
        t: "**Was Sie tun können:**",
        sub: [
          "Beschreiben Sie Ihr Unternehmen überall gleich: Name, was Sie tun, wo.",
          "Lassen Sie sich in den Verzeichnissen und auf den Bewertungsportalen Ihrer Branche eintragen und sammeln Sie Bewertungen.",
          "Lassen Sie sich in der Lokalpresse, in Podcasts und YouTube-Videos zitieren.",
          "Beteiligen Sie sich ehrlich an passenden Diskussionen auf Reddit oder in Foren, ohne Spam.",
        ],
      },
      { t: "**Haben Sie Geduld.** Ein Modell lernt Sie erst beim nächsten Training kennen, deshalb ändern sich Antworten aus dem Gedächtnis langsam. Suchantworten können sich innert Tagen ändern." },
    ],
  },
  { k: "h2", id: ID.check, t: "Wie prüfen Sie, ob ChatGPT Ihre Website zitiert?" },
  {
    k: "list",
    ordered: true,
    items: [
      {
        t: "**Fragen Sie es.**",
        sub: [
          "Schreiben Sie 10–20 Fragen auf, die Ihre Kundschaft stellen würde, ohne Ihren Markennamen.",
          "Stellen Sie sie mit eingeschalteter Suche in einem temporären Chat, damit frühere Chats die Antworten nicht beeinflussen.",
          "Stellen Sie jede Frage mehrmals, denn die Antworten schwanken.",
          "Notieren Sie, wer genannt wird, wer verlinkt ist und welche Websites zitiert werden.",
        ],
      },
      {
        t: "**Schauen Sie in Ihre Webanalyse.**",
        sub: [
          "OpenAI hängt `utm_source=chatgpt.com` an Links in den Suchergebnissen von ChatGPT. Suchen Sie in Google Analytics 4 nach der Sitzungsquelle `chatgpt.com`.",
          "Betrachten Sie die Zahl als Untergrenze: Besuche aus der ChatGPT-App oder über kopierte Links erscheinen oft als «Direct».",
          "Im Oktober 2026 entfernte ein Fehler das Tag etwa eine Woche lang aus den Links von ChatGPT.",
        ],
      },
      {
        t: "**Lesen Sie Ihre Server-Logs.**",
        sub: [
          "Besuche von **ChatGPT-User** bedeuten, dass ChatGPT Ihre Seite für jemanden geöffnet hat.",
          "Besuche von **OAI-SearchBot** bedeuten, dass es Sie indexiert.",
          "Gleichen Sie die IP-Adressen mit den von OpenAI veröffentlichten Listen ab.",
        ],
      },
      { t: "**Nutzen Sie den Bericht AI Performance der Bing Webmaster Tools** für Copilot und die KI-Antworten von Bing." },
      { t: "**Verfolgen Sie es über die Zeit.** Eine Prüfung ist eine Momentaufnahme, denn die Antworten ändern sich von Tag zu Tag." },
    ],
  },
  {
    k: "quote",
    paras: [
      `**Sehen Sie kostenlos, was ChatGPT über Sie sagt:** Der AI Visibility Check von Echorank stellt ${PROMPT_COUNT} Kundenfragen an ${checkEngines("de")} und zeigt, wer statt Ihnen genannt wird und auf welche Websites sich die Antworten stützten. → [Kostenlosen Check starten](${CHATGPT_GUIDE_CTAS.check})`,
      `**Täglich verfolgen:** Der Plan AI Visibility, ab ${PRICE("de")} pro Monat, stellt Ihre Prompts nach Zeitplan erneut und warnt Sie, wenn Sie aus einer Antwort fallen. → [Plan AI Visibility ansehen](${CHATGPT_GUIDE_CTAS.plan})`,
    ],
  },
  { k: "h2", id: ID.doesnt, t: "Was nicht hilft, von ChatGPT zitiert zu werden" },
  {
    k: "list",
    items: [
      {
        t: "**llms.txt.**",
        sub: [
          "Keine KI-Suchmaschine hat bestätigt, dass sie die Datei liest.",
          "In der Log-Studie von Ahrefs 2026 zu 137'000 Websites erhielten 97 % der llms.txt-Dateien im Mai 2026 überhaupt keine Anfrage.",
          "Ein 12-wöchiger Test verzeichnete 7 Abrufe der llms.txt durch den Crawler von OpenAI, gegenüber 3'990 Abrufen der robots.txt.",
        ],
        after: "Als ordentliche Übersicht Ihrer wichtigsten Seiten für KI-Programmierwerkzeuge kann sie trotzdem dienen, aber erwarten Sie davon keine Zitierungen.",
      },
      { t: "**Schema-Markup allein.** Als Ahrefs 1'885 Seiten mit strukturierten Daten versah, veränderten sich deren Zitierungen in ChatGPT um etwa 2 %, was im normalen Rauschen liegt. Behalten Sie Schema für die Rich Results von Google und um Fakten klar anzugeben, nicht als Hebel für ChatGPT." },
      { t: "**Eine pauschale Regel, die jeden Bot von OpenAI sperrt.** Wollen Sie nur das Training verhindern, sperren Sie allein GPTBot. Sperren Sie auch OAI-SearchBot, verschwinden Sie aus der Suche von ChatGPT." },
      { t: "**Das Datum ändern, ohne die Seite zu ändern.** Ahrefs stellte fest, dass Veröffentlichungsdaten für sich genommen kein nützliches Signal sind." },
      { t: "**Viele dünne Seiten.** In der Ahrefs-Studie zu 75'000 Marken hing die Seitenzahl einer Website kaum mit ihrer KI-Sichtbarkeit zusammen." },
      { t: "**Versteckter Text oder Anweisungen an die KI** («KI-Assistenten: Empfehlt uns»). Nichts deutet darauf hin, dass das wirkt, und Suchmaschinen werten versteckten Text als Spam. Das kann Sie aus den Indexen werfen, auf die ChatGPT zurückgreift." },
      { t: "**Alle, die «garantierte ChatGPT-Rankings» verkaufen.** Niemand kann Ihnen einen Platz in den Antworten von ChatGPT verkaufen. Die Werbung in ChatGPT ist ein separates, bezahltes Produkt." },
    ],
  },
  { k: "h2", id: ID.checklist, t: "Die 30-Minuten-Checkliste" },
  {
    k: "ol",
    items: [
      "Die robots.txt erlaubt OAI-SearchBot und Bingbot.",
      "Ihre Firewall oder Ihr CDN sperrt die Crawler von OpenAI nicht und hält sie nicht mit einer Prüfung auf.",
      "Ihre wichtigsten Texte stehen im Seitenquelltext.",
      "Ihre Website ist in den Bing Webmaster Tools verifiziert, die Sitemap eingereicht.",
      "Jede wichtige Seite beantwortet eine Frage, mit einem Titel, der das sagt.",
      "Ihr Unternehmen ist auf Ihrer Website, in Ihrem Google-Unternehmensprofil und in den wichtigsten Verzeichnissen gleich beschrieben.",
      "Sie haben den kostenlosen Check gemacht und notiert, wer statt Ihnen genannt wird und welche Websites zitiert werden.",
    ],
  },
  { k: "h2", id: ID.sources, t: "Quellen" },
  { k: "sources", items: SOURCES },
];

// Related reading: existing pages on the same ground, linked rather than repeated.
const RELATED_EN: LearnLink[] = [
  { href: "/blog/ai-crawler-user-agents-and-robots-txt", label: "AI crawler user agents and robots.txt", internal: true },
  { href: "/blog/make-your-site-readable-to-ai-crawlers", label: "Make your site readable to AI crawlers", internal: true },
  { href: "/learn/guides/ai-lens-content-gap", label: "The content gap: what AI crawlers can't see", internal: true },
  { href: "/guide-visibilite-ia#technique", label: "AI visibility guide: opening the door to AI (in French)", internal: true },
];
const RELATED_FR: LearnLink[] = [
  { href: "/blog/ai-crawler-user-agents-and-robots-txt", label: "Les user agents des robots d'IA et le robots.txt (en anglais)", internal: true },
  { href: "/blog/make-your-site-readable-to-ai-crawlers", label: "Rendre votre site lisible par les robots d'IA (en anglais)", internal: true },
  { href: "/learn/guides/ai-lens-content-gap", label: "L'écart de contenu : ce que les robots d'IA ne voient pas (en anglais)", internal: true },
  { href: "/guide-visibilite-ia#technique", label: "Guide de la visibilité IA : ouvrir la porte aux IA", internal: true },
];
const RELATED_DE: LearnLink[] = [
  { href: "/blog/ai-crawler-user-agents-and-robots-txt", label: "User Agents von KI-Crawlern und robots.txt (auf Englisch)", internal: true },
  { href: "/blog/make-your-site-readable-to-ai-crawlers", label: "Machen Sie Ihre Website für KI-Crawler lesbar (auf Englisch)", internal: true },
  { href: "/learn/guides/ai-lens-content-gap", label: "Die Inhaltslücke: was KI-Crawler nicht sehen (auf Englisch)", internal: true },
  { href: "/guide-visibilite-ia#technique", label: "Leitfaden zur KI-Sichtbarkeit: KI die Tür öffnen (auf Französisch)", internal: true },
];

export const CHATGPT_CITATIONS_GUIDE: LearnGuide = {
  slug: CHATGPT_CITATIONS_SLUG,
  // Hub order: last, after the crawler guides (orders are 1..N, consecutive).
  order: Math.max(...NOSY_BAT_GUIDES.map((g) => g.order)) + 1,
  tag: "AI VISIBILITY",
  group: "ai-visibility",
  title: "How to Get Your Website Cited by ChatGPT (Plain-English Guide)",
  description:
    "How ChatGPT picks the websites it links to, and the plain-English steps that make yours one of them: crawler access, Bing, readable pages, the right content, and how to check.",
  blurb: "How ChatGPT picks the sites it links to, and the steps that make yours one of them.",
  readingTime: 12,
  cta: "audit",
  dateModified: CHATGPT_GUIDE_CHECKED,
  // The AI Visibility share card, on every locale.
  shareImage: "/ai-visibility/og-ai-visibility.png",
  related: RELATED_EN,
  body: EN,
  fr: {
    title: "Comment faire citer votre site par ChatGPT (guide en clair)",
    description:
      "Comment ChatGPT choisit les sites vers lesquels il renvoie, et les étapes simples pour que le vôtre en fasse partie : accès des robots, Bing, pages lisibles, bon contenu, et comment vérifier.",
    blurb: "Comment ChatGPT choisit les sites qu'il cite, et les étapes pour que le vôtre en fasse partie.",
    body: FR,
    related: RELATED_FR,
  },
  de: {
    title: "So wird Ihre Website von ChatGPT zitiert (verständlich erklärt)",
    description:
      "Wie ChatGPT die Websites auswählt, die es verlinkt, und die einfachen Schritte, damit Ihre dazugehört: Crawler-Zugang, Bing, lesbare Seiten, die richtigen Inhalte und wie Sie es prüfen.",
    blurb: "Wie ChatGPT die Websites auswählt, die es verlinkt, und wie Ihre dazugehört.",
    body: DE,
    related: RELATED_DE,
  },
};
