// src/lib/partner/shape.ts
//
// The partner API's wire shapes, built from what the av-visibility sidecar
// returns (av_service.py serialize()). PURE: no Prisma, no Redis, so the
// contract is testable over literals. Within v1 these shapes only ever gain
// fields (docs/agents/integrations.md, "Partner API (EchoPilot)").

export type PartnerAuditMode = "quick" | "full";

export interface PartnerCrawler {
  /** The robots.txt user-agent token, e.g. "GPTBot". */
  engine: string;
  vendor: string;
  /** "ALLOWED" | "BLOCKED", exactly as robots.txt evaluates for this token. */
  status: string;
  /** In the subset the robots score is computed over (the answer engines that matter most). */
  scored: boolean;
  detail: string;
}

export interface PartnerCheck {
  key: string;
  label: string;
  score: number;
  max: number;
  detail: string;
  recommendation: string;
}

export interface PartnerAudit {
  id: string;
  url: string;
  mode: PartnerAuditMode;
  score: number;
  grade: string;
  rendering: { likelyCsr: boolean; textLength: number; framework: string | null } | null;
  robotsTxt: boolean;
  crawlers: PartnerCrawler[];
  checks: PartnerCheck[];
  createdAt: string;
}

/** Vendors per robots token (ai_visibility_audit.py AI_BOT_TOKENS). Unknown tokens report "Other". */
const VENDORS: Readonly<Record<string, string>> = {
  GPTBot: "OpenAI",
  "OAI-SearchBot": "OpenAI",
  "ChatGPT-User": "OpenAI",
  ClaudeBot: "Anthropic",
  "Claude-User": "Anthropic",
  "anthropic-ai": "Anthropic",
  PerplexityBot: "Perplexity",
  "Perplexity-User": "Perplexity",
  "Google-Extended": "Google",
  "Applebot-Extended": "Apple",
  CCBot: "Common Crawl",
  "meta-externalagent": "Meta",
  Bytespider: "ByteDance",
};

/** ai_visibility_audit.py SCORED_BOTS, in its order. Listed first in `crawlers`. */
const SCORED = [
  "GPTBot",
  "OAI-SearchBot",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "meta-externalagent",
];

/** Stable keys for the sidecar's check labels. A new label falls back to its slug. */
const CHECK_KEYS: Readonly<Record<string, string>> = {
  "robots.txt AI access": "robots",
  "Server-rendered content": "rendering",
  "Structured data (JSON-LD)": "structured_data",
  "XML sitemap": "sitemap",
  "Head metadata": "head",
  "Heading structure": "headings",
  "Content signals": "content",
};

export function checkKey(label: string): string {
  return CHECK_KEYS[label] ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

interface SidecarCheck {
  category?: string;
  points?: number;
  max?: number;
  status?: string;
  recommendation?: string;
}
interface SidecarAudit {
  url?: string;
  score?: number;
  grade?: string;
  checks?: SidecarCheck[];
  robots?: { present?: boolean; bots?: Record<string, { status?: string; detail?: string }> };
  rendering?: { likely_csr?: boolean; text_len?: number; framework?: string | null };
}

export interface StoredAuditRow {
  id: string;
  url: string;
  score: number;
  grade: string;
  raw: unknown;
  createdAt: Date;
}

export function toPartnerAudit(row: StoredAuditRow, mode: PartnerAuditMode): PartnerAudit {
  const raw = (row.raw && typeof row.raw === "object" ? row.raw : {}) as SidecarAudit;
  const bots = raw.robots?.bots ?? {};
  const order = (t: string) => {
    const i = SCORED.indexOf(t);
    return i === -1 ? SCORED.length : i;
  };
  const crawlers = Object.entries(bots)
    .map(([engine, b]) => ({
      engine,
      vendor: VENDORS[engine] ?? "Other",
      status: String(b?.status ?? "UNKNOWN"),
      scored: SCORED.includes(engine),
      detail: String(b?.detail ?? ""),
    }))
    .sort((a, b) => order(a.engine) - order(b.engine));
  const checks = (raw.checks ?? []).map((c) => ({
    key: checkKey(String(c.category ?? "")),
    label: String(c.category ?? ""),
    score: Number(c.points ?? 0),
    max: Number(c.max ?? 0),
    detail: String(c.status ?? ""),
    recommendation: String(c.recommendation ?? ""),
  }));
  const r = raw.rendering;
  return {
    id: row.id,
    url: row.url,
    mode,
    score: row.score,
    grade: row.grade,
    rendering: r
      ? { likelyCsr: !!r.likely_csr, textLength: Number(r.text_len ?? 0), framework: r.framework ?? null }
      : null,
    robotsTxt: !!raw.robots?.present,
    crawlers,
    checks,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The dashboard benchmark's summary line (api/ai/visibility/benchmark summarize()). */
export function benchmarkSummary(a: PartnerAudit) {
  return {
    url: a.url,
    score: a.score,
    grade: a.grade,
    blocked: a.crawlers.filter((c) => c.status === "BLOCKED").length,
    botTotal: a.crawlers.length,
  };
}

/** "acme" from "https://www.acme.com/x" — the brand term the prompt worker derives from a monitor URL. */
export function domainRoot(url: string): string | null {
  const host = url.replace(/^https?:\/\//, "").split("/")[0];
  const parts = host.split(".").filter(Boolean);
  const root = parts[0] === "www" ? parts[1] : parts[0];
  return root && root.length >= 3 ? root : null;
}
