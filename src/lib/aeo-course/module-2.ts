// Module 2 — Measure where you stand. Original Echorank course copy.

import type { AeoLesson } from "./types";

export const MODULE_2: AeoLesson[] = [
  {
    slug: "build-your-prompt-panel",
    module: 2,
    title: "Build your prompt panel",
    summary:
      "A prompt panel is a fixed set of real buyer questions you ask the same way, on the same engines, on a schedule. It is the measuring stick for everything else in this course.",
    metaDescription:
      "Build an AEO prompt panel: choose 20 to 30 buyer questions by decision stage, mix unbranded, branded, comparison and fact-check prompts, and keep wording stable.",
    objectives: [
      "Choose 20 to 30 prompts from real buyer decisions rather than keywords",
      "Balance unbranded, branded, comparison and fact-check prompts",
      "Log every run so results can be compared over time",
    ],
    produces: "Your first prompt panel, with a type and stage for every prompt",
    body: [
      {
        k: "p",
        t: "A prompt panel is the fixed list of questions you put to answer engines on a schedule, worded the same way every time. Start with 20 to 30 prompts chosen from the decisions your buyers actually make, label each one by type and journey stage, and log the platform, locale and date of every run. Without a stable panel, you cannot tell whether a change in answers came from your work or from chance.",
      },
      { k: "h2", t: "Start from decisions, not keywords" },
      {
        k: "p",
        t: "Keyword lists describe what people type into a search box. Prompts describe what people ask an assistant, which is longer, more specific and full of context: who they are, what they need, what they have already tried. Begin with the decisions a buyer makes on the way to choosing you. Which problem do they have? Which kinds of solution do they consider? What do they compare? What do they need to verify before they commit?",
      },
      {
        k: "p",
        t: "Sales calls, support tickets, reviews and your own site search are the best raw material. Write prompts in the buyer's words, with a realistic constraint or two, and avoid stuffing them with your product terms.",
      },
      { k: "h2", t: "Four kinds of prompt, measured separately" },
      {
        k: "table",
        caption: "Prompt types and what each one measures",
        head: ["Prompt type", "Example", "What it measures"],
        rows: [
          ["Unbranded", "Which family dentists near Riverside see children in the evening?", "Whether you are named at all when nobody mentions you"],
          ["Comparison", "Lumen CRM or a bigger suite for a five-person sales team?", "How you are framed against named alternatives"],
          ["Branded", "Does Lumen CRM track replies to sales emails?", "Whether specific facts about you are complete and correct"],
          ["Fact-check", "What are Northwind Dental's opening hours on weekdays?", "Whether a precise, checkable claim matches your own records"],
        ],
      },
      {
        k: "p",
        t: "Mixing these types into one number makes visibility look better than it is: branded prompts mention you by definition. Keep unbranded prompts as the core of the panel, because they show whether assistants reach for you without being told your name.",
      },
      { k: "graphic", id: "prompt-panel" },
      { k: "h2", t: "Keep the wording stable" },
      {
        k: "p",
        t: "Once a prompt is in the panel, do not edit it. Small wording changes can change the answer, and an edited prompt breaks the history you are trying to build. When you want to test a variation, add it as a new, named prompt and keep the original running beside it.",
      },
      {
        k: "callout",
        tone: "recommendation",
        title: "Echorank recommends",
        t: "Give every prompt an id, a type and a journey stage, and freeze its wording. Retire a prompt only when the decision behind it no longer matters to your business, and note the date you retired it.",
      },
      { k: "h2", t: "Log every run" },
      {
        k: "p",
        t: "For each answer, record the engine, the locale and language, the date, whether you were logged in, and the full text of the answer with any sources it showed. That sounds like a lot; it is what turns a pile of screenshots into evidence. Answers vary between runs, so repeat each prompt more than once per cycle and look at how often an outcome occurs rather than at any single answer.",
      },
      {
        k: "callout",
        tone: "fact",
        title: "Established",
        t: "Location, language and account settings can change an answer. Two people asking the same question on the same day may see different brands.",
      },
      { k: "h2", t: "Worked example: Lumen CRM" },
      {
        k: "p",
        t: "Lumen CRM's team pulls twenty recent sales-call notes and highlights the questions prospects asked before booking a demo. They group them into four stages: noticing the problem (“why do deals stall after the first call?”), exploring solutions (“what kind of CRM suits a five-person team?”), comparing (“Lumen or a bigger suite?”) and verifying (“does Lumen integrate with our email?”).",
      },
      {
        k: "p",
        t: "They end up with twenty-four prompts: fourteen unbranded, four comparison, three branded and three fact-check. Each gets an id such as SOL-03, a stage and a type. They run the panel on two engines, twice each, and log the results in a shared sheet. The first run is their baseline; nothing is changed on the site until it is recorded.",
      },
      {
        k: "callout",
        tone: "recommendation",
        title: "Need a starting point?",
        t: "Echorank's industry prompt setup guides offer ten example libraries, one per industry, with tags and a measurement scorecard. Use them for inspiration, then rewrite every prompt in your buyers' own words.",
        link: { href: "/prompt-guides", label: "Browse the prompt setup guides" },
      },
      { k: "h2", t: "How big should the panel be?" },
      {
        k: "p",
        t: "Big enough to cover your important decisions, small enough that someone reads every answer. Twenty to thirty prompts is a practical start for one product or location. Add prompts when you launch something new or enter a new market, not because a larger number looks more thorough. A panel nobody reads is worse than a short one somebody acts on.",
      },
      {
        k: "callout",
        tone: "unproven",
        title: "Not yet proven",
        t: "There is no agreed number of runs that makes an AEO measurement reliable. Decide on a repeat count that fits your budget, keep it constant and judge trends across several cycles.",
      },
    ],
    takeaways: [
      "Build the panel from buyer decisions and real questions, not keyword lists.",
      "Measure unbranded, comparison, branded and fact-check prompts separately.",
      "Freeze wording, log engine, locale and date, and repeat runs to see trends rather than single answers.",
    ],
    practice: {
      section: "baseline",
      steps: [
        "List the four journey stages for your buyers and write at least five prompts per stage in their words.",
        "Label each prompt unbranded, comparison, branded or fact-check, and keep unbranded prompts the largest group.",
        "Give every prompt an id and copy the panel into your worksheet. Run it once on your chosen engines and save the answers as your baseline.",
      ],
    },
    quiz: [
      {
        q: "Why should unbranded prompts be the core of the panel?",
        options: [
          "They are shorter",
          "They show whether assistants name you without being told your name",
          "Assistants answer them faster",
        ],
        correct: 1,
        explain: "Branded prompts mention you by definition; unbranded ones test real discovery.",
      },
      {
        q: "You want to try a new wording of a panel prompt. What should you do?",
        options: [
          "Edit the existing prompt",
          "Add the new wording as a separate, named prompt",
          "Delete the old prompt",
        ],
        correct: 1,
        explain: "Editing breaks the history; a separate prompt lets you compare both.",
      },
      {
        q: "Which detail does NOT need to be logged with each answer?",
        options: ["The engine and locale", "The date of the run", "The colour of your logo"],
        correct: 2,
        explain: "Engine, locale and date explain variation; the rest is noise.",
      },
    ],
    tool: {
      kind: "seo",
      tool: "custom_prompts",
      name: "Custom Prompts",
      body: "Echorank's Custom Prompts tool lets you create and monitor the AI prompts that matter to your brand, so the panel you design here has a home.",
      href: "/technical-geo",
      cta: "See how it works",
    },
  },
  {
    slug: "the-mrca-scorecard",
    module: 2,
    title: "The MRCA scorecard",
    summary:
      "Score every answer in four stages: Mentioned, Recommended, Cited, Accurate. The stage where a brand drops out tells you which fix to make.",
    metaDescription:
      "Score AI answers with Echorank's MRCA model: Mentioned, Recommended, Cited, Accurate. Track competitors and share of answers, and match each failure to a fix.",
    objectives: [
      "Score any AI answer on the four MRCA stages",
      "Track competitor presence and share of answers alongside your own score",
      "Match each failed stage to the kind of fix that addresses it",
    ],
    produces: "A scored baseline for your prompt panel",
    body: [
      {
        k: "p",
        t: "Score every answer in four stages, in order: was your brand Mentioned, was it Recommended for the need, was one of your own pages Cited, and was what the answer said about you Accurate? This is Echorank's MRCA scorecard. It replaces a single visibility number with four answers, and the stage where you drop out points to the fix.",
      },
      { k: "graphic", id: "mrca-funnel" },
      { k: "h2", t: "The four stages" },
      {
        k: "table",
        caption: "The MRCA scorecard",
        head: ["Stage", "Definition", "Counts when", "Does not count when", "Typical fix"],
        rows: [
          ["Mentioned", "Your brand is named in the answer", "Your name appears anywhere in the reply", "Only a competitor list you link to mentions you", "Clear entity information; presence on sources assistants read"],
          ["Recommended", "You are suggested for the need asked about", "The answer advises choosing or considering you", "You appear only in passing or as a counter-example", "Specific pages for each use case; independent evidence such as reviews"],
          ["Cited", "A page you own is shown as a source", "Your domain is linked or named as a source", "Only third-party pages about you are cited", "Crawlable, answer-first pages that win a sub-question"],
          ["Accurate", "What is said about you is true and current", "Every claim matches your own dated records", "Prices, hours, features or names are wrong or stale", "Correct the source the answer relied on; keep facts in text, dated"],
        ],
      },
      {
        k: "p",
        t: "Score stages in order, but record each one independently. An answer can cite your page while recommending someone else, or recommend you while getting your prices wrong. Those combinations are the most useful findings in the whole exercise.",
      },
      { k: "h2", t: "Competitor presence and share of answers" },
      {
        k: "p",
        t: "Your score means little on its own. For every answer, also record which other brands were mentioned and recommended. Over a cycle, share of answers is the number of answers that recommend you divided by the number of answers that recommend anyone. It shows whether you are gaining ground against named alternatives, which your own score alone cannot.",
      },
      {
        k: "callout",
        tone: "recommendation",
        title: "Echorank recommends",
        t: "Keep a fixed list of the competitors you track and add newcomers only when they appear repeatedly. Report share of answers per engine and per prompt type, never blended across everything.",
      },
      { k: "h2", t: "Scoring rules that keep the numbers honest" },
      {
        k: "list",
        items: [
          "Score branded prompts separately: they mention you by definition and would inflate the Mentioned stage.",
          "A mention inside a list of ten is still a mention; a recommendation needs the answer to steer toward you.",
          "Cited means your own domain. Reviews, directories and press about you count as evidence, not citations of you.",
          "Accuracy needs a source of truth: compare every claim with a dated internal record, and mark uncertain claims as unverified rather than guessing.",
        ],
      },
      {
        k: "callout",
        tone: "fact",
        title: "Established",
        t: "An answer that names you can still be wrong about you. Accuracy is a separate stage because a confident, incorrect description can do more harm than no mention.",
      },
      { k: "h2", t: "Worked example: Northwind Dental" },
      {
        k: "p",
        t: "Northwind runs its panel twice on two engines. For “Which dentists near Riverside see children in the evening?” the scores look like this. Mentioned: yes in most runs. Recommended: rarely; a competitor with many recent reviews is usually suggested first. Cited: never; the answers cite a directory and the competitor's site. Accurate: no; the hours quoted are last year's.",
      },
      {
        k: "p",
        t: "The scorecard turns that into three separate jobs. Accuracy comes first, because wrong hours send patients to a closed door: update the directory listing and put the hours in text on the site. Citation comes next: publish a page about children's appointments that answers the question in its first paragraph. Recommendation is the slow one, and lessons 9 and 10 cover the evidence that moves it.",
      },
      { k: "h2", t: "A simple scoring sheet" },
      {
        k: "p",
        t: "One row per answer is enough: prompt id, engine, locale, date, run number, then a yes or no for each MRCA stage, the competitors mentioned, the competitors recommended, the sources shown and a note on anything inaccurate. Keep the full answer text in a linked column. A plain shared sheet works; what matters is that every answer is scored the same way by the same rules.",
      },
      { k: "h2", t: "Reading a scorecard over time" },
      {
        k: "p",
        t: "One cycle gives you a baseline, not a verdict. After each cycle, compare stage by stage and engine by engine. Look for answers that moved from one stage to the next, and tie each movement to the change you made. When nothing moves after several cycles, revisit the diagnosis rather than doing more of the same.",
      },
      {
        k: "callout",
        tone: "unproven",
        title: "Not yet proven",
        t: "Nobody has shown a reliable way to predict which stage will move first after a given change. Treat each fix as an experiment and let your own scorecard tell you what worked.",
      },
    ],
    takeaways: [
      "MRCA scores four separate outcomes: Mentioned, Recommended, Cited, Accurate.",
      "Track competitors and share of answers, per engine and per prompt type.",
      "The stage where you drop out tells you which fix to make; accuracy problems come first.",
    ],
    practice: {
      section: "baseline",
      steps: [
        "Score every baseline answer from lesson 4 on the four MRCA stages, plus the competitors mentioned and recommended.",
        "Count, per engine, how many unbranded answers reached each stage.",
        "Write in your worksheet the stage where you drop out most often, and the first fix you will try.",
      ],
    },
    quiz: [
      {
        q: "An answer links a review site that praises you, but none of your own pages. Which stage is not met?",
        options: ["Mentioned", "Cited", "Recommended"],
        correct: 1,
        explain: "Cited means one of your own pages is shown as a source.",
      },
      {
        q: "How is share of answers calculated?",
        options: [
          "Answers that recommend you divided by answers that recommend anyone",
          "Your mentions divided by your page count",
          "Clicks from AI divided by all clicks",
        ],
        correct: 0,
        explain: "It compares your recommendations with all recommendations in the same set of answers.",
      },
      {
        q: "Which failure should usually be fixed first?",
        options: ["Not being recommended", "Inaccurate facts about you", "Not being cited"],
        correct: 1,
        explain: "Wrong facts actively mislead buyers, so they come before growth work.",
      },
    ],
    tool: {
      kind: "seo",
      tool: "brand_radar",
      name: "Brand Radar",
      body: "Echorank's Brand Radar tracks your brand's visibility, mentions and presence across search and AI platforms, the raw material for your scorecard.",
      href: "/technical-geo",
      cta: "See how it works",
    },
  },
];
