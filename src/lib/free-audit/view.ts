// src/lib/free-audit/view.ts — the free AI Readiness Audit's result, shaped for
// the page (ECHORANK-AI-VISIBILITY-PAGES.md Phase 2): score card, top 3 fixes
// with their snippets, the AI crawler table, the checks by group.
//
// PURE AND DEPENDENCY-LIGHT: the result component (a Client Component), the
// permalink page and the tests all read it.
//
// HOSTILE INPUT. Everything here that came from the audited site (its title,
// its URL, its robots.txt tokens) is returned as PLAIN TEXT and rendered by
// React as text. Snippets are text to copy, never markup to inject, and the
// JSON-LD snippet additionally escapes <, > and & as unicode escapes so a
// pasted block cannot close its own <script> tag.

export type Bot = "OAI-SearchBot" | "ChatGPT-User" | "GPTBot" | "Claude-SearchBot" | "ClaudeBot" | "PerplexityBot" | "Google-Extended";
export const CRAWLER_TABLE_BOTS: readonly Bot[] = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "Claude-SearchBot",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
];

/** The answer bots the robots.txt snippet welcomes (the scorer's major answer bots plus ChatGPT-User). */
export const SNIPPET_ANSWER_BOTS = ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "PerplexityBot"] as const;

export type AuditJson = Record<string, unknown>;

export interface RawCheck {
  id?: string;
  category: string;
  points: number;
  max: number;
  status: string;
  recommendation?: string;
  group?: string;
  ran?: boolean;
  scored?: boolean;
  params?: Record<string, unknown>;
}
export interface RawGate {
  id: string;
  cap: number;
  reason?: string;
  params?: Record<string, unknown>;
}
export interface RawFix {
  id: string;
  kind: "gate" | "check";
  title?: string;
  fix?: string;
  recover?: number;
  params?: Record<string, unknown>;
}

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function checksOf(a: AuditJson): RawCheck[] {
  return arr<RawCheck>(a.checks).filter((c) => c && typeof c === "object" && typeof c.category === "string");
}
export function gatesOf(a: AuditJson): RawGate[] {
  return arr<RawGate>(a.gates).filter((g) => g && typeof g.id === "string");
}

/** The top fixes, sorted by points recoverable (highest first), at most three. */
export function topFixesOf(a: AuditJson, n = 3): RawFix[] {
  return arr<RawFix>(a.top_fixes)
    .filter((f) => f && typeof f.id === "string")
    .map((f, i) => ({ f, i }))
    .sort((x, y) => num(y.f.recover) - num(x.f.recover) || x.i - y.i)
    .slice(0, n)
    .map((x) => x.f);
}

export type SnippetKind = "robots" | "org" | null;
/** Which copyable snippet a fix gets. (llms.txt is not scored since v3, so it is never a top fix.) */
export function snippetKindFor(id: string): SnippetKind {
  if (id === "robots-answer-bots" || id === "explicit-welcome" || id === "answer-bots-blocked") return "robots";
  if (id === "org-schema" || id === "no-entity") return "org";
  return null;
}

/** robots.txt groups that welcome the answer bots. Plain text. */
export function robotsSnippet(): string {
  return SNIPPET_ANSWER_BOTS.map((b) => `User-agent: ${b}\nAllow: /`).join("\n\n") + "\n";
}

/** The site's display name for the JSON-LD snippet: its <title> before a separator, else the host. Plain text. */
export function siteName(a: AuditJson): string {
  const head = (a.head && typeof a.head === "object" ? a.head : {}) as Record<string, unknown>;
  const title = str(head.title).split(/\s[|–—-]\s/)[0]?.trim() ?? "";
  if (title) return title.slice(0, 120);
  return hostOf(a);
}

export function siteUrl(a: AuditJson): string {
  const raw = str(a.url) || str(a.brand);
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return `${u.protocol}//${u.host}/`;
  } catch {
    return "https://example.com/";
  }
}

export function hostOf(a: AuditJson): string {
  try {
    return new URL(siteUrl(a)).hostname;
  } catch {
    return "";
  }
}

const LINE_SEP = new RegExp(String.fromCharCode(0x2028), "g");
const PARA_SEP = new RegExp(String.fromCharCode(0x2029), "g");

/** JSON that cannot break out of a <script> block when pasted into a page. */
export function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(LINE_SEP, "\\u2028")
    .replace(PARA_SEP, "\\u2029");
}

/** Organization (or LocalBusiness) JSON-LD prefilled with the site's name and URL. Plain text to copy. */
export function orgSnippet(a: AuditJson): string {
  const local = checksOf(a).some((c) => c.id === "org-schema" && c.params?.local === true);
  const url = siteUrl(a);
  const body = {
    "@context": "https://schema.org",
    "@type": local ? "LocalBusiness" : "Organization",
    name: siteName(a),
    url,
    logo: `${url}logo.png`,
    sameAs: [] as string[],
  };
  return `<script type="application/ld+json">\n${scriptSafeJson(body)}\n</script>\n`;
}

// ─── The AI crawler table ───────────────────────────────────────────────────

export type BotStatus = "allowed" | "blocked" | "challenged" | "unknown";
export interface CrawlerRow {
  bot: Bot;
  status: BotStatus;
  /** The robots.txt lines that decide it, as text ("User-agent: GPTBot\nDisallow: /"), or null (no rule / no robots.txt). */
  rule: string | null;
}

/** "Disallow: / (matched 'GPTBot')" → the deciding group's lines. */
export function ruleFrom(detail: string): string | null {
  const m = /matched '([^']{1,80})'/.exec(detail);
  if (!m) return null;
  const agent = m[1];
  return detail.startsWith("Disallow: /") ? `User-agent: ${agent}\nDisallow: /` : `User-agent: ${agent}\nAllow: /`;
}

export function crawlerRows(a: AuditJson): CrawlerRow[] {
  const robots = (a.robots && typeof a.robots === "object" ? a.robots : {}) as { bots?: Record<string, { status?: string; detail?: string }> };
  const challenged = gatesOf(a).some((g) => g.id === "challenge");
  return CRAWLER_TABLE_BOTS.map((bot) => {
    const b = robots.bots?.[bot];
    if (challenged) return { bot, status: "challenged" as const, rule: b ? ruleFrom(str(b.detail)) : null };
    if (!b) return { bot, status: "unknown" as const, rule: null };
    const status: BotStatus = str(b.status).toUpperCase() === "BLOCKED" ? "blocked" : "allowed";
    return { bot, status, rule: ruleFrom(str(b.detail)) };
  });
}

/** Cloudflare seen on the homepage (the free audit's own verdict), so its AI-bot switch may block regardless of robots.txt. */
export function cloudflareDetected(a: AuditJson): boolean {
  return arr<{ id?: string; key?: string }>(a.verdicts).some((v) => v.id === "cloudflare" && v.key === "cloudflare.detected");
}

// ─── All checks, by group ───────────────────────────────────────────────────

export type CheckState = "pass" | "partial" | "fail" | "not_assessable" | "not_scored";
export function checkState(c: RawCheck): CheckState {
  if (c.scored === false) return "not_scored";
  if (c.ran === false) return "not_assessable";
  if (c.max > 0 && c.points >= c.max) return "pass";
  if (c.points > 0) return "partial";
  return "fail";
}

export interface GroupView {
  id: string;
  title: string;
  points: number;
  max: number;
  checks: RawCheck[];
}

export function groupsOf(a: AuditJson): GroupView[] {
  const groups = arr<{ id?: string; title?: string; points?: number; max?: number }>(a.groups).filter((g) => typeof g.id === "string");
  const checks = checksOf(a);
  if (groups.length === 0) return [{ id: "all", title: "", points: num(a.score), max: 100, checks }];
  return groups.map((g) => ({
    id: g.id!,
    title: str(g.title),
    points: num(g.points),
    max: num(g.max),
    checks: checks.filter((c) => c.group === g.id),
  }));
}

/** The one-sentence verdict's band. */
export type VerdictBand = "strong" | "good" | "fair" | "weak" | "poor";
export function verdictBand(score: number, gated: boolean): VerdictBand {
  if (score >= 85 && !gated) return "strong";
  if (score >= 70) return "good";
  if (score >= 55) return "fair";
  if (score >= 40) return "weak";
  return "poor";
}
