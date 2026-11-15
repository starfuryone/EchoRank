// Module 1 — How answer engines decide. Original Echorank course copy.
// Rules for every lesson (tests/aeo-course.test.ts holds them): no statistics,
// no third-party course material or frameworks, no competitor products, no
// promise of rankings or citations, and fact / recommendation / unproven kept
// apart in callouts.

import type { AeoLesson } from "./types";

export const MODULE_1: AeoLesson[] = [
  {
    slug: "what-is-aeo",
    module: 1,
    title: "What AEO is, and what “being the answer” means",
    summary:
      "Answer engine optimization is the work of making your brand easy for AI assistants to find, trust, recommend and describe correctly. It builds on SEO rather than replacing it.",
    metaDescription:
      "What answer engine optimization (AEO) is, how it relates to SEO and GEO, and what it takes for an AI assistant to name your brand as the answer.",
    objectives: [
      "Define AEO in one sentence you can repeat to a colleague",
      "Separate what AEO shares with SEO from what it changes",
      "Recognise the four outcomes Echorank scores: Mentioned, Recommended, Cited, Accurate",
    ],
    produces: "A one-line AEO goal for your brand",
    // Everything else is derived: src/lib/aeo-course/video.ts.
    video: { file: "aeo-what-is-aeo", uploadDate: "2026-11-13" },
    body: [
      {
        k: "p",
        t: "Answer engine optimization (AEO) is the practice of making your brand easy for AI assistants to find, understand, trust and describe correctly, so that when someone asks a question you can answer, the assistant includes you in its reply. The short version: SEO earns you a place in a list; AEO earns you a place in the answer.",
      },
      {
        k: "p",
        t: "That difference sounds small and is not. A results page hands the searcher ten options and lets them choose. An assistant reads those options on the searcher's behalf, compresses them into a few sentences and usually names a handful of brands, or one. If you are not in those sentences, the searcher may never see your site at all.",
      },
      { k: "graphic", id: "serp-vs-answer" },
      { k: "h2", t: "AEO, SEO and GEO: one discipline, three lenses" },
      {
        k: "p",
        t: "You will meet three labels for overlapping work. SEO is optimising for classic search results. GEO, generative engine optimization, is the umbrella term for optimising for any system that generates an answer instead of listing pages. AEO focuses on the moment of the answer itself: the question a buyer asks and whether your brand is part of the reply. This course uses AEO because it keeps attention on the outcome, but the practical work is shared.",
      },
      {
        k: "p",
        t: "Most of what makes a site good for search still matters. Assistants that search the web before answering lean on pages a search engine can crawl, render and understand. What changes is the unit of success and the evidence that counts.",
      },
      {
        k: "table",
        caption: "SEO and AEO compared",
        head: ["", "SEO", "AEO"],
        rows: [
          ["Goal", "Rank a page for a query", "Be named, recommended and described correctly in the answer"],
          ["Unit of success", "A position on a results page", "A mention, a recommendation or a citation inside one answer"],
          ["What you optimise", "Pages, links and technical health", "The same, plus clear facts, independent evidence and consistency across the web"],
          ["How you measure", "Rankings, impressions, clicks", "A fixed panel of questions, scored answer by answer, over time"],
        ],
      },
      { k: "h2", t: "What “being the answer” actually means" },
      {
        k: "p",
        t: "Being the answer is not a single yes or no. Echorank scores every answer in four stages, which this course calls MRCA: Mentioned, Recommended, Cited, Accurate. A brand can pass one stage and fail the next, and each failure has a different fix.",
      },
      {
        k: "list",
        items: [
          "Mentioned: the assistant names you at all.",
          "Recommended: it suggests you for the need in the question, not just in passing.",
          "Cited: it links to or names a page you own as a source.",
          "Accurate: what it says about you is true and current.",
        ],
      },
      {
        k: "callout",
        tone: "recommendation",
        title: "Echorank recommends",
        t: "Track all four stages from the start. A brand that is mentioned often but described wrongly has a different problem from one that is never mentioned, and a single blended visibility score hides the difference.",
      },
      { k: "h2", t: "What AEO cannot promise" },
      {
        k: "p",
        t: "No one controls what an assistant says. Answers vary between runs of the same question, between platforms, between countries and languages, and from one month to the next as models and their sources change. AEO improves the odds that the evidence about you is findable, clear and consistent. It does not guarantee a mention, a ranking or a citation, and anyone who promises one is guessing.",
      },
      {
        k: "callout",
        tone: "fact",
        title: "Established",
        t: "AI answers are not fixed. The same prompt can produce different brands, sources and wording on different runs. Any single answer is an observation, not a ranking.",
      },
      {
        k: "callout",
        tone: "unproven",
        title: "Not yet proven",
        t: "Many tactics are sold as special “AI optimisation” that is different from good SEO. Some may help; few have been shown to. Until a tactic moves your own scorecard, treat it as an experiment.",
      },
      { k: "h2", t: "Worked example: Northwind Dental" },
      {
        k: "p",
        t: "Northwind Dental is a fictional two-location practice. Its owner asks an assistant, “Which dentists near Riverside offer evening appointments for children?” The answer names two competitors and says Northwind “may offer family dentistry”. Northwind is mentioned but not recommended, no Northwind page is cited, and the answer misses the fact that it opens until eight on weekdays.",
      },
      {
        k: "p",
        t: "That one answer already tells the team where to look. The evening hours are on the site, but only in an image of the opening times, which a crawler cannot read. The practice profile on a major map listing still shows old hours. The fix list writes itself: put the hours in text, correct the profile, and add a short page about children's appointments that answers the question directly.",
      },
      {
        k: "callout",
        tone: "example",
        title: "Northwind's one-line AEO goal",
        t: "When parents near our two locations ask an assistant about family or children's dentistry, we want to be recommended, with our own pages cited and our hours and services described correctly.",
      },
      { k: "h2", t: "Where AEO fits in your week" },
      {
        k: "p",
        t: "AEO is not a separate channel with its own team. It is a lens over work you already do: content, technical health, reviews and reputation, PR and partnerships. The rest of this course walks through that work in order: how answers are built, how to measure where you stand, how to make your site answerable, how to earn evidence elsewhere, and how to run the whole thing as a program.",
      },
    ],
    takeaways: [
      "AEO is about being included, recommended and described correctly inside an AI answer, not ranking a page in a list.",
      "Score answers in four stages (Mentioned, Recommended, Cited, Accurate), because each failure has a different fix.",
      "Answers vary by run, platform, locale and date; treat each one as an observation and never promise an outcome.",
    ],
    practice: {
      section: "engines",
      steps: [
        "Write the questions a buyer asks just before choosing a business like yours. Pick the three that matter most.",
        "Ask one of them in an assistant you use. Note whether your brand is mentioned, recommended, cited and described accurately.",
        "Write your one-line AEO goal in the worksheet, in the shape of Northwind's: who asks, what about, and which outcome you want.",
      ],
    },
    quiz: [
      {
        q: "What is the main difference between SEO and AEO?",
        options: [
          "AEO replaces SEO entirely",
          "SEO earns a place in a list; AEO earns a place inside the answer",
          "AEO only matters for paid search",
        ],
        correct: 1,
        explain: "AEO builds on SEO; the change is that success is measured inside one generated answer.",
      },
      {
        q: "An assistant names your brand but recommends a competitor. Which MRCA stage did you fail?",
        options: ["Mentioned", "Recommended", "Accurate"],
        correct: 1,
        explain: "You were mentioned; being suggested for the need is the Recommended stage.",
      },
      {
        q: "Your brand was recommended in one run of a prompt. What can you conclude?",
        options: [
          "You rank first for that prompt",
          "You will be recommended every time",
          "It is one observation; answers vary by run, platform and date",
        ],
        correct: 2,
        explain: "Single answers are observations. Trends come from repeated, logged runs.",
      },
    ],
    tool: {
      kind: "page",
      name: "Free AI Readiness Audit",
      body: "Check whether AI systems can read, trust and cite your site. No account needed.",
      href: "/free-audit",
      cta: "Run the free audit",
    },
  },
  {
    slug: "how-ai-answers-are-built",
    module: 1,
    title: "How AI answers are built",
    summary:
      "An assistant answers from what its model already knows, from pages it retrieves live, or from both. Understanding which one is in play tells you what you can influence.",
    metaDescription:
      "How AI assistants build an answer: model knowledge versus live retrieval, how one question fans out into sub-questions, and why answers change between runs.",
    objectives: [
      "Tell model knowledge apart from live retrieval in a real answer",
      "Explain how one question fans out into several searches",
      "Know why answers differ between runs, and what that means for measurement",
    ],
    produces: "A list of the sub-questions behind your top buyer question",
    video: { file: "aeo-02-how-ai-answers-are-built", uploadDate: "2026-11-14" },
    body: [
      {
        k: "p",
        t: "An AI answer comes from two places: what the model learned during training, and what it retrieves from the web or another index at the moment you ask. Many answers mix both. Knowing which one an answer leans on tells you where your influence lies: you shape model knowledge slowly and indirectly, and you shape retrieval through pages that can be found and read today.",
      },
      { k: "h2", t: "Model knowledge: what the assistant already believes" },
      {
        k: "p",
        t: "A language model is trained on a large body of text collected up to a cut-off date. From that text it learns associations: which brands appear with which problems, which descriptions recur, which claims are repeated by many independent sources. When an assistant answers without searching, it is drawing on those associations.",
      },
      {
        k: "p",
        t: "You cannot edit model knowledge directly, and changes reach it only when a model is retrained. What you can do is make sure the public record about you is consistent, specific and repeated by credible independent sources, so that the associations a future model learns are the right ones.",
      },
      { k: "h2", t: "Live retrieval: what the assistant looks up" },
      {
        k: "p",
        t: "When an assistant searches before answering, it sends one or more queries to a search index, reads a selection of the results and writes its answer from them. This is where most short-term AEO work pays off, because the pages it retrieves are pages you can improve, and the answer often shows them as sources.",
      },
      {
        k: "p",
        t: "Retrieval is also where small technical problems hurt most. A page the crawler cannot render, a fact that lives only in an image, or a robots rule that blocks the bot all keep your evidence out of the pile the assistant reads from.",
      },
      { k: "h2", t: "Fan-out: one question becomes several searches" },
      {
        k: "p",
        t: "Assistants rarely search for the exact words the user typed. A question with several parts is broken into narrower queries, each answered separately, and the results are combined. A buyer asking for the best CRM for a small sales team with a tight budget may trigger searches about small-team CRM features, pricing models, reviews and alternatives to one well-known product.",
      },
      { k: "graphic", id: "fan-out" },
      {
        k: "p",
        t: "This matters because your page does not have to match the whole question. It has to be the best answer to one of the sub-questions. A clear pricing page, an honest comparison page or a specific feature page can each earn a place in the final answer by winning one branch.",
      },
      {
        k: "callout",
        tone: "fact",
        title: "Established",
        t: "Several assistants describe breaking complex questions into multiple searches. The exact sub-queries are not shown to users and differ between products and runs.",
      },
      {
        k: "table",
        caption: "Where an answer's knowledge comes from",
        head: ["Knowledge source", "What it is good for", "How a brand influences it"],
        rows: [
          ["Model knowledge", "General explanations, well-known brands, stable facts", "Slowly: consistent descriptions repeated by credible independent sources"],
          ["Live web retrieval", "Current details, local options, comparisons, prices", "Directly: crawlable, specific pages that answer the sub-questions"],
          ["Structured listings and profiles", "Hours, locations, categories, ratings", "Keep every profile complete, current and consistent"],
          ["The conversation itself", "The user's constraints and follow-ups", "Not at all; this is why prompts with context behave differently"],
        ],
      },
      { k: "h2", t: "Why answers change from run to run" },
      {
        k: "p",
        t: "Generation involves sampling, so the same model can phrase the same answer differently and pick different examples. Retrieval adds more variation: search results shift, the assistant may choose different sub-queries, and the sources it reads change as the web changes. Location, language, account settings and earlier messages in the conversation all play a part.",
      },
      {
        k: "callout",
        tone: "recommendation",
        title: "Echorank recommends",
        t: "Never judge visibility from one answer. Run the same fixed questions repeatedly, log the platform, locale and date with each answer, and look at how often an outcome occurs across runs.",
      },
      { k: "h2", t: "Worked example: Lumen CRM" },
      {
        k: "p",
        t: "Lumen CRM is a fictional CRM for small sales teams. Its marketer asks an assistant, “What's a good CRM for a five-person sales team that needs email tracking and costs less than our current tool?” The answer recommends three products, not Lumen, and cites a comparison article and two pricing pages.",
      },
      {
        k: "p",
        t: "Working backwards, the team lists the likely sub-questions: CRMs for small sales teams, CRMs with email tracking, affordable CRM pricing, and alternatives to the product they named. Lumen has a strong feature page for email tracking but no public pricing page and no honest comparison page. Two of the four branches have nothing from Lumen to retrieve. That is the gap to close first, and it is far more useful than a general wish to “appear in AI”.",
      },
      {
        k: "callout",
        tone: "unproven",
        title: "Not yet proven",
        t: "Whether a particular page format is preferred by a particular assistant is often claimed and rarely demonstrated. Test changes on your own prompts before treating any format as a rule.",
      },
    ],
    takeaways: [
      "Answers draw on model knowledge, live retrieval or both; retrieval is where page-level work pays off soonest.",
      "One question fans out into several narrower searches, so a page only needs to win one branch.",
      "Variation between runs is normal; measure frequency across repeated, logged runs.",
    ],
    practice: {
      section: "engines",
      steps: [
        "Take the most important buyer question from lesson 1.",
        "Write the four or five narrower questions an assistant would need to answer to reply well.",
        "For each sub-question, note the page on your site that answers it best, or write “none”. The “none” rows go in your worksheet as gaps.",
      ],
    },
    quiz: [
      {
        q: "Which knowledge source can a brand influence most directly in the short term?",
        options: ["Model knowledge from training", "Pages retrieved live from the web", "The user's earlier messages"],
        correct: 1,
        explain: "Retrieved pages can be improved today; training data changes only when a model is retrained.",
      },
      {
        q: "What does fan-out mean for your content?",
        options: [
          "Each page must answer the whole buyer question",
          "A page can earn its place by answering one sub-question well",
          "Only the homepage is ever retrieved",
        ],
        correct: 1,
        explain: "The answer is assembled from several searches; winning one branch can be enough.",
      },
      {
        q: "Why should you log the platform, locale and date with every answer?",
        options: [
          "Answers vary by those factors, so comparisons need them",
          "Assistants require it",
          "It improves your ranking",
        ],
        correct: 0,
        explain: "Without the context of each run you cannot tell a real change from normal variation.",
      },
    ],
    tool: {
      kind: "page",
      name: "AI Visibility Methodology",
      body: "How Echorank measures AI visibility: what is asked, what is recorded and how results are compared.",
      href: "/methodology",
      cta: "Read the methodology",
    },
  },
  {
    slug: "engines-compared",
    module: 1,
    title: "Answer engines compared",
    summary:
      "ChatGPT, Gemini and Google's AI features, Perplexity, Claude and Copilot each find and show sources differently. Results from one do not transfer to another.",
    metaDescription:
      "How ChatGPT, Gemini, Google AI Overviews and AI Mode, Perplexity, Claude and Copilot surface sources, and why visibility in one engine does not transfer.",
    objectives: [
      "Know how each major engine tends to show its sources",
      "Understand why a result in one engine says little about another",
      "Choose which engines to track first for your audience",
    ],
    produces: "Your shortlist of engines to track, with a reason for each",
    video: { file: "aeo-03-engines-compared", uploadDate: "2026-11-15" },
    body: [
      {
        k: "p",
        t: "Each answer engine has its own index, its own way of deciding when to search and its own way of showing sources. A brand recommended in one can be absent from another for the same question. Track the engines your buyers actually use, check each one separately, and expect the details below to change: these products are updated often.",
      },
      {
        k: "callout",
        tone: "fact",
        title: "How to read this lesson",
        t: "The descriptions here are qualitative and current at the time of writing. They describe typical behaviour, not guarantees. Check each engine yourself with your own prompts before you rely on any of it.",
      },
      { k: "graphic", id: "engine-matrix" },
      { k: "h2", t: "The engines, one at a time" },
      { k: "h3", t: "ChatGPT" },
      {
        k: "p",
        t: "ChatGPT answers from model knowledge and, when it decides a question needs current information or the user asks it to, searches the web. Searched answers usually carry links to their sources. Its crawlers are documented separately for search and for training, which matters in lesson 7.",
      },
      { k: "h3", t: "Gemini, Google AI Overviews and AI Mode" },
      {
        k: "p",
        t: "Google's AI features sit on top of Google Search. AI Overviews appear above classic results for some queries and link to the pages they draw on. AI Mode is a conversational search experience with links in the answer. The Gemini assistant can also ground answers in Google Search. If your pages are not eligible for Google Search, they are unlikely to appear in these features.",
      },
      { k: "h3", t: "Perplexity" },
      {
        k: "p",
        t: "Perplexity is built around search. Almost every answer is assembled from retrieved pages and shows its sources prominently, which makes it a useful place to see which of your pages, if any, are being read.",
      },
      { k: "h3", t: "Claude" },
      {
        k: "p",
        t: "Claude answers from model knowledge and, where web search is enabled, from pages it retrieves, citing them in the answer. Whether search is on depends on the product and the user's settings, so the same question can behave differently for different people.",
      },
      { k: "h3", t: "Copilot" },
      {
        k: "p",
        t: "Microsoft Copilot grounds many answers in web search and shows citations alongside them. It draws on a different search index from Google's, which is one reason results do not match across engines.",
      },
      {
        k: "table",
        caption: "Answer engines at a glance (qualitative, check yourself)",
        head: ["Engine", "Shows citations?", "Typical use", "What to check first"],
        rows: [
          ["ChatGPT", "Usually, when it searches", "General questions, research, comparisons", "Whether your pages appear as sources on searched answers"],
          ["Google AI Overviews and AI Mode", "Yes, linked sources", "Questions asked in Google Search", "That your key pages are indexed and eligible in Google Search"],
          ["Gemini", "Sometimes, when grounded in search", "Assistant-style questions", "How it describes your brand without a search"],
          ["Perplexity", "Yes, prominently", "Research-style questions", "Which of your pages, if any, are read"],
          ["Claude", "When web search is enabled", "Analysis, writing, research", "Accuracy of the brand description from model knowledge"],
          ["Copilot", "Yes, alongside answers", "Work and search questions", "Results grounded in a different index from Google's"],
        ],
      },
      { k: "h2", t: "Why one result set does not transfer" },
      {
        k: "p",
        t: "Three things differ between engines: the index each one searches, the rules each one uses to decide when to search at all, and the sources each one tends to trust. A page that is well indexed in one search engine may be thin or missing in another. A brand that is well represented in training data may still lose a searched answer to a fresher page. That is why a single blended score across engines is less useful than a per-engine view.",
      },
      {
        k: "callout",
        tone: "recommendation",
        title: "Echorank recommends",
        t: "Start with the two or three engines your buyers use most, based on your own customer conversations, and add more once your process works. Report each engine separately before you combine anything.",
      },
      { k: "h2", t: "When engines disagree about you" },
      {
        k: "p",
        t: "Disagreement between engines is a clue, not noise. If one engine describes you correctly and another does not, compare the sources each one shows. Often the wrong answer traces back to a single outdated page: an old directory listing, a stale review profile or a press article about a product you have since renamed. Fixing that source can correct more than one engine at once.",
      },
      { k: "h2", t: "Worked example: Northwind Dental" },
      {
        k: "p",
        t: "Northwind asks its reception team which tools patients mention. Most say they searched Google; a few younger parents mention ChatGPT. Northwind tracks Google AI Overviews and ChatGPT first. In Google's answer it is mentioned through its map profile; in ChatGPT it is not mentioned at all for the same question, because the searched answer leans on a directory page where Northwind's listing is incomplete. Two engines, two different fixes.",
      },
      {
        k: "callout",
        tone: "unproven",
        title: "Not yet proven",
        t: "Claims that one engine “prefers” a particular site type or format are common and change quickly. Treat them as hypotheses to test on your own prompts.",
      },
    ],
    takeaways: [
      "Each engine has its own index, search rules and way of showing sources.",
      "A result in one engine says little about another; report engines separately.",
      "Start with the engines your buyers actually use, and re-check behaviour regularly because products change.",
    ],
    practice: {
      section: "engines",
      steps: [
        "Ask five recent customers, or your sales and support teams, which assistants buyers mention.",
        "Pick two or three engines to track first and write one sentence on why each matters.",
        "Ask your top buyer question in each one and note how each shows its sources.",
      ],
    },
    quiz: [
      {
        q: "Your brand is recommended in Perplexity. What does that tell you about ChatGPT?",
        options: ["You will be recommended there too", "Very little; check it separately", "ChatGPT copies Perplexity's sources"],
        correct: 1,
        explain: "Engines use different indexes and rules, so results do not transfer.",
      },
      {
        q: "Which engines are most tied to Google Search eligibility?",
        options: ["Copilot", "Google AI Overviews and AI Mode", "Claude"],
        correct: 1,
        explain: "Google's AI features draw on Google Search, so indexing there matters.",
      },
      {
        q: "How should you choose which engines to track first?",
        options: [
          "Track every engine at once",
          "Pick the ones your buyers actually use",
          "Pick the newest engine",
        ],
        correct: 1,
        explain: "Your own customers are the best evidence of where answers influence decisions.",
      },
    ],
    tool: {
      kind: "page",
      name: "Echorank AI Visibility",
      body: "Track how assistants answer about you, engine by engine, on the questions your buyers ask.",
      href: "/ai-visibility",
      cta: "See AI Visibility",
    },
  },
];
