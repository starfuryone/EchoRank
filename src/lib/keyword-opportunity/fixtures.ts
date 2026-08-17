// src/lib/keyword-opportunity/fixtures.ts
//
// The AcmeCRM demo: one complete domain analysis, with no provider behind it.
//
// ── NOT ONE SCORE IS WRITTEN DOWN IN THIS FILE ──────────────────────────────
//
// Every number the UI renders — the Opportunity Score, each component, the
// severity, which keywords were AI-tested, each rival's share of the answers —
// is computed here by the SAME functions that will run in production, from the
// raw provider-shaped inputs below. That is the whole point of the file. A
// fixture carrying hand-written scores is a fixture that agrees with the
// product exactly once, on the day it is written, and then quietly stops: the
// demo keeps showing 94 while the scorer has moved to 71, and the first person
// to notice is a customer comparing the two.
//
// So the inputs are hand-written and everything downstream is derived. Change a
// weight in ./score.ts and this demo moves with it, which is the correct and
// slightly uncomfortable behaviour.
//
// ── THE TESTED FIFTEEN ARE CHOSEN, NOT ASSIGNED ─────────────────────────────
//
// Each keyword carries an `answer` describing what an assistant said, but that
// answer is only ATTACHED to keywords that selectAiTestKeywords() actually
// picks. Ten of the twenty-five therefore render the "not AI-tested" state, and
// which ten is a consequence of the scorer rather than a decision taken here.
// Writing the split by hand would have let the fixture show a keyword as tested
// that the real pipeline would never have paid to test.
//
// ── THE COMPETITOR ROLLUP IS THE WATCHER'S, REUSED ──────────────────────────
//
// Rival shares come from ai-monitor/metrics.ts topCompetitors() over answers
// mapped to its ScoredRun shape, with ai-monitor/analysis/competitor-filter.ts
// classifyEntity() deciding what counts as a rival. Nothing is reimplemented:
// that is how "Reddit" and "CRM software" below stay out of the panel while
// HubSpot and Pipedrive stay in, and it is a live check that the Phase 3
// integration points fit.

import {
  classifyEntity,
  sentenceWindow,
} from "@/lib/ai-monitor/analysis/competitor-filter";
import { topCompetitors, type ScoredRun } from "@/lib/ai-monitor/metrics";
import {
  AI_TESTED_KEYWORD_LIMIT,
  scoreOpportunity,
  selectAiTestKeywords,
  type AiEvidence,
  type KeywordIntent,
  type OpportunityInput,
} from "./score";
import { recommendedActions } from "./recommendations";
import type {
  CompetitorVisibility,
  KeywordOpportunityAnalysis,
  KeywordOpportunityPageData,
  OpportunityPromptResult,
  OpportunityRow,
} from "./types";

/** The demo brand. Aliases feed the brand-naming filter in ./prompts.ts. */
export const DEMO_BRAND_NAME = "AcmeCRM";
export const DEMO_DOMAIN = "acmecrm.com";
export const DEMO_ALIASES = ["AcmeCRM", "Acme CRM", "acmecrm.com"] as const;

/** Fixed so the demo never moves under a snapshot test. */
const REQUESTED_AT = "2026-08-17T06:12:00.000Z";
const COMPLETED_AT = "2026-08-17T06:15:41.000Z";

/**
 * What an assistant said when asked one keyword's prompt.
 *
 * `competitors` is the answer's RANKED list, in order. Names that are platforms
 * or category words are left in deliberately — the classifier is what removes
 * them, and a fixture that pre-cleans its own input never exercises it.
 */
interface DemoAnswer {
  brandMentioned: boolean;
  /** 1-based place in the ranked list. Null when named in prose but unranked. */
  brandPosition: number | null;
  snapshot: string;
  competitors: string[];
}

interface DemoKeyword {
  keyword: string;
  monthlyVolume: number;
  cpcUsd: number;
  competition: number;
  trendPercent: number;
  googleRank: number | null;
  intent: KeywordIntent;
  /** The buyer question this keyword becomes. Never names the brand. */
  prompt: string;
  answer: DemoAnswer;
}

/**
 * Twenty-five commercial keywords for a mid-market CRM.
 *
 * Chosen to exercise every branch in ./score.ts rather than to flatter the
 * product: every seoGap band including a null rank and a top-three rank, every
 * intent class including the default, trends past both clamp bounds, and both
 * aiGap paths. tests/keyword-opportunity-score.test.ts asserts that coverage
 * rather than trusting this comment.
 */
const DEMO_KEYWORDS: readonly DemoKeyword[] = [
  {
    keyword: "best CRM for startups",
    monthlyVolume: 8100,
    cpcUsd: 18,
    competition: 0.71,
    trendPercent: 24,
    googleRank: 16,
    intent: "commercial_investigation",
    prompt:
      "we're a 12-person startup and we've outgrown our spreadsheet, what CRM should we be looking at?",
    answer: {
      brandMentioned: false,
      brandPosition: null,
      snapshot:
        "For a team that size, HubSpot's free tier is the usual starting point because it scales without a migration later. Pipedrive is worth a look if your process is genuinely pipeline-shaped, and Close is built for teams doing a lot of outbound calling. All three will handle twelve people comfortably.",
      competitors: ["HubSpot", "Pipedrive", "Close"],
    },
  },
  {
    keyword: "CRM for agencies",
    monthlyVolume: 2400,
    cpcUsd: 31,
    competition: 0.68,
    trendPercent: 8,
    googleRank: 7,
    intent: "commercial_investigation",
    prompt:
      "running a small marketing agency, which CRM handles client retainers and project work properly?",
    answer: {
      brandMentioned: true,
      brandPosition: 4,
      snapshot:
        "HubSpot is the common answer for agencies because the marketing side comes with it. Pipedrive is simpler if you mostly need deal tracking. Close suits agencies that sell by phone. AcmeCRM is a smaller option that handles retainers as recurring deals, which the bigger three do awkwardly.",
      competitors: ["HubSpot", "Pipedrive", "Close"],
    },
  },
  {
    keyword: "affordable CRM software",
    monthlyVolume: 5600,
    cpcUsd: 14,
    competition: 0.62,
    trendPercent: -3,
    googleRank: 34,
    intent: "transactional",
    prompt: "what's a genuinely cheap CRM that isn't useless once you have a few hundred contacts?",
    answer: {
      brandMentioned: false,
      brandPosition: null,
      snapshot:
        "Zoho CRM is the value pick at this end of the market and does not fall apart at a few hundred contacts. HubSpot's free tier is more generous than most paid plans. Pipedrive starts low and stays predictable as you add seats.",
      competitors: ["Zoho CRM", "HubSpot", "Pipedrive"],
    },
  },
  {
    keyword: "CRM with built-in email marketing",
    monthlyVolume: 12100,
    cpcUsd: 42,
    competition: 0.83,
    trendPercent: 68,
    googleRank: null,
    intent: "transactional",
    prompt:
      "I want to stop paying for a separate email tool — which CRM has campaigns built in that are actually usable?",
    answer: {
      brandMentioned: false,
      brandPosition: null,
      snapshot:
        "HubSpot is the obvious one, since marketing and CRM are the same product there. ActiveCampaign comes at it from the email side and has grown a real CRM. Zoho CRM bundles campaigns if you are already in that suite.",
      competitors: ["HubSpot", "ActiveCampaign", "Zoho CRM"],
    },
  },
  {
    keyword: "HubSpot alternatives",
    monthlyVolume: 18100,
    cpcUsd: 27,
    competition: 0.79,
    trendPercent: 41,
    googleRank: null,
    intent: "product_comparison",
    prompt: "we're leaving HubSpot because of the price jump at the next tier, what should we move to?",
    answer: {
      brandMentioned: false,
      brandPosition: null,
      snapshot:
        "Pipedrive is the most common landing spot for teams leaving on price. Zoho CRM is cheaper again if you can live with a busier interface. Close is a smaller, sales-first option. Reddit threads on r/sales are worth reading before you commit.",
      competitors: ["Pipedrive", "Zoho CRM", "Close", "Reddit"],
    },
  },
  {
    keyword: "best CRM software",
    monthlyVolume: 33100,
    cpcUsd: 22,
    competition: 0.88,
    trendPercent: 6,
    googleRank: 62,
    intent: "commercial_investigation",
    prompt: "what's the best CRM software right now, genuinely, not a sponsored list?",
    answer: {
      brandMentioned: false,
      brandPosition: null,
      snapshot:
        "It depends on size. Salesforce still leads at enterprise. HubSpot dominates mid-market. Pipedrive is the small-team favourite. Any list claiming one winner across all three is selling something.",
      competitors: ["Salesforce", "HubSpot", "Pipedrive", "CRM software"],
    },
  },
  {
    keyword: "CRM for small business",
    monthlyVolume: 22200,
    cpcUsd: 19,
    competition: 0.74,
    trendPercent: 12,
    googleRank: 24,
    intent: "commercial_investigation",
    prompt: "six people, no sales ops person, what CRM won't we need a consultant to set up?",
    answer: {
      brandMentioned: true,
      brandPosition: 3,
      snapshot:
        "Pipedrive is the usual recommendation for a team with nobody to run it. HubSpot's free tier works if you can ignore the upsell prompts. AcmeCRM is worth a look — the setup is genuinely a single afternoon.",
      competitors: ["Pipedrive", "HubSpot"],
    },
  },
  {
    keyword: "Salesforce vs HubSpot",
    monthlyVolume: 9900,
    cpcUsd: 16,
    competition: 0.66,
    trendPercent: 3,
    googleRank: null,
    intent: "product_comparison",
    prompt: "is Salesforce actually better than HubSpot or are we just paying for the name?",
    answer: {
      brandMentioned: false,
      brandPosition: null,
      snapshot:
        "Salesforce is more configurable and needs someone to configure it. HubSpot is faster to stand up and gets expensive at the marketing tiers. Under about fifty seats most teams are better served by HubSpot.",
      competitors: ["Salesforce", "HubSpot"],
    },
  },
  {
    keyword: "cheapest CRM for small teams",
    monthlyVolume: 1300,
    cpcUsd: 12,
    competition: 0.55,
    trendPercent: 19,
    googleRank: 41,
    intent: "transactional",
    prompt: "cheapest CRM that four of us can share without hitting a paywall in month two?",
    answer: {
      brandMentioned: false,
      brandPosition: null,
      snapshot:
        "HubSpot's free tier covers four users indefinitely. Zoho CRM's entry plan is a few dollars a seat. Bitrix24 is free for larger teams if you can tolerate the interface.",
      competitors: ["HubSpot", "Zoho CRM", "Bitrix24"],
    },
  },
  {
    keyword: "CRM pricing comparison",
    monthlyVolume: 1900,
    cpcUsd: 11,
    competition: 0.49,
    trendPercent: 15,
    googleRank: 12,
    intent: "product_comparison",
    prompt: "what do the main CRMs actually cost per seat once you include the add-ons?",
    answer: {
      brandMentioned: false,
      brandPosition: null,
      snapshot:
        "Published seat prices are the smaller half. HubSpot's marketing add-ons are where the bill grows; Salesforce charges separately for most of what teams assume is included. Pipedrive is the most predictable of the three.",
      competitors: ["HubSpot", "Salesforce", "Pipedrive"],
    },
  },
  {
    keyword: "how to choose a CRM",
    monthlyVolume: 4400,
    cpcUsd: 9,
    competition: 0.41,
    trendPercent: -8,
    googleRank: 3,
    intent: "solution_seeking",
    prompt: "how do we actually pick a CRM without spending three months on it?",
    answer: {
      brandMentioned: true,
      brandPosition: 2,
      snapshot:
        "Start from the two or three workflows you run every day and trial against those. Pipedrive and AcmeCRM both let you do that on a free trial without a sales call, which shortens this considerably.",
      competitors: ["Pipedrive"],
    },
  },
  {
    keyword: "sales pipeline software",
    monthlyVolume: 6600,
    cpcUsd: 35,
    competition: 0.77,
    trendPercent: 22,
    googleRank: 19,
    intent: "transactional",
    prompt: "we need something to track deals through stages, what do people use for that?",
    answer: {
      brandMentioned: false,
      brandPosition: null,
      snapshot:
        "Pipedrive is built around exactly this and is the default answer. HubSpot's deal board does the same job inside a bigger product. Close is worth considering if calling is part of the stage flow.",
      competitors: ["Pipedrive", "HubSpot", "Close"],
    },
  },
  {
    keyword: "CRM for real estate agents",
    monthlyVolume: 8100,
    cpcUsd: 29,
    competition: 0.81,
    trendPercent: 31,
    googleRank: null,
    intent: "commercial_investigation",
    prompt: "I sell residential property on my own, which CRM is worth it for a solo agent?",
    answer: {
      brandMentioned: false,
      brandPosition: null,
      snapshot:
        "Follow Up Boss is the specialist choice and most solo agents end up there. LionDesk is cheaper and covers the basics. HubSpot works if you would rather use a general CRM you can take to another industry later.",
      competitors: ["Follow Up Boss", "LionDesk", "HubSpot"],
    },
  },
  {
    keyword: "what is a CRM",
    monthlyVolume: 49500,
    cpcUsd: 3,
    competition: 0.18,
    trendPercent: -12,
    googleRank: 2,
    intent: "informational",
    prompt: "what does a CRM actually do that a shared spreadsheet doesn't?",
    answer: {
      brandMentioned: true,
      brandPosition: 1,
      snapshot:
        "A CRM keeps every interaction with a contact in one timeline and makes that history queryable, which a spreadsheet cannot do once more than one person edits it. AcmeCRM, HubSpot and Pipedrive are all built on that idea.",
      competitors: ["HubSpot", "Pipedrive"],
    },
  },
  {
    keyword: "CRM integration with Slack",
    monthlyVolume: 880,
    cpcUsd: 21,
    competition: 0.58,
    trendPercent: 54,
    googleRank: null,
    intent: "solution_seeking",
    prompt: "our team lives in Slack — which CRM pushes deal updates into a channel properly?",
    answer: {
      brandMentioned: false,
      brandPosition: null,
      snapshot:
        "HubSpot's Slack app is the most complete and posts stage changes into a channel out of the box. Pipedrive covers the basics. Salesforce needs configuration but can do the most once configured.",
      competitors: ["HubSpot", "Pipedrive", "Salesforce"],
    },
  },
  {
    keyword: "buy CRM software online",
    monthlyVolume: 590,
    cpcUsd: 38,
    competition: 0.86,
    trendPercent: 2,
    googleRank: 88,
    intent: "transactional",
    prompt: "can I just sign up and pay for a CRM today without booking a demo call?",
    answer: {
      brandMentioned: false,
      brandPosition: null,
      snapshot:
        "Pipedrive, HubSpot and Zoho CRM all sell self-serve with a card and no call. Salesforce will route you to sales above the smallest plan.",
      competitors: ["Pipedrive", "HubSpot", "Zoho CRM"],
    },
  },
  {
    keyword: "Pipedrive vs Close",
    monthlyVolume: 2900,
    cpcUsd: 17,
    competition: 0.63,
    trendPercent: 9,
    googleRank: null,
    intent: "product_comparison",
    prompt: "Pipedrive or Close for a team that does a lot of outbound calling?",
    answer: {
      brandMentioned: false,
      brandPosition: null,
      snapshot:
        "Close, comfortably, if calling is the main motion — the dialer is native rather than bolted on. Pipedrive wins on everything around the pipeline itself and is easier to hand to a non-sales colleague.",
      competitors: ["Close", "Pipedrive"],
    },
  },
  {
    keyword: "CRM migration checklist",
    monthlyVolume: 1600,
    cpcUsd: 7,
    competition: 0.34,
    trendPercent: -21,
    googleRank: 5,
    intent: "solution_seeking",
    prompt: "what do we need to sort out before moving our contacts to a new CRM?",
    answer: {
      brandMentioned: false,
      brandPosition: null,
      snapshot:
        "Export and dedupe before you import, decide what happens to closed deals, and keep the old system readable for a quarter. Most vendors including HubSpot publish a migration guide worth reading first.",
      competitors: ["HubSpot"],
    },
  },
  {
    keyword: "free CRM trial",
    monthlyVolume: 4800,
    cpcUsd: 26,
    competition: 0.72,
    trendPercent: 11,
    googleRank: 28,
    intent: "transactional",
    prompt: "which CRMs let you trial the paid features without handing over a card?",
    // MENTIONED BUT NEVER RANKED, and the only keyword here that is. The brand
    // appears in the last sentence as an aside rather than as one of the
    // options, so visibilityFor() scores it 0 and the aiGap stays at 100 — but
    // severityFor() still refuses HIGH, because the answer did name it. This is
    // the branch that would otherwise go unexercised.
    answer: {
      brandMentioned: true,
      brandPosition: null,
      snapshot:
        "Pipedrive and Zoho CRM both trial the paid tiers without a card. HubSpot's free tier is permanent rather than a trial, which is a different and often better deal. Smaller vendors such as AcmeCRM vary, so check before you sign up.",
      competitors: ["Pipedrive", "Zoho CRM", "HubSpot"],
    },
  },
  {
    keyword: "enterprise CRM platform",
    monthlyVolume: 3300,
    cpcUsd: 47,
    competition: 0.91,
    trendPercent: 4,
    googleRank: 55,
    intent: "commercial_investigation",
    prompt:
      "we're 400 people with a compliance team, what CRM survives that kind of procurement?",
    answer: {
      brandMentioned: false,
      brandPosition: null,
      snapshot:
        "Salesforce and Microsoft Dynamics are the two that clear enterprise procurement without argument. HubSpot's enterprise tier is credible now but still gets questions about data residency.",
      competitors: ["Salesforce", "Microsoft Dynamics", "HubSpot"],
    },
  },
  {
    keyword: "CRM software reviews",
    monthlyVolume: 5400,
    cpcUsd: 13,
    competition: 0.59,
    trendPercent: -6,
    googleRank: 21,
    intent: "product_comparison",
    prompt: "where can I read honest reviews of CRMs that aren't affiliate roundups?",
    answer: {
      brandMentioned: false,
      brandPosition: null,
      snapshot:
        "G2 and Capterra carry volume but skew positive. Reddit threads in r/sales are blunter. For HubSpot and Pipedrive specifically there is enough written that patterns are visible across sources.",
      competitors: ["G2", "Capterra", "Reddit", "HubSpot", "Pipedrive"],
    },
  },
  {
    keyword: "why is my CRM so slow",
    monthlyVolume: 320,
    cpcUsd: 4,
    competition: 0.12,
    trendPercent: -64,
    googleRank: 9,
    intent: "solution_seeking",
    prompt: "our CRM takes ten seconds to load a contact record, what causes that?",
    answer: {
      brandMentioned: false,
      brandPosition: null,
      snapshot:
        "Usually custom fields and workflow rules accumulating over years rather than the vendor. Audit what fires on record load before you migrate anywhere.",
      competitors: [],
    },
  },
  {
    keyword: "CRM automation ideas",
    monthlyVolume: 2100,
    cpcUsd: 6,
    competition: 0.28,
    trendPercent: 148,
    googleRank: null,
    intent: "informational",
    prompt: "what are people automating in their CRM that actually saves time?",
    answer: {
      brandMentioned: false,
      brandPosition: null,
      snapshot:
        "Lead routing, stage-change notifications and follow-up reminders are the three that pay for themselves. HubSpot and Pipedrive both ship templates for all three.",
      competitors: ["HubSpot", "Pipedrive"],
    },
  },
  {
    keyword: "CRM for nonprofits",
    monthlyVolume: 1900,
    cpcUsd: 15,
    competition: 0.47,
    trendPercent: 17,
    googleRank: 47,
    intent: "commercial_investigation",
    prompt: "small charity, we track donors not deals — is a normal CRM the wrong tool?",
    answer: {
      brandMentioned: false,
      brandPosition: null,
      snapshot:
        "Salesforce's nonprofit programme gives ten free seats and is hard to beat on price. Bloomerang is purpose-built for donor management. A general CRM works but you will rebuild fundraising reporting yourself.",
      competitors: ["Salesforce", "Bloomerang"],
    },
  },
  {
    keyword: "customer relationship management definition",
    monthlyVolume: 27100,
    cpcUsd: 2,
    competition: 0.09,
    trendPercent: -18,
    googleRank: 1,
    intent: "informational",
    prompt: "what does customer relationship management mean as a term?",
    answer: {
      brandMentioned: true,
      brandPosition: null,
      snapshot:
        "It describes the practice of managing every interaction with customers across their lifecycle, and by extension the software that does it. Vendors such as Salesforce and AcmeCRM use the term for their products.",
      competitors: ["Salesforce"],
    },
  },
];

/** The provider-shaped inputs, before anything has been asked of an AI. */
const BASE_INPUTS: OpportunityInput[] = DEMO_KEYWORDS.map((entry) => ({
  keyword: entry.keyword,
  monthlyVolume: entry.monthlyVolume,
  cpcUsd: entry.cpcUsd,
  competition: entry.competition,
  trendPercent: entry.trendPercent,
  googleRank: entry.googleRank,
  intent: entry.intent,
  ai: null,
}));

/**
 * Visibility for a brand the answer named.
 *
 * 100/position, the shape ai-monitor/metrics.ts positionComponent() uses, and
 * ZERO for a brand named in prose but never ranked — being mentioned in passing
 * and being recommended are different outcomes, and only the second earns
 * points. Null is reserved for "we did not ask", which cannot occur here
 * because this function only runs on answers we bought.
 */
function visibilityFor(answer: DemoAnswer): number | null {
  if (!answer.brandMentioned) return null;
  if (answer.brandPosition === null) return 0;
  return 100 / answer.brandPosition;
}

function evidenceFor(answer: DemoAnswer): AiEvidence {
  return {
    mentioned: answer.brandMentioned,
    visibilityScore: visibilityFor(answer),
    mentionRate: answer.brandMentioned ? 1 : 0,
    averagePosition: answer.brandPosition,
  };
}

/** The fifteen the scorer says are worth an AI call. */
const TESTED = new Set(
  selectAiTestKeywords(BASE_INPUTS, AI_TESTED_KEYWORD_LIMIT).map((input) => input.keyword),
);

const BY_KEYWORD = new Map(DEMO_KEYWORDS.map((entry) => [entry.keyword, entry]));

/** Stable ids, so a re-render does not reshuffle React keys. */
function rowId(keyword: string): string {
  return `demo-${keyword.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
}

function resultFor(entry: DemoKeyword): OpportunityPromptResult {
  return {
    provider: "CLAUDE",
    model: "claude-haiku-4-5",
    brandMentioned: entry.answer.brandMentioned,
    brandPosition: entry.answer.brandPosition,
    answerSnapshot: entry.answer.snapshot,
    competitors: entry.answer.competitors.map((name, index) => ({
      name,
      position: index + 1,
    })),
    checkedAt: COMPLETED_AT,
  };
}

/** Every keyword, scored, with AI evidence attached only where it was bought. */
const ROWS: OpportunityRow[] = DEMO_KEYWORDS.map((entry) => {
  const tested = TESTED.has(entry.keyword);
  const ai = tested ? evidenceFor(entry.answer) : null;
  const scored = scoreOpportunity({
    keyword: entry.keyword,
    monthlyVolume: entry.monthlyVolume,
    cpcUsd: entry.cpcUsd,
    competition: entry.competition,
    trendPercent: entry.trendPercent,
    googleRank: entry.googleRank,
    intent: entry.intent,
    ai,
  });

  const result = tested ? resultFor(entry) : null;

  return {
    ...scored,
    id: rowId(entry.keyword),
    prompt: tested ? { text: entry.prompt, intent: entry.intent } : null,
    result,
    actions: recommendedActions({
      googleRank: entry.googleRank,
      intent: entry.intent,
      aiTested: tested,
      aiMentioned: ai === null ? null : ai.mentioned,
      rivalsInAnswer: result?.competitors.length ?? 0,
    }),
  };
}).sort((a, b) => b.opportunityScore - a.opportunityScore || a.keyword.localeCompare(b.keyword));

/**
 * Rival share across the tested answers, via the Watcher's own rollup.
 *
 * Each tested keyword becomes one ScoredRun and topCompetitors() does the rest,
 * including dropping everything classifyEntity() does not call a RIVAL — which
 * is what keeps Reddit, G2 and the bare phrase "CRM software" out of a panel
 * headed "who is being recommended instead of you".
 */
function competitorVisibility(): CompetitorVisibility[] {
  const answered = ROWS.filter((row) => row.result !== null);

  // `rankedInPrompts` is a signal ABOUT THE WHOLE ANALYSIS, not about one
  // answer: an entity that half the answers rank is behaving like a rival, and
  // one that appears once is likely to be a passing reference. Counting it
  // needs every answer in hand, so it is a pass of its own — handing the
  // classifier a hardcoded 1 would put every real competitor below
  // RIVAL_THRESHOLD and empty the panel.
  const appearances = new Map<string, number>();
  for (const row of answered) {
    for (const competitor of row.result?.competitors ?? []) {
      const key = competitor.name.trim().toLowerCase();
      appearances.set(key, (appearances.get(key) ?? 0) + 1);
    }
  }

  const runs: ScoredRun[] = answered.map((row) => {
    const result = row.result as OpportunityPromptResult;
    return {
      engine: "CLAUDE",
      promptId: row.id,
      brandMentioned: result.brandMentioned,
      mentionCount: result.brandMentioned ? 1 : 0,
      brandPosition: result.brandPosition,
      sentiment: result.brandMentioned ? "NEUTRAL" : "NOT_MENTIONED",
      citations: [],
      competitors: result.competitors.map((competitor) => ({
        name: competitor.name,
        position: competitor.position,
        classification: classifyEntity(competitor.name, {
          position: competitor.position,
          context: sentenceWindow(result.answerSnapshot, competitor.name),
          brandName: DEMO_BRAND_NAME,
          categoryVocabulary: ["CRM", "CRM software", "sales software"],
          rankedInPrompts: appearances.get(competitor.name.trim().toLowerCase()) ?? 1,
        }).classification,
      })),
    };
  });

  return topCompetitors(runs).map((competitor) => ({
    name: competitor.name,
    sharePercent: Math.round(competitor.frequency * 100),
    averagePosition: competitor.averagePosition,
  }));
}

const COMPETITORS = competitorVisibility();

/** The completed AcmeCRM analysis. */
export const DEMO_ANALYSIS: KeywordOpportunityAnalysis = {
  id: "demo-analysis-acmecrm",
  domain: DEMO_DOMAIN,
  brandName: DEMO_BRAND_NAME,
  status: "COMPLETED",
  currentStep: null,
  scoreVersion: ROWS[0]?.scoreVersion ?? 1,
  requestedAt: REQUESTED_AT,
  completedAt: COMPLETED_AT,
  fromCache: false,
  keywordCount: ROWS.length,
  aiTestedCount: ROWS.filter((row) => row.aiTested).length,
  discoveredCount: ROWS.length,
  brandedCount: 0,
  emptyReason: null,
  // Fifteen Haiku answers plus their extraction passes, at the rates in
  // ai-monitor/pricing.ts. Well inside the $2 STARTER ceiling in plan-config.
  costUsd: 0.1372,
  rows: ROWS,
  competitors: COMPETITORS,
  error: null,
};

/**
 * The demo entitlement: "3 of 5 domain analyses left this month".
 *
 * A STARTER tenant two analyses into the month, with no credits and no cache
 * hit — the state the CTA copy is written against.
 */
export const DEMO_PAGE_DATA: KeywordOpportunityPageData = {
  brandProfileId: "demo-brand-acmecrm",
  brandName: DEMO_BRAND_NAME,
  domain: DEMO_DOMAIN,
  entitlement: {
    allowanceTotal: 5,
    allowanceUsed: 2,
    allowanceRemaining: 3,
    credits: 0,
    cacheHit: false,
  },
  analysis: DEMO_ANALYSIS,
};

/**
 * The states the page can be in, as a demo can reach them.
 *
 * A QUERY PARAMETER RATHER THAN A CONTROL IN THE UI. Every one of these is a
 * real state the Phase 3 worker will produce — QUEUED and RUNNING come off the
 * status column, `denied` off the entitlement check, `error` off a failed run —
 * so the client component branches on exactly the data it will branch on later
 * and gains nothing to delete. What it must not gain is a state switcher on the
 * page, which would be demo scaffolding shipped to customers.
 */
export const DEMO_STATES = [
  "results",
  "cached",
  "queued",
  "running",
  "empty",
  "branded_empty",
  "error",
  "denied",
] as const;

export type DemoState = (typeof DEMO_STATES)[number];

export function isDemoState(value: string | undefined): value is DemoState {
  return value !== undefined && (DEMO_STATES as readonly string[]).includes(value);
}

/** Page data for one demo state. Unknown input falls back to the results view. */
export function demoPageData(state: DemoState = "results"): KeywordOpportunityPageData {
  const { entitlement } = DEMO_PAGE_DATA;

  switch (state) {
    case "empty":
      return { ...DEMO_PAGE_DATA, analysis: null };

    case "queued":
      return {
        ...DEMO_PAGE_DATA,
        analysis: {
          ...DEMO_ANALYSIS,
          status: "QUEUED",
          currentStep: null,
          completedAt: null,
          rows: [],
          competitors: [],
          aiTestedCount: 0,
          keywordCount: 0,
          costUsd: 0,
        },
      };

    case "running":
      return {
        ...DEMO_PAGE_DATA,
        analysis: {
          ...DEMO_ANALYSIS,
          status: "RUNNING",
          currentStep: "rankings",
          completedAt: null,
          rows: [],
          competitors: [],
          aiTestedCount: 0,
          keywordCount: 0,
          costUsd: 0,
        },
      };

    case "branded_empty":
      // COMPLETED with nothing in it. The ordinary outcome for a young domain
      // whose keyword profile is entirely its own brand name — a result, not a
      // failure, and the state that used to render as a blank page.
      return {
        ...DEMO_PAGE_DATA,
        analysis: {
          ...DEMO_ANALYSIS,
          status: "COMPLETED",
          rows: [],
          competitors: [],
          keywordCount: 0,
          aiTestedCount: 0,
          discoveredCount: 214,
          brandedCount: 214,
          emptyReason: "no_unbranded_keywords",
          error: null,
        },
      };

    case "error":
      return {
        ...DEMO_PAGE_DATA,
        analysis: {
          ...DEMO_ANALYSIS,
          status: "FAILED",
          currentStep: null,
          completedAt: null,
          rows: [],
          competitors: [],
          aiTestedCount: 0,
          keywordCount: 0,
          costUsd: 0,
          error: "keyword discovery did not return a usable result",
        },
      };

    case "denied":
      // Allowance spent and no credits. The analysis on screen is the last
      // completed one — a tenant at their ceiling keeps their results, they
      // simply cannot start another.
      return {
        ...DEMO_PAGE_DATA,
        entitlement: { ...entitlement, allowanceUsed: 5, allowanceRemaining: 0, credits: 0 },
      };

    case "cached":
      return {
        ...DEMO_PAGE_DATA,
        entitlement: { ...entitlement, cacheHit: true },
        analysis: { ...DEMO_ANALYSIS, fromCache: true },
      };

    case "results":
    default:
      return DEMO_PAGE_DATA;
  }
}

/** The tested/untested split, for the tests and for the methodology note. */
export const DEMO_TESTED_KEYWORDS: readonly string[] = [...TESTED].sort();

/** Exposed so a test can assert the fixture exercises what it claims to. */
export const DEMO_KEYWORD_INPUTS: readonly OpportunityInput[] = BASE_INPUTS;

/** Lookup used by the demo's empty/error states, which reuse one row. */
export function demoRow(keyword: string): OpportunityRow | undefined {
  return ROWS.find((row) => row.keyword === keyword);
}

/** The raw demo entry behind a row, for tests that need the unattached answer. */
export function demoKeyword(keyword: string): DemoKeyword | undefined {
  return BY_KEYWORD.get(keyword);
}
