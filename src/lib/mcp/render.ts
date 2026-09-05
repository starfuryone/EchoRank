// src/lib/mcp/render.ts
//
// The TEXT half of every MCP tool result.
//
// One renderer per tool, each a pure function of an already-validated payload.
// Pure is the point: the handler validates against the output schema and only
// then renders, so these run over proven shapes and can be snapshot-tested
// with a literal — no DB, no HTTP, no mocks.
//
// WHAT THE TEXT IS FOR. Clients that read `structuredContent` get the data
// either way. This block exists for the ones that do not, and for the human
// reading a transcript. So it renders ROWS, not a summary of rows — see
// ./table.ts for why — and it leads with the facts an agent needs to decide
// what to do next: whether anything was found, how old it is, and what it cost.
//
// NOTHING HERE IS LOCALIZED, and that is deliberate. This is a protocol
// surface consumed by developer tooling, in the same register as the tool
// descriptions and the JSON keys beside it. The dashboard's three catalogs
// cover what a customer reads in the product; an agent reading a pipe-delimited
// table is not that surface.

import {
  formatMcpCell,
  formatMcpFacts,
  formatMcpSection,
  formatMcpTable,
  truncatedCell,
  type McpTableColumn,
} from "./table";
import type {
  BacklinksOverviewPayload,
  CrawlSummaryPayload,
  DomainOverviewPayload,
  GetSerpCheckPayload,
  GscQueriesPayload,
  AiCitationsPayload,
  KeywordOpportunitiesPayload,
  ResearchLogPayload,
  RankKeywordMutationPayload,
  RankTrackerPayload,
  StartSerpCheckPayload,
  WhoamiPayload,
} from "./output-schemas";

/** "unlimited" is a real allowance value and must not print as "—". */
function allowance(value: number | null): string {
  return value === null ? "unlimited" : String(value);
}

function usd(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** Rows a table is capped at in TEXT. structuredContent always carries them all. */
const TEXT_ROW_CAP = 50;

function capped<T>(rows: readonly T[]): { rows: readonly T[]; omitted: number } {
  if (rows.length <= TEXT_ROW_CAP) return { rows, omitted: 0 };
  return { rows: rows.slice(0, TEXT_ROW_CAP), omitted: rows.length - TEXT_ROW_CAP };
}

function withOmitted(text: string, omitted: number): string {
  return omitted === 0
    ? text
    : `${text}\n… ${omitted} more row${omitted === 1 ? "" : "s"} in structuredContent.`;
}

// ─── whoami ──────────────────────────────────────────────────────────────────

export function renderWhoami(data: WhoamiPayload): string {
  const s = data.seoSearches;
  const k = data.keywordOpportunity;
  const spend = data.dataforseoSpend;
  return formatMcpFacts([
    ["Workspace", data.workspace.name],
    ["Plan", data.workspace.plan],
    [
      "SEO searches this month",
      s.unlimited
        ? `${s.used} used (unlimited)`
        : `${s.used} of ${allowance(s.limit)} used — ${allowance(s.remaining)} left`,
    ],
    ["Allowance resets", s.resetsAt],
    [
      "Keyword Opportunity analyses",
      `${k.allowanceUsed} of ${allowance(k.allowanceTotal)} used — ${allowance(
        k.allowanceRemaining,
      )} left, plus ${k.credits} prepaid credit${k.credits === 1 ? "" : "s"}`,
    ],
    [
      "Tracked keywords",
      `${data.trackedKeywords.used} of ${data.trackedKeywords.limit}`,
    ],
    [
      "SEO data spend this month",
      `${usd(spend.monthUsd)} of ${usd(spend.capUsd)} cap — ${usd(spend.remainingUsd)} left`,
    ],
  ]);
}

// ─── SERP Checker ────────────────────────────────────────────────────────────

const SERP_RESULT_COLUMNS: McpTableColumn<Record<string, unknown>>[] = [
  { header: "pos", value: (row) => row.position ?? row.rank_group },
  { header: "domain", value: (row) => row.domain, format: truncatedCell(48) },
  { header: "url", value: (row) => row.url, format: truncatedCell(90) },
  { header: "title", value: (row) => row.title, format: truncatedCell(70) },
];

function serpItems(results: unknown): Record<string, unknown>[] {
  if (typeof results !== "object" || results === null) return [];
  const items = (results as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items.filter(
    (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
  );
}

export function renderGetSerpCheck(data: GetSerpCheckPayload): string {
  if (!data.found || !data.check) {
    return data.note ?? "No stored SERP check matches that request.";
  }
  const c = data.check;
  const facts = formatMcpFacts([
    ["Keyword", c.keyword],
    ["Market", `${c.locationCode} / ${c.languageCode} / ${c.device}`],
    ["Status", c.status],
    ["Checked", c.completedAt ?? c.createdAt],
    ["Results", c.itemCount],
    ["SERP features", c.serpFeatures.length ? c.serpFeatures.join(", ") : "none"],
    ["Cost", usd(c.costUsd)],
  ]);
  if (c.status !== "completed") {
    return `${facts}\n${
      data.note ?? "Still with the provider — poll get_serp_check again in a few minutes."
    }`;
  }
  const { rows, omitted } = capped(serpItems(c.results));
  return withOmitted(
    formatMcpSection({
      title: `SERP check — ${c.keyword}`,
      facts: [facts],
      rows,
      columns: SERP_RESULT_COLUMNS,
      emptyNote: "The check completed with no organic results stored.",
    }),
    omitted,
  );
}

export function renderStartSerpCheck(data: StartSerpCheckPayload): string {
  return formatMcpFacts([
    ["Keyword", data.keyword],
    ["Check id", data.id],
    ["Status", data.status],
    ["Served from cache", data.cached],
    ["Next", data.note ?? "Poll get_serp_check with this id."],
  ]);
}

// ─── Rank Tracker ────────────────────────────────────────────────────────────

const RANK_PROJECT_COLUMNS: McpTableColumn<RankTrackerPayload["projects"][number]>[] = [
  { header: "id", value: (row) => row.id },
  { header: "name", value: (row) => row.name, format: truncatedCell(40) },
  { header: "domain", value: (row) => row.domain, format: truncatedCell(40) },
  { header: "keywords", value: (row) => row.keywordCount },
  { header: "avg pos", value: (row) => row.averagePosition },
  { header: "freq", value: (row) => row.frequency },
  { header: "device", value: (row) => row.device },
  { header: "last run", value: (row) => row.lastRunAt },
];

const RANK_KEYWORD_COLUMNS: McpTableColumn<RankTrackerPayload["keywords"][number]>[] = [
  { header: "keyword", value: (row) => row.keyword, format: truncatedCell(60) },
  // A null position is "not in the top 100" — formatMcpCell renders it "—",
  // which is the honest rendering. It must never become 0.
  { header: "pos", value: (row) => row.position },
  { header: "vs prev", value: (row) => row.deltaPrevious },
  { header: "vs 30d", value: (row) => row.delta30d },
  { header: "pending", value: (row) => row.pending },
  { header: "url", value: (row) => row.url, format: truncatedCell(90) },
];

export function renderRankTracker(data: RankTrackerPayload): string {
  if (data.project) {
    const p = data.project;
    const { rows, omitted } = capped(data.keywords);
    return withOmitted(
      formatMcpSection({
        title: `Rank tracking — ${p.name} (${p.domain})`,
        facts: [
          formatMcpFacts([
            ["Market", `${p.locationCode} / ${p.languageCode} / ${p.device}`],
            ["Frequency", p.frequency],
            ["Keywords", p.keywordCount],
            ["Average position", p.averagePosition],
            ["Last run", p.lastRunAt],
            ["Checks in flight", p.pendingCount],
            ["Paused by plan cap", p.overCap],
          ]),
        ],
        rows,
        columns: RANK_KEYWORD_COLUMNS,
        emptyNote: "This project has no keywords yet.",
      }),
      omitted,
    );
  }

  const { rows, omitted } = capped(data.projects);
  return withOmitted(
    formatMcpSection({
      title: "Rank-tracking projects",
      rows,
      columns: RANK_PROJECT_COLUMNS,
      emptyNote:
        data.note ??
        "No rank-tracking projects on this workspace. Create one on the Rank Tracker page.",
    }),
    omitted,
  );
}

export function renderRankKeywordMutation(
  data: RankKeywordMutationPayload,
  verb: "Added" | "Removed",
): string {
  return formatMcpFacts([
    ["Project", data.projectId],
    [verb, data.changed.length ? data.changed.join(", ") : "nothing"],
    ["Ignored", data.ignored.length ? data.ignored.join(", ") : "none"],
    ["Keywords in project", data.keywordCount],
    [
      "Tracked across workspace",
      `${data.trackedKeywords} of ${data.trackedKeywordLimit}`,
    ],
  ]);
}

// ─── Stored analyses ─────────────────────────────────────────────────────────

function ageLine(ageHours: number): string {
  return ageHours < 48
    ? `${ageHours.toFixed(1)} hours old`
    : `${(ageHours / 24).toFixed(1)} days old`;
}

const REFERRING_DOMAIN_COLUMNS: McpTableColumn<Record<string, unknown>>[] = [
  { header: "domain", value: (row) => row.domain, format: truncatedCell(60) },
  { header: "rank", value: (row) => row.rank },
  { header: "backlinks", value: (row) => row.backlinks },
  { header: "spam", value: (row) => row.spamScore },
  { header: "first seen", value: (row) => row.firstSeen },
];

const ANCHOR_COLUMNS: McpTableColumn<Record<string, unknown>>[] = [
  { header: "anchor", value: (row) => row.anchor, format: truncatedCell(60) },
  { header: "backlinks", value: (row) => row.backlinks },
  { header: "ref domains", value: (row) => row.referringDomains },
  { header: "dofollow domains", value: (row) => row.dofollowDomains },
];

const LINKED_PAGE_COLUMNS: McpTableColumn<Record<string, unknown>>[] = [
  { header: "url", value: (row) => row.url, format: truncatedCell(90) },
  { header: "backlinks", value: (row) => row.backlinks },
  { header: "ref domains", value: (row) => row.referringDomains },
  { header: "rank", value: (row) => row.rank },
  { header: "status", value: (row) => row.statusCode },
];

export function renderBacklinksOverview(data: BacklinksOverviewPayload): string {
  if (!data.found || !data.analysis) {
    return (
      data.note ??
      "No stored backlinks analysis for this workspace. Run one on the Backlinks page — this tool never spends."
    );
  }
  const a = data.analysis;
  const s = (a.summary ?? {}) as Record<string, unknown>;
  const blocks: string[] = [
    `Backlinks — ${a.target} (${a.mode})`,
    formatMcpFacts([
      ["Analysed", `${a.createdAt} (${ageLine(a.ageHours)})`],
      ["Status", a.status],
      ["Sections that failed", a.failedSections.length ? a.failedSections.join(", ") : "none"],
      ["Cost of this analysis", usd(a.costUsd)],
      ["Backlinks", s.backlinks],
      ["Referring domains", s.referringDomains],
      ["Domain rank", s.rank],
      ["Broken backlinks", s.brokenBacklinks],
      [
        "Dofollow domains",
        typeof s.dofollowRatio === "number"
          ? `${formatMcpCell(s.dofollowDomains)} (${(s.dofollowRatio * 100).toFixed(1)}%)`
          : formatMcpCell(s.dofollowDomains),
      ],
    ]),
  ];

  const domains = capped(data.referringDomains as Record<string, unknown>[]);
  blocks.push(
    withOmitted(
      formatMcpSection({
        title: "\nTop referring domains",
        rows: domains.rows,
        columns: REFERRING_DOMAIN_COLUMNS,
        emptyNote: "No referring-domain rows stored.",
      }),
      domains.omitted,
    ),
  );

  const anchors = capped(data.anchors as Record<string, unknown>[]);
  blocks.push(
    withOmitted(
      formatMcpSection({
        title: "\nTop anchors",
        rows: anchors.rows,
        columns: ANCHOR_COLUMNS,
        emptyNote: "No anchor rows stored.",
      }),
      anchors.omitted,
    ),
  );

  const pages = capped(data.pages as Record<string, unknown>[]);
  blocks.push(
    withOmitted(
      formatMcpSection({
        title: "\nMost-linked pages",
        rows: pages.rows,
        columns: LINKED_PAGE_COLUMNS,
        emptyNote: "No page rows stored (page- and path-scoped analyses skip this section).",
      }),
      pages.omitted,
    ),
  );

  const links = capped(data.links as Record<string, unknown>[]);
  blocks.push(
    withOmitted(
      formatMcpSection({
        title: "\nIndividual links",
        rows: links.rows,
        columns: BACKLINK_ROW_COLUMNS,
        emptyNote:
          data.note ??
          "No individual-link rows stored. On plans below Agency this section is not purchased at all.",
      }),
      links.omitted,
    ),
  );

  return blocks.join("\n");
}

const BACKLINK_ROW_COLUMNS: McpTableColumn<Record<string, unknown>>[] = [
  { header: "from", value: (row) => row.urlFrom, format: truncatedCell(80) },
  { header: "anchor", value: (row) => row.anchor, format: truncatedCell(50) },
  { header: "domain rank", value: (row) => row.domainRank },
  { header: "follow", value: (row) => (row.dofollow ? "dofollow" : "nofollow") },
  {
    header: "status",
    value: (row) => (row.isBroken ? "broken" : row.isLost ? "lost" : "live"),
  },
];

const DOMAIN_KEYWORD_COLUMNS: McpTableColumn<Record<string, unknown>>[] = [
  { header: "keyword", value: (row) => row.keyword, format: truncatedCell(60) },
  { header: "pos", value: (row) => row.position },
  { header: "volume", value: (row) => row.searchVolume },
  { header: "etv", value: (row) => row.etv },
  { header: "url", value: (row) => row.url, format: truncatedCell(90) },
];

const COMPETITOR_COLUMNS: McpTableColumn<Record<string, unknown>>[] = [
  { header: "domain", value: (row) => row.domain, format: truncatedCell(60) },
  { header: "shared keywords", value: (row) => row.intersections },
  { header: "their avg pos", value: (row) => row.avgPosition },
  { header: "their etv", value: (row) => row.etv },
];

export function renderDomainOverview(data: DomainOverviewPayload): string {
  if (!data.found || !data.analysis) {
    return (
      data.note ??
      "No stored Site Explorer analysis for this workspace. Run one on the Site Explorer page — this tool never spends."
    );
  }
  const a = data.analysis;
  const o = (a.overview ?? {}) as Record<string, unknown>;
  const dist = (o.distribution ?? {}) as Record<string, unknown>;
  const blocks: string[] = [
    `Domain overview — ${a.domain}`,
    formatMcpFacts([
      ["Analysed", `${a.createdAt} (${ageLine(a.ageHours)})`],
      ["Market", `${a.locationCode} / ${a.languageCode}`],
      ["Status", a.status],
      ["Sections that failed", a.failedSections.length ? a.failedSections.join(", ") : "none"],
      ["Cost of this analysis", usd(a.costUsd)],
      ["Organic keywords (top 100)", o.keywordCount],
      ["Estimated monthly organic traffic", o.etv],
      ["Equivalent paid cost / month", o.estimatedPaidTrafficCost],
      [
        "Position spread",
        `#1 ${formatMcpCell(dist.pos1)} · 2-3 ${formatMcpCell(dist.pos2_3)} · 4-10 ${formatMcpCell(
          dist.pos4_10,
        )} · 11-20 ${formatMcpCell(dist.pos11_20)} · 21-100 ${formatMcpCell(dist.pos21_100)}`,
      ],
    ]),
  ];

  const keywords = capped(data.keywords as Record<string, unknown>[]);
  blocks.push(
    withOmitted(
      formatMcpSection({
        title: "\nRanked keywords",
        rows: keywords.rows,
        columns: DOMAIN_KEYWORD_COLUMNS,
        emptyNote: "No ranked-keyword rows stored.",
      }),
      keywords.omitted,
    ),
  );

  const competitors = capped(data.competitors as Record<string, unknown>[]);
  blocks.push(
    withOmitted(
      formatMcpSection({
        title: "\nOrganic competitors",
        rows: competitors.rows,
        columns: COMPETITOR_COLUMNS,
        emptyNote: "No competitor rows stored.",
      }),
      competitors.omitted,
    ),
  );

  const pages = capped(data.pages as Record<string, unknown>[]);
  blocks.push(
    withOmitted(
      formatMcpSection({
        title: "\nTop pages",
        rows: pages.rows,
        columns: DOMAIN_PAGE_COLUMNS,
        emptyNote:
          "No page rows stored. Analyses run before the Pages tab shipped have none — that is not a finding about the domain.",
      }),
      pages.omitted,
    ),
  );

  return blocks.join("\n");
}

const DOMAIN_PAGE_COLUMNS: McpTableColumn<Record<string, unknown>>[] = [
  { header: "page", value: (row) => row.url, format: truncatedCell(90) },
  { header: "keywords", value: (row) => row.keywordCount },
  { header: "traffic", value: (row) => row.etv },
  { header: "at #1", value: (row) => row.topPositions },
];

const OPPORTUNITY_COLUMNS: McpTableColumn<Record<string, unknown>>[] = [
  { header: "keyword", value: (row) => row.keyword, format: truncatedCell(60) },
  { header: "score", value: (row) => row.opportunityScore },
  { header: "severity", value: (row) => row.severity },
  { header: "volume", value: (row) => row.monthlyVolume },
  { header: "cpc", value: (row) => row.cpcUsd },
  { header: "trend %", value: (row) => row.trendPercent },
  { header: "google pos", value: (row) => row.googleRank },
  { header: "intent", value: (row) => row.intent },
  { header: "ai tested", value: (row) => row.aiTested },
];

export function renderKeywordOpportunities(data: KeywordOpportunitiesPayload): string {
  if (!data.found || !data.analysis) {
    return (
      data.note ??
      "No Keyword Opportunity Finder run on this workspace yet. Start one on the Keyword Opportunities page — this tool never spends."
    );
  }
  const a = data.analysis;
  const { rows, omitted } = capped(data.opportunities as Record<string, unknown>[]);
  return withOmitted(
    formatMcpSection({
      title: `Keyword opportunities — ${a.domain}`,
      facts: [
        formatMcpFacts([
          ["Status", a.status],
          ["Run", a.completedAt ?? a.createdAt],
          ["Served from cache", a.fromCache],
          ["Cost of this run", usd(a.costUsd)],
        ]),
      ],
      rows,
      columns: OPPORTUNITY_COLUMNS,
      emptyNote: data.note ?? "The run completed with no scored opportunities.",
    }),
    omitted,
  );
}

// ─── AI Citations ────────────────────────────────────────────────────────────

const AI_CITATION_COLUMNS: McpTableColumn<Record<string, unknown>>[] = [
  { header: "page", value: (row) => row.url, format: truncatedCell(90) },
  { header: "platform", value: (row) => row.platform },
  { header: "mentions", value: (row) => row.mentions },
  { header: "ai volume", value: (row) => row.capturedVolume },
  {
    header: "example prompts",
    value: (row) => (Array.isArray(row.prompts) ? row.prompts.join(" / ") : null),
    format: truncatedCell(120),
  },
];

const SOV_COLUMNS: McpTableColumn<{
  label: string;
  isTarget: boolean;
  mentions: number | null;
  sharePct: number | null;
}>[] = [
  { header: "brand", value: (row) => `${row.label}${row.isTarget ? " (you)" : ""}` },
  { header: "mentions", value: (row) => row.mentions },
  // null share renders as "—", which is the honest rendering of "no data" and
  // must never become 0% — see share-of-voice.ts.
  { header: "share %", value: (row) => row.sharePct },
];

export function renderAiCitations(data: AiCitationsPayload): string {
  if (!data.found || !data.analysis) {
    return data.note ?? "No stored AI Citations lookup on this workspace.";
  }
  const a = data.analysis;
  const blocks: string[] = [
    `AI citations — ${a.target} (${a.scope})`,
    formatMcpFacts([
      ["Looked up", `${a.createdAt} (${ageLine(a.ageHours)})`],
      ["Platforms", a.platforms.join(", ")],
      ["Status", a.status],
      [
        "Platforms that failed",
        a.failedPlatforms.length ? a.failedPlatforms.join(", ") : "none",
      ],
      ["Cost of this lookup", usd(a.costUsd)],
    ]),
    "",
    formatMcpTable(
      data.totals,
      [
        { header: "platform", value: (row) => row.platform },
        { header: "mentions", value: (row) => row.mentions },
        { header: "ai volume", value: (row) => row.aiSearchVolume },
        { header: "impressions", value: (row) => row.impressions },
      ],
    ),
  ];

  if (data.shareOfVoice && data.shareOfVoice.entries.length > 0) {
    blocks.push(
      formatMcpSection({
        title: `\nShare of voice across ${data.shareOfVoice.platforms.join(", ")}`,
        rows: data.shareOfVoice.entries,
        columns: SOV_COLUMNS,
        emptyNote: "No competitors were compared.",
      }),
    );
  }

  const { rows, omitted } = capped(data.sources as Record<string, unknown>[]);
  blocks.push(
    withOmitted(
      formatMcpSection({
        title: "\nPages cited",
        rows,
        columns: AI_CITATION_COLUMNS,
        emptyNote:
          "No cited pages found. That is a finding rather than an error — AI assistants are answering about this target from somewhere else.",
      }),
      omitted,
    ),
  );

  return blocks.join("\n");
}

// ─── Research log ────────────────────────────────────────────────────────────

const RESEARCH_LOG_COLUMNS: McpTableColumn<ResearchLogPayload["entries"][number]>[] = [
  { header: "what", value: (row) => row.feature },
  { header: "target", value: (row) => row.target, format: truncatedCell(70) },
  { header: "age", value: (row) => ageLine(row.ageHours) },
  { header: "cost", value: (row) => usd(row.costUsd) },
  // The column an agent is meant to act on: "yes" means read it back rather
  // than buying it again.
  { header: "reusable", value: (row) => row.reusable },
  { header: "result id", value: (row) => row.sourceRef },
];

export function renderResearchLog(data: ResearchLogPayload): string {
  const reusable = data.entries.filter((entry) => entry.reusable).length;
  const spent = data.entries.reduce((total, entry) => total + entry.costUsd, 0);
  return formatMcpSection({
    title: "Research already paid for on this workspace",
    facts: [
      formatMcpFacts([
        ["Entries shown", data.entries.length],
        [`Still worth reusing (under ${data.reuseWindowDays} days)`, reusable],
        ["Spent on the research shown", usd(spent)],
      ]),
    ],
    rows: data.entries,
    columns: RESEARCH_LOG_COLUMNS,
    emptyNote:
      data.note ??
      "Nothing researched yet. Anything you buy will be recorded here so it is not bought twice.",
  });
}

// ─── Owned-data reads ────────────────────────────────────────────────────────

const GSC_COLUMNS: McpTableColumn<GscQueriesPayload["queries"][number]>[] = [
  { header: "query", value: (row) => row.query, format: truncatedCell(70) },
  { header: "clicks", value: (row) => row.clicks },
  { header: "impressions", value: (row) => row.impressions },
  { header: "ctr %", value: (row) => row.ctr },
  { header: "avg pos", value: (row) => row.avgPosition },
];

export function renderGscQueries(data: GscQueriesPayload): string {
  if (!data.connected || data.needsReauth) {
    return data.note ?? "Search Console is not connected on this workspace.";
  }
  const { rows, omitted } = capped(data.queries);
  return withOmitted(
    formatMcpSection({
      title: `Search Console queries — last ${data.windowDays} days`,
      facts: [
        formatMcpFacts([
          ["Property", data.property],
          ["Last sync", data.lastSyncAt],
        ]),
      ],
      rows,
      columns: GSC_COLUMNS,
      emptyNote: data.note ?? "No query rows in this window.",
    }),
    omitted,
  );
}

const CRAWL_ISSUE_COLUMNS: McpTableColumn<CrawlSummaryPayload["topIssues"][number]>[] = [
  { header: "issue", value: (row) => row.type },
  { header: "severity", value: (row) => row.severity },
  { header: "pages", value: (row) => row.pages },
];

export function renderCrawlSummary(data: CrawlSummaryPayload): string {
  if (!data.found || !data.crawl) {
    return (
      data.note ??
      "No completed site crawl on this workspace. Start one on the Site Crawler page."
    );
  }
  const c = data.crawl;
  const { rows, omitted } = capped(data.topIssues);
  return withOmitted(
    formatMcpSection({
      title: `Site crawl — ${c.rootUrl}`,
      facts: [
        formatMcpFacts([
          ["Crawl id", c.id],
          ["Finished", c.finishedAt],
          ["Pages crawled", c.pagesCrawled],
          ["Issues found", c.issueCount],
          ["Stopped early", c.stoppedReason],
        ]),
      ],
      rows,
      columns: CRAWL_ISSUE_COLUMNS,
      emptyNote: "The crawl found no issues.",
    }),
    omitted,
  );
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

/**
 * Render a validated tool payload as text.
 *
 * A tool with no renderer falls back to pretty JSON — which is exactly what
 * every tool did before this module existed, so an un-rendered tool degrades
 * to the old behaviour rather than to an empty block. The three
 * externally-shaped tools (suggest_keywords, get_latest_audit,
 * get_visibility_summary) use that fallback on purpose: their payloads are
 * nested reports, not row sets, and a table would flatten away their structure.
 */
export function renderToolText(name: string, data: unknown): string {
  switch (name) {
    case "whoami":
      return renderWhoami(data as WhoamiPayload);
    case "get_serp_check":
      return renderGetSerpCheck(data as GetSerpCheckPayload);
    case "start_serp_check":
      return renderStartSerpCheck(data as StartSerpCheckPayload);
    case "get_rank_tracker":
      return renderRankTracker(data as RankTrackerPayload);
    case "add_rank_tracking_keywords":
      return renderRankKeywordMutation(data as RankKeywordMutationPayload, "Added");
    case "remove_rank_tracking_keywords":
      return renderRankKeywordMutation(data as RankKeywordMutationPayload, "Removed");
    case "get_backlinks_overview":
      return renderBacklinksOverview(data as BacklinksOverviewPayload);
    case "get_domain_overview":
      return renderDomainOverview(data as DomainOverviewPayload);
    case "list_keyword_opportunities":
      return renderKeywordOpportunities(data as KeywordOpportunitiesPayload);
    case "get_ai_citations":
      return renderAiCitations(data as AiCitationsPayload);
    case "get_research_log":
      return renderResearchLog(data as ResearchLogPayload);
    case "get_gsc_queries":
      return renderGscQueries(data as GscQueriesPayload);
    case "get_crawl_summary":
      return renderCrawlSummary(data as CrawlSummaryPayload);
    default:
      return JSON.stringify(data, null, 2);
  }
}

/**
 * Tools with a table renderer, as opposed to the JSON fallback.
 *
 * Exists so the suite can assert WHICH tools fall back. A renderer quietly
 * lost in a refactor would otherwise degrade to a JSON dump — the old
 * behaviour, and therefore invisible.
 */
export function hasDedicatedRenderer(name: string): boolean {
  return RENDERED_TOOLS.has(name);
}

const RENDERED_TOOLS = new Set([
  "whoami",
  "get_serp_check",
  "start_serp_check",
  "get_rank_tracker",
  "add_rank_tracking_keywords",
  "remove_rank_tracking_keywords",
  "get_backlinks_overview",
  "get_domain_overview",
  "list_keyword_opportunities",
  "get_ai_citations",
  "get_research_log",
  "get_gsc_queries",
  "get_crawl_summary",
]);

/** Column sets are exported for the snapshot tests, which assert headers. */
export const __rendering = {
  SERP_RESULT_COLUMNS,
  RANK_PROJECT_COLUMNS,
  RANK_KEYWORD_COLUMNS,
  GSC_COLUMNS,
  CRAWL_ISSUE_COLUMNS,
  formatMcpTable,
  TEXT_ROW_CAP,
};
