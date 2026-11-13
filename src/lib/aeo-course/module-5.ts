// Module 5 — Run it as a program. Original Echorank course copy.

import type { AeoLesson } from "./types";

export const MODULE_5: AeoLesson[] = [
  {
    slug: "attribution-and-reporting",
    module: 5,
    title: "Attribution and reporting",
    summary:
      "AI referrals show up in analytics only partly. Combine them with bot activity, a “how did you hear about us” question and your MRCA trend, and report monthly.",
    metaDescription:
      "Report on AEO honestly: AI referrals in analytics and their blind spots, AI bot activity, self-reported attribution and the MRCA trend, in one monthly report.",
    objectives: [
      "Find AI referral traffic in your analytics and know what it misses",
      "Add self-reported attribution and bot activity to the picture",
      "Build a short monthly AEO report around the MRCA trend",
    ],
    produces: "A one-page monthly AEO report template",
    body: [
      {
        k: "p",
        t: "No single number shows what AI answers do for your business. Analytics captures some visits that come from AI assistants and misses others. Bot logs show which AI crawlers read your pages. Asking customers how they heard about you catches influence that never produced a click. Your MRCA scorecard shows whether answers are moving. Report all four together each month, with their blind spots written next to them.",
      },
      { k: "graphic", id: "dashboard-mock" },
      { k: "h2", t: "AI referrals in analytics" },
      {
        k: "p",
        t: "When someone clicks a source link in an AI answer, the visit often arrives with the assistant's domain as the referrer, and your analytics can group those visits into their own channel. Set up that grouping once, using the referrer domains of the engines you track, and keep the list up to date as products change their domains.",
      },
      {
        k: "callout",
        tone: "fact",
        title: "Established",
        t: "Not every visit from an AI assistant carries a referrer. Some apps strip it, some users copy a name and search for it, and many buyers read the answer and never click. AI referral traffic is a floor, not a total.",
      },
      { k: "h2", t: "The four sources of evidence" },
      {
        k: "table",
        caption: "AEO metrics, what they answer and what they miss",
        head: ["Metric", "Question it answers", "Blind spot", "Source"],
        rows: [
          ["AI referral visits", "Do answers send people to the site?", "Misses visits without a referrer and answers that end without a click", "Your web analytics"],
          ["AI bot activity", "Are AI crawlers reading our pages?", "Shows reading, not whether anything was used in an answer", "Server or CDN logs"],
          ["Self-reported attribution", "Did an assistant influence the decision?", "Depends on memory and on the options you offer", "A question on forms or at sign-up"],
          ["MRCA trend", "Are answers moving in our favour?", "Covers only the prompts in your panel", "Your scorecard"],
          ["Branded search demand", "Are more people looking for us by name?", "Many things move it besides AI answers", "Search console and analytics"],
        ],
      },
      { k: "h2", t: "Ask people how they heard about you" },
      {
        k: "p",
        t: "A short question on a demo form, at checkout or at the first appointment, such as “How did you hear about us?”, catches influence analytics cannot see. Offer an option for AI assistants and a free-text field. Expect the answers to be imperfect: people forget and simplify. Read them as a direction, compare them over time, and never treat them as precise.",
      },
      { k: "h2", t: "Bot activity as an early signal" },
      {
        k: "p",
        t: "Requests from AI crawlers that fetch for search show that your pages are being read. A new page that receives no such requests weeks after publishing may be blocked or undiscovered. Bot activity is a leading indicator for the Cited stage, not a result in itself.",
      },
      {
        k: "callout",
        tone: "recommendation",
        title: "Echorank recommends",
        t: "Keep the monthly report to one page: the MRCA trend per engine first, then share of answers, then the supporting evidence, then the changes you made and what you will do next. Write each metric's blind spot beside it.",
      },
      { k: "h2", t: "Who the report is for" },
      {
        k: "p",
        t: "Write the report for the people who decide what happens next: whoever owns the website, content, reviews and the budget. They need to know what moved, why you think it moved and what you are asking them to do. A line such as “the pricing page is now cited in one engine since the rendering fix; next, the same fix for the features page” is worth more than a chart nobody can act on.",
      },
      { k: "h2", t: "What not to claim" },
      {
        k: "p",
        t: "Resist turning partial signals into a single return-on-investment figure. AI influence is real and hard to measure, and an invented number undermines the honest parts of the report. Say what you observed, what it suggests and what you do not yet know.",
      },
      {
        k: "callout",
        tone: "unproven",
        title: "Not yet proven",
        t: "There is no accepted method for attributing revenue to AI answers. Methods that claim precision rest on assumptions; state them if you use one.",
      },
      { k: "h2", t: "Worked example: Lumen CRM" },
      {
        k: "p",
        t: "Lumen's first monthly report fits on a page. At the top, the MRCA stages for the unbranded prompts on two engines, this month against the baseline. Below, share of answers against the four tracked competitors. Then AI referral visits from analytics, labelled “a floor”, and the count of trial sign-ups that chose “an AI assistant” in the new how-did-you-hear question. Then bot requests to the rewritten pricing page since the server-rendering fix. Last, three changes made this month and three planned for next month. The report makes no revenue claim, and says so.",
      },
      {
        k: "p",
        t: "The illustration above shows the shape of such a report. Its bars and lines are placeholders, not data: your own numbers belong there.",
      },
    ],
    takeaways: [
      "AI referral traffic is a floor; many answers influence buyers without a click.",
      "Combine analytics, bot activity, self-reported attribution and the MRCA trend, each with its blind spot.",
      "Report monthly on one page and never invent a precise return figure.",
    ],
    practice: {
      section: "program",
      steps: [
        "Set up an analytics channel grouping for the referrer domains of the engines you track.",
        "Add a “How did you hear about us?” question with an AI assistant option to one form.",
        "Draft your one-page monthly report template in the worksheet, with a blind spot beside each metric.",
      ],
    },
    quiz: [
      {
        q: "Why is AI referral traffic called a floor?",
        options: [
          "It is always zero",
          "Many AI-influenced visits carry no referrer or produce no click",
          "Analytics double-counts it",
        ],
        correct: 1,
        explain: "Stripped referrers and no-click answers mean the real influence is larger.",
      },
      {
        q: "What does AI bot activity on a page show?",
        options: ["That the page was cited", "That AI crawlers are reading it", "That buyers saw it"],
        correct: 1,
        explain: "Reading is a leading signal, not proof of use in an answer.",
      },
      {
        q: "What should come first in a monthly AEO report?",
        options: ["A precise revenue figure", "The MRCA trend per engine", "A list of every prompt"],
        correct: 1,
        explain: "The scorecard trend is the core outcome; the rest supports it.",
      },
    ],
    tool: {
      kind: "seo",
      tool: "bot_analytics",
      name: "Bot Analytics",
      body: "Echorank's Bot Analytics monitors search-engine and AI crawler activity across your website, an early signal for the Cited stage.",
      href: "/technical-geo",
      cta: "See how it works",
    },
  },
  {
    slug: "your-90-day-aeo-plan",
    module: 5,
    title: "Your 90-day AEO plan",
    summary:
      "Turn the course into a program: a first week of setup, a 30, 60 and 90-day rhythm, a process for wrong answers about your brand, and clear rules for when to re-baseline.",
    metaDescription:
      "A 90-day AEO plan: first-week setup, a 30, 60 and 90-day rhythm, how to handle wrong or outdated AI answers about your brand, and when to re-baseline.",
    objectives: [
      "Plan the first week and the first 90 days of an AEO program",
      "Handle wrong or outdated answers about your brand with a repeatable process",
      "Know when to re-baseline your prompt panel",
    ],
    produces: "Your completed AEO plan, ready to share",
    body: [
      {
        k: "p",
        t: "An AEO program is a rhythm, not a project. In the first week, set up the measuring stick: engines, prompt panel and baseline scorecard. In the first 30 days, fix what is broken: access, rendering and wrong facts. By day 60, improve the pages that answer your weakest prompts and start the evidence work. By day 90, report the trend, decide what worked and plan the next quarter.",
      },
      { k: "graphic", id: "roadmap-90" },
      { k: "h2", t: "The first week" },
      {
        k: "list",
        ordered: true,
        items: [
          "Choose the engines to track, from what your buyers use (lesson 3).",
          "Build and freeze the prompt panel (lesson 4).",
          "Run the baseline and score it on the four MRCA stages (lesson 5).",
          "Check crawler access, CDN settings and your source-of-truth record (lessons 7 and 9).",
          "Name an owner for each part of the plan and a date for the first monthly report.",
        ],
      },
      { k: "h2", t: "The 30, 60, 90-day rhythm" },
      {
        k: "table",
        caption: "A 90-day AEO plan",
        head: ["Phase", "Focus", "Deliverable", "Owner"],
        rows: [
          ["Week 1", "Engines, prompt panel, baseline", "Frozen panel and scored baseline", "Marketing lead"],
          ["Days 1–30", "Access, rendering, wrong facts", "Crawler decisions applied; key facts in text; profiles consistent", "Web team and operations"],
          ["Days 31–60", "Answer-ready pages and evidence", "Rewritten pages for the weakest prompts; review and outreach routines running", "Content and customer teams"],
          ["Days 61–90", "Measure and decide", "Monthly reports, a stage-by-stage comparison with the baseline, next-quarter plan", "Marketing lead"],
        ],
      },
      {
        k: "callout",
        tone: "recommendation",
        title: "Echorank recommends",
        t: "Fix accuracy and access before anything else. A wrong fact or a blocked crawler undermines every other improvement, and both are usually cheap to fix.",
      },
      { k: "h2", t: "When an answer about you is wrong" },
      {
        k: "p",
        t: "Wrong or outdated answers will happen. Treat them as incidents with a simple routine. First, record the answer with its engine, locale, date and sources. Second, find the source of the error: your own page, a profile, a third-party article, or no visible source at all. Third, correct what you control and ask publishers to correct what you do not. Fourth, make the right fact easy to find in text on your own site, with a date. Fifth, re-check the prompt in later cycles rather than the next day, because answers change on their own schedule.",
      },
      {
        k: "callout",
        tone: "fact",
        title: "Established",
        t: "Most answer engines offer a way for users to report a poor answer. Reporting can help, but it is not a correction channel you control; fixing the underlying sources is.",
      },
      { k: "h2", t: "When to re-baseline" },
      {
        k: "p",
        t: "A baseline is useful only while the conditions behind it hold. Re-baseline, meaning run the full panel fresh and start a new comparison, when you add or retire many prompts, when you launch a major product or enter a new market, when you start tracking a new engine, or when an engine changes its product in a way that clearly changes its answers. Keep the old history; just stop comparing new results with it directly.",
      },
      {
        k: "callout",
        tone: "unproven",
        title: "Not yet proven",
        t: "How long a given improvement takes to show up in answers is not known in advance and differs by engine. Plan in quarters, not days, and let the scorecard decide what worked.",
      },
      { k: "h2", t: "Worked example: Northwind Dental's quarter" },
      {
        k: "p",
        t: "Northwind's first week produces a panel of twenty-two prompts on two engines and a baseline: mentioned in most answers, rarely recommended, never cited, hours wrong. In the first month it fixes the hours everywhere, puts them in text on the site and opens its CDN to the search crawlers. In the second month it rewrites the children's dentistry page answer-first and starts asking every patient for a review. In the third month its report shows the Accurate stage fixed, citations of the new page in one engine, and recommendations not yet moving. The next quarter's plan focuses on reviews and the second location's page.",
      },
      { k: "h2", t: "After day 90" },
      {
        k: "p",
        t: "The second quarter looks like the first, with less setup. Keep the panel and the monthly report running, review the pages and profiles on their schedule, and pick the next weakest stage to work on. Add prompts only for new products or markets. Once a year, check that the engines you track are still the ones your buyers use, and adjust the list before you re-baseline.",
      },
      { k: "h2", t: "Your plan" },
      {
        k: "p",
        t: "Every practice task in this course added a section to your AEO plan. The worksheet brings them together: engines, baseline, site fixes, off-site evidence and the program itself, with a summary on top. Finish the summary, share it with the people named as owners, and put the first monthly report in the calendar.",
      },
    ],
    takeaways: [
      "Set up the measuring stick in week one, fix access and accuracy in month one, then improve pages and evidence.",
      "Handle wrong answers as incidents: record, trace the source, correct, publish the fact, re-check later.",
      "Re-baseline when the panel, product, market or engines change significantly.",
    ],
    practice: {
      section: "summary",
      steps: [
        "Open the worksheet and complete the summary: goal, top three priorities, owners and the date of the first report.",
        "Fill the 90-day table with your own owners and dates.",
        "Copy the plan as text or print it, and share it with everyone named in it.",
      ],
    },
    quiz: [
      {
        q: "What should the first 30 days focus on?",
        options: ["New content at scale", "Access, rendering and wrong facts", "A revenue model"],
        correct: 1,
        explain: "Cheap fundamentals first: they undermine everything else when broken.",
      },
      {
        q: "An assistant states your old address. What is the first step?",
        options: [
          "Record the answer with its engine, locale, date and sources",
          "Change your address back",
          "Wait a year",
        ],
        correct: 0,
        explain: "Recording the answer and its sources lets you trace and fix the cause.",
      },
      {
        q: "When should you re-baseline your panel?",
        options: [
          "Every day",
          "After major changes to the panel, product, market or engines",
          "Never",
        ],
        correct: 1,
        explain: "A baseline only compares like with like while its conditions hold.",
      },
    ],
    tool: {
      kind: "page",
      name: "Set up AI Search tracking",
      body: "How Echorank asks AI assistants the questions your buyers ask and records whether they mention you, so the plan keeps running.",
      href: "/setup-ai-search-tracking",
      cta: "See the setup",
    },
  },
];
