// Module 4 — Earn trust beyond your site. Original Echorank course copy.

import type { AeoLesson } from "./types";

export const MODULE_4: AeoLesson[] = [
  {
    slug: "reviews-and-reputation-as-evidence",
    module: 4,
    title: "Reviews and reputation as evidence",
    summary:
      "For “best X near me” and “is X any good” questions, assistants lean on what customers and directories say about you. Review recency, responses and consistent business facts are evidence you can improve honestly.",
    metaDescription:
      "Why reviews and consistent business facts shape AI answers to “best near me” questions, and how to improve review recency, responses and profiles honestly.",
    objectives: [
      "Identify the reputation signals assistants can draw on for your business",
      "Find and fix inconsistent business facts across profiles and directories",
      "Grow reviews honestly, without fake, paid or gated reviews",
    ],
    produces: "A reputation evidence map with the inconsistencies to fix",
    body: [
      {
        k: "p",
        t: "When someone asks an assistant which business to choose, the answer needs evidence that does not come from the business itself. Reviews and public profiles are often that evidence. How many reviews you have, how recent they are, whether you reply, and whether your name, address, hours and services match everywhere all shape what an assistant can say about you. This is Echorank's home ground, and it is the part of AEO where honest, steady work pays off.",
      },
      { k: "graphic", id: "evidence-map" },
      { k: "h2", t: "Why reputation shows up in answers" },
      {
        k: "p",
        t: "Questions like “best family dentist near me” or “is Lumen CRM any good” are requests for a judgement. An assistant answering them looks for independent signals that support one: what customers say, what directories and review platforms list, how a business responds to criticism. A business that describes itself as excellent is making a claim; many recent customers saying so is evidence.",
      },
      {
        k: "callout",
        tone: "fact",
        title: "Established",
        t: "Map listings, review platforms and directories are among the sources assistants show for local and “is it any good” questions. Which ones appear varies by engine, country and category.",
      },
      { k: "h2", t: "The signals that matter" },
      {
        k: "table",
        caption: "Reputation signals and how to improve them honestly",
        head: ["Reputation signal", "Where it lives", "How to improve it honestly"],
        rows: [
          ["Review recency", "Map profiles, review platforms, app stores", "Ask every customer at the right moment, steadily, not in bursts"],
          ["Review volume", "The same platforms", "Make asking part of the process; never buy or incentivise reviews"],
          ["Responses to reviews", "Under each review", "Reply to positive and negative reviews, specifically and calmly"],
          ["Consistent business facts", "Profiles, directories, your own site", "One source of truth for name, address, hours and services, copied everywhere"],
          ["What reviews actually say", "Review text", "Fix the recurring problems customers describe; the text follows"],
        ],
      },
      { k: "h2", t: "Inconsistent facts: the quiet problem" },
      {
        k: "p",
        t: "Over the years a business accumulates listings: a map profile, a few directories, an industry association page, an old platform it no longer uses. When those disagree on hours, address, phone number or services, an assistant has to choose, and it may choose wrong. Inconsistency also weakens the link between the listings and you, so the evidence is spread thinner.",
      },
      {
        k: "list",
        ordered: true,
        items: [
          "Write one source-of-truth record: legal and trading name, address, phone, hours, services, website.",
          "Search for your business name on the platforms your buyers use and list every profile you find.",
          "Compare each profile with the record and correct, claim or close the ones that disagree.",
          "Repeat when anything changes, and put the date of the change in the record.",
        ],
      },
      {
        k: "callout",
        tone: "recommendation",
        title: "Echorank recommends",
        t: "Treat your profiles like pages on your own site: owned, dated and reviewed on a schedule. The profile nobody remembers is usually the one feeding the wrong hours into answers.",
      },
      { k: "h2", t: "Never fake, buy or gate reviews" },
      {
        k: "p",
        t: "Fake reviews, paid reviews and review gating, which means asking only happy customers to post publicly, break the rules of the major platforms, and in many places consumer-protection law too. They also defeat the point: evidence that is manufactured is not evidence. Ask every customer the same way, make it easy, and let the mix of reviews reflect reality. Then use what customers tell you to improve, and reply to criticism in public.",
      },
      {
        k: "callout",
        tone: "fact",
        title: "Established",
        t: "Major review platforms prohibit fake, incentivised and selectively solicited reviews, and remove them when found.",
      },
      { k: "h2", t: "Worked example: Northwind Dental" },
      {
        k: "p",
        t: "Northwind's scorecard showed it mentioned but rarely recommended, with a competitor preferred in most answers. Its evidence map tells the story. The map profile has reviews, but the newest is several months old. One directory lists the old Saturday hours. A health directory has the practice under a former name. Nobody has replied to a review in a year.",
      },
      {
        k: "p",
        t: "The plan: a review request card handed to every patient at checkout and a follow-up message the next day, the same for everyone. A weekly half-hour to reply to every new review. The directory hours corrected and the old listing merged into the current one. Two months later the newest review is days old, every profile matches the source-of-truth record, and the team watches the Recommended stage in the scorecard for the effect.",
      },
      {
        k: "callout",
        tone: "unproven",
        title: "Not yet proven",
        t: "No one outside the engines knows how much weight each reputation signal carries in a given answer. Improve the signals because they are honest evidence buyers read too, and measure the effect on your own prompts.",
      },
    ],
    takeaways: [
      "For judgement questions, assistants lean on independent evidence such as reviews and profiles.",
      "Keep one source-of-truth record and make every profile and directory match it.",
      "Grow reviews steadily and honestly; fake, paid or gated reviews are prohibited and self-defeating.",
    ],
    practice: {
      section: "evidence",
      steps: [
        "Write your source-of-truth record: name, address, phone, hours, services and website.",
        "List every profile and directory listing you can find and mark each one matches or differs.",
        "Write down how and when you will ask every customer for a review, and who replies to reviews each week.",
      ],
    },
    quiz: [
      {
        q: "Which is review gating?",
        options: [
          "Asking every customer for a review",
          "Asking only happy customers to post publicly",
          "Replying to negative reviews",
        ],
        correct: 1,
        explain: "Selectively soliciting reviews is gating, and platforms prohibit it.",
      },
      {
        q: "Two directories show different opening hours for you. Why does that matter for AI answers?",
        options: [
          "Assistants may quote the wrong one",
          "It improves your ranking",
          "It has no effect",
        ],
        correct: 0,
        explain: "When sources disagree, an assistant has to choose and may choose wrong.",
      },
      {
        q: "What is the honest way to raise review recency?",
        options: [
          "Ask every customer steadily, at the right moment",
          "Offer discounts for five-star reviews",
          "Post reviews from staff",
        ],
        correct: 0,
        explain: "A steady, universal ask produces recent reviews without breaking platform rules.",
      },
    ],
    tool: {
      kind: "page",
      name: "Echorank Reputation Tools",
      body: "Review monitoring, review request campaigns and help drafting replies, in one place.",
      href: "/reputation-tools",
      cta: "See Reputation Tools",
    },
  },
  {
    slug: "mentions-communities-and-video",
    module: 4,
    title: "Mentions, communities and video",
    summary:
      "Independent coverage, honest comparison pages, helpful community answers and well-structured video all add evidence about you. Earn them; do not seed them.",
    metaDescription:
      "Earn the independent mentions AI answers rely on: editorial coverage, comparison pages, community answers and video with chapters and captions. No seeding.",
    objectives: [
      "Know which kinds of independent mention assistants tend to draw on",
      "Earn coverage and community presence without manufacturing it",
      "Get errors about you corrected on third-party pages",
    ],
    produces: "A list of earned-media targets and corrections to request",
    body: [
      {
        k: "p",
        t: "Assistants look for agreement between independent sources. When editors, comparison writers, community members and video creators describe your brand the same way you do, an assistant has more to go on and more reason to recommend you. You cannot buy that agreement. You earn it by being worth mentioning, making the facts easy to find and correcting errors when you see them.",
      },
      { k: "graphic", id: "earned-rings" },
      { k: "h2", t: "Three rings of evidence" },
      {
        k: "p",
        t: "Think of the evidence about you in three rings. Owned: your site, your profiles, your documentation. Earned: editorial coverage, reviews by independent writers, comparison and “best of” pages, interviews and awards. Community: forums, question-and-answer sites, social discussions and user groups where buyers talk to each other. Lessons 6 to 8 covered the owned ring. This lesson is about the other two.",
      },
      {
        k: "table",
        caption: "Earning mentions, channel by channel",
        head: ["Channel", "What earns a mention", "What to avoid"],
        rows: [
          ["Editorial coverage", "News, data you publish yourself, useful expertise, a clear story", "Paid placements dressed up as editorial"],
          ["Comparison and “best of” pages", "Accurate facts sent to the writer, honest trial access", "Paying for a slot without disclosure"],
          ["Community answers", "Staff answering openly, with their affiliation stated", "Anonymous accounts praising your own product"],
          ["Video", "Clear titles, chapters and captions on genuinely useful videos", "Thin videos made only to be indexed"],
          ["Partners and integrations", "Listings in partner directories and marketplaces", "Link swaps with irrelevant sites"],
        ],
      },
      { k: "h2", t: "Editorial and comparison coverage" },
      {
        k: "p",
        t: "Writers covering your category need accurate, current facts and something worth saying. Give them both: a press page with plain facts, dates and images, and a reason to write, such as original findings from your own data or a genuinely new capability. For comparison pages, contact the author with corrections and trial access rather than complaints, and accept that an honest comparison will sometimes recommend someone else for some buyers.",
      },
      { k: "h2", t: "Communities: earn, do not seed" },
      {
        k: "p",
        t: "Community discussions are read by people and increasingly by assistants. The only durable way to appear in them is to be useful there under your own name. Encourage staff who know the product to answer questions openly, state who they work for and help even when the answer is not your product.",
      },
      {
        k: "callout",
        tone: "recommendation",
        title: "Echorank recommends",
        t: "Never seed communities with posts from anonymous or fake accounts. It breaks community rules, it is often discovered, and the discovery becomes the most quoted thing about you.",
      },
      { k: "h2", t: "Video that machines can read" },
      {
        k: "p",
        t: "A video's pictures and sound are hard for a text-based system to use. Its title, description, chapters and captions are not. Give each video a descriptive title, a summary in the description, chapters with plain labels and accurate captions, and publish a written version of what is said on the page that hosts it. That turns a video into text an assistant can read and quote.",
      },
      {
        k: "callout",
        tone: "fact",
        title: "Established",
        t: "Text attached to a video, such as its title, description, chapters and captions, is readable by crawlers. The spoken content alone is not readable unless it is turned into text.",
      },
      { k: "h2", t: "Partners and integrations" },
      {
        k: "p",
        t: "If your product works with other products, the partner directories and marketplaces that list those integrations are independent pages describing what you do. Keep your listings complete and current, use the same product names as your own site, and ask partners to describe the integration accurately on their side. These pages are easy to overlook and easy to fix.",
      },
      { k: "h2", t: "Correcting third-party errors" },
      {
        k: "p",
        t: "When your scorecard finds an inaccurate answer, look at its sources. Often the error comes from a third-party page: an old review of a product version you replaced, a directory with your former address, a comparison with last year's prices. Contact the publisher with the correct fact, a source for it and a polite request. Keep a log of the requests and their outcomes, and re-check the answer after the page changes.",
      },
      { k: "h2", t: "Worked example: Lumen CRM" },
      {
        k: "p",
        t: "Lumen is missing from most comparison answers, and the sources those answers cite are three “best CRM for small teams” articles that do not include it. The team writes to each author with a short fact sheet and a trial account. One adds Lumen in an update; one replies that the list is closed; one does not reply. Meanwhile two support engineers start answering small-team CRM questions in a public user forum under their own names. The team logs every contact and watches the comparison prompts in the scorecard.",
      },
      {
        k: "callout",
        tone: "unproven",
        title: "Not yet proven",
        t: "Which communities or publications a given engine favours changes over time and is not published. Find out from the sources your own answers cite, not from general lists.",
      },
    ],
    takeaways: [
      "Assistants look for agreement between independent sources; earn it rather than manufacture it.",
      "Video becomes readable evidence through titles, chapters, captions and a written version.",
      "Trace inaccurate answers to their sources and ask the publishers, politely and with evidence, to correct them.",
    ],
    practice: {
      section: "evidence",
      steps: [
        "From your scorecard, list the third-party pages that answers cite for your most important prompts.",
        "Mark each one: includes you correctly, includes you with errors, or leaves you out.",
        "Write the contact and request for each, and one community where your team will answer questions openly.",
      ],
    },
    quiz: [
      {
        q: "What is the honest way to appear in community discussions?",
        options: [
          "Post praise from anonymous accounts",
          "Answer questions openly under your own name and affiliation",
          "Pay members to mention you",
        ],
        correct: 1,
        explain: "Open, useful participation is durable; seeding breaks rules and backfires.",
      },
      {
        q: "Which part of a video can text-based systems read?",
        options: ["Only the thumbnail", "The title, description, chapters and captions", "Nothing at all"],
        correct: 1,
        explain: "Attached text is readable; spoken content needs to be turned into text.",
      },
      {
        q: "An answer repeats an old price from a comparison article. What should you do?",
        options: [
          "Ignore it",
          "Ask the publisher to correct it, with the source of the right price",
          "Change your price to match",
        ],
        correct: 1,
        explain: "Correcting the source is the most direct way to correct the answer.",
      },
    ],
    tool: {
      kind: "page",
      name: "Free AI Visibility Check",
      body: "See what AI engines say about your business today, free, and which kinds of sources their answers lean on.",
      href: "/ai-visibility-check",
      cta: "Run the free check",
    },
  },
];
