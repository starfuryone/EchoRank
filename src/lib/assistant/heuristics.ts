// src/lib/assistant/heuristics.ts
//
// Deterministic findings, computed in TypeScript from the sidecar's audit.
//
// WHY THIS EXISTS. The model must never be the thing that *detects* whether a
// site has a sitemap. Detection is a fact; a fact is code's job. The model's job
// is to explain the facts in the visitor's language and answer the follow-up.
// Everything below is pure, synchronous and testable without a network, and the
// answer it produces is identical for the same input every time — which is what
// makes an anonymous funnel cheap to run and safe to cache.
//
// IT DOES NOT RE-AUDIT. The scored checks come straight from av-visibility's
// audit_site() — the same call the paid audit and the free grader make — for the
// reason stated in the sidecar's own /grade docstring: a second scoring
// implementation disagrees with the first within a release or two. What this
// module adds is the *shaping* the sidecar does not do: severity ordering, the
// named blocked crawlers, and the handful of observations the scored checks roll
// up rather than surface individually.

/** The AI answer engines whose access is worth naming to a visitor. */
export const NAMED_AI_CRAWLERS: Record<string, string> = {
  GPTBot: "ChatGPT",
  "OAI-SearchBot": "ChatGPT Search",
  ChatGPTUser: "ChatGPT browsing",
  "ClaudeBot": "Claude",
  "Claude-Web": "Claude",
  PerplexityBot: "Perplexity",
  "Google-Extended": "Google AI answers",
  Applebot: "Apple Intelligence",
  Bingbot: "Copilot",
};

export interface SidecarCheck {
  category: string;
  points: number;
  max: number;
  status: string;
  recommendation: string;
}

export interface SidecarAudit {
  url?: string;
  score?: number;
  grade?: string;
  checks?: SidecarCheck[];
  robots?: {
    present?: boolean;
    sitemaps?: string[];
    bots?: Record<string, { status?: string; detail?: string }>;
  };
  jsonld?: { types?: string[]; blocks?: number; errors?: string[] };
  head?: { title?: string; description?: string; h1s?: string[]; og?: unknown };
  rendering?: { likely_csr?: boolean; text_len?: number; framework?: string };
  llms_txt?: boolean;
  pages_found?: Record<string, string>;
  error?: string;
}

export type Severity = "critical" | "warning" | "ok";

export interface Finding {
  /** Stable id, so copy and tests can name a finding without matching prose. */
  id: string;
  severity: Severity;
  /** Short, human, no jargon. */
  title: string;
  /** What we actually observed. Facts only — this is what the model explains. */
  evidence: string;
  /** The concrete next step, when there is one. */
  fix?: string;
  /** Points lost, when the finding came from a scored check. */
  lost?: number;
}

export interface HeuristicSummary {
  url: string;
  score: number;
  grade: string;
  findings: Finding[];
  /** Counts, so copy can say "3 things to fix" without recounting. */
  counts: { critical: number; warning: number; ok: number };
}

/** Buckets match the sidecar's /grade endpoint so the two never disagree. */
export function gradeFor(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

function severityForCheck(check: SidecarCheck): Severity {
  const max = check.max > 0 ? check.max : 1;
  const kept = check.points / max;
  if (kept >= 0.999) return "ok";
  // Losing more than half of a category is a real hole, not a nitpick.
  return kept < 0.5 ? "critical" : "warning";
}

/** Crawler tokens robots.txt blocks, in the order the sidecar reported them. */
export function blockedCrawlers(audit: SidecarAudit): string[] {
  const bots = audit.robots?.bots ?? {};
  return Object.entries(bots)
    .filter(([, v]) => (v?.status ?? "").toUpperCase() === "BLOCKED")
    .map(([token]) => token);
}

/** "ChatGPT, Claude and Perplexity" from the raw crawler tokens. */
export function crawlerLabels(tokens: string[]): string[] {
  const seen = new Set<string>();
  for (const token of tokens) {
    seen.add(NAMED_AI_CRAWLERS[token] ?? token);
  }
  return [...seen];
}

/**
 * Findings the scored checks roll up rather than surface on their own.
 *
 * Each one is something a visitor can act on in an afternoon, and each is read
 * straight off the audit — nothing here infers, estimates or guesses.
 */
function extraFindings(audit: SidecarAudit): Finding[] {
  const out: Finding[] = [];

  const blocked = blockedCrawlers(audit);
  if (blocked.length > 0) {
    const labels = crawlerLabels(blocked);
    out.push({
      id: "ai_crawlers_blocked",
      severity: "critical",
      title: "AI assistants are blocked from reading this site",
      evidence: `robots.txt blocks ${blocked.join(", ")} — that is ${labels.join(", ")}.`,
      fix: "Allow those user-agents in robots.txt, then confirm your CDN or WAF is not blocking them separately.",
    });
  }

  if (audit.llms_txt === false) {
    out.push({
      id: "llms_txt_missing",
      severity: "warning",
      title: "No llms.txt",
      evidence: "There is no llms.txt at the site root.",
      fix: "Publish /llms.txt describing what the site is, who it serves and which pages matter most.",
    });
  } else if (audit.llms_txt === true) {
    out.push({
      id: "llms_txt_present",
      severity: "ok",
      title: "llms.txt is published",
      evidence: "An llms.txt was found at the site root.",
    });
  }

  const types = audit.jsonld?.types ?? [];
  const hasOrg = types.some((t) => t === "Organization" || t === "LocalBusiness");
  if (!hasOrg) {
    out.push({
      id: "organization_schema_missing",
      severity: "warning",
      title: "No Organization schema",
      evidence:
        types.length > 0
          ? `The homepage declares structured data (${types.join(", ")}) but no Organization or LocalBusiness type.`
          : "The homepage publishes no JSON-LD structured data at all.",
      fix: "Add Organization (or LocalBusiness) JSON-LD with name, url, logo and sameAs links to your profiles.",
    });
  }

  if (audit.rendering?.likely_csr) {
    out.push({
      id: "client_side_rendering",
      severity: "critical",
      title: "The page needs JavaScript to show its content",
      evidence: `The HTML served to a crawler carries only ${audit.rendering.text_len ?? 0} characters of text${
        audit.rendering.framework ? ` (${audit.rendering.framework})` : ""
      }.`,
      fix: "Server-render or pre-render the pages you want quoted — most answer-engine crawlers do not execute JavaScript.",
    });
  }

  const pages = audit.pages_found ?? {};
  const missingPages = ["about", "services", "faq", "contact"].filter((p) => !pages[p]);
  if (missingPages.length > 0 && Object.keys(pages).length > 0) {
    out.push({
      id: "key_pages_missing",
      severity: "warning",
      title: "Some pages assistants look for are not linked from the homepage",
      evidence: `No homepage link found for: ${missingPages.join(", ")}.`,
      fix: "Link an About, Services, FAQ and Contact page from the homepage — assistants use them to describe who you are.",
    });
  }

  return out;
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, ok: 2 };

/**
 * The whole deterministic layer: sidecar audit in, ordered findings out.
 *
 * Returns null for an audit the sidecar could not run — the caller reports that
 * as "we could not reach the site", never as a score of zero.
 */
export function summarize(audit: SidecarAudit): HeuristicSummary | null {
  if (!audit || audit.error || typeof audit.score !== "number") return null;

  const scored: Finding[] = (audit.checks ?? []).map((check) => {
    const severity = severityForCheck(check);
    return {
      id: check.category.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
      severity,
      title: check.category,
      evidence: check.status,
      ...(check.recommendation ? { fix: check.recommendation } : {}),
      lost: Math.max(0, check.max - check.points),
    };
  });

  const findings = [...scored, ...extraFindings(audit)].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    // Within a severity, the finding that costs the most points comes first.
    return (b.lost ?? 0) - (a.lost ?? 0);
  });

  const counts = { critical: 0, warning: 0, ok: 0 };
  for (const f of findings) counts[f.severity] += 1;

  const score = Math.max(0, Math.min(100, Math.round(audit.score)));

  return {
    url: audit.url ?? "",
    score,
    grade: audit.grade ?? gradeFor(score),
    findings,
    counts,
  };
}

/**
 * The evidence block handed to the model.
 *
 * PLAIN, BOUNDED TEXT. The model receives our derived findings, not the site's
 * raw HTML — there is nothing here a page author wrote that has not already
 * passed through a check with a fixed vocabulary. The one place site-authored
 * text could reach the model is the sidecar's `status` strings, which quote
 * page titles; the caller wraps this whole string in a delimited untrusted-data
 * block (see prompt.ts) for exactly that reason.
 */
export function renderEvidence(summary: HeuristicSummary): string {
  const lines = [
    `site: ${summary.url}`,
    `ai_visibility_score: ${summary.score}/100 (grade ${summary.grade})`,
    `issues: ${summary.counts.critical} critical, ${summary.counts.warning} to improve, ${summary.counts.ok} passing`,
    "findings:",
  ];
  for (const f of summary.findings) {
    lines.push(`- [${f.severity}] ${f.title}: ${f.evidence}${f.fix ? ` FIX: ${f.fix}` : ""}`);
  }
  return lines.join("\n");
}
