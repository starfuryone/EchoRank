// src/lib/bot-analytics/log-parser.ts
//
// Access-log parsing for Bot Analytics section B. Pure and synchronous per line
// so every format case is testable without a file, a queue, or a database.
//
// WHAT THIS IS ALLOWED TO PRODUCE: counts, dates, paths, status codes. Nothing
// else. The aggregate shape below has no field that could hold a raw line or an
// IP address, and that is deliberate — access logs are full of visitor IPs, the
// worker deletes the upload as soon as this returns, and the only way to keep an
// IP by accident would be to add a field for it here on purpose.
//
// IPs ARE read during parsing, for one narrow reason: Googlebot and Bingbot
// claims are worth verifying against each operator's published ranges, because
// "Googlebot" in a User-Agent is a string anything can send. The IP is used for
// that comparison and then dropped — see aggregate(), which stores only the
// verified/unverified counts.
//
// Formats: Apache/nginx combined (and the common variants), plus Caddy's JSON
// access log. Anything else is skipped rather than guessed at; a mis-parsed line
// would become a wrong number in a chart, which is worse than a skip we report.

import { BOT_CATALOG } from "@/lib/bot-catalog";

/** One usable line. `ip` is transient — never stored. */
export interface LogRecord {
  ts: Date;
  path: string;
  status: number;
  ua: string;
  ip: string;
}

/**
 * Combined Log Format, tolerant of the field the middle of the world adds.
 *
 *   ip - - [10/Oct/2025:13:55:36 -0700] "GET /p HTTP/1.1" 200 1234 "ref" "ua"
 *
 * The referrer/UA pair is optional so a plain CLF line still parses (it just has
 * no UA, and a line with no UA can never be a bot hit).
 */
// Numbered groups, not named ones: this repo compiles at ES2017, where named
// capture groups are a syntax error. Indices are named by the constants below so
// the call site still reads like fields rather than magic numbers.
const CLF_RE =
  /^(\S+) \S+ \S+ \[([^\]]+)\] "([A-Z]+) (\S+)[^"]*" (\d{3}) (\S+)(?: "([^"]*)" "([^"]*)")?/;
const CLF_IP = 1;
const CLF_TIME = 2;
const CLF_PATH = 4;
const CLF_STATUS = 5;
const CLF_UA = 8;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** `10/Oct/2025:13:55:36 -0700` → Date. Null on anything unexpected. */
export function parseClfTime(value: string): Date | null {
  const m =
    /^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})(?:\s+([+-]\d{4}))?$/.exec(
      value.trim(),
    );
  if (!m) return null;
  const [, d, mon, y, hh, mm, ss, tz] = m;
  const month = MONTHS[mon.toLowerCase()];
  if (month === undefined) return null;
  let ms = Date.UTC(Number(y), month, Number(d), Number(hh), Number(mm), Number(ss));
  if (tz) {
    // Offsets are the log's, so subtract to reach UTC.
    const sign = tz[0] === "-" ? -1 : 1;
    const offsetMin = Number(tz.slice(1, 3)) * 60 + Number(tz.slice(3, 5));
    ms -= sign * offsetMin * 60_000;
  }
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseIsoish(value: unknown): Date | null {
  if (typeof value === "number") {
    // Caddy writes a float epoch (seconds). Milliseconds would put us in 1970,
    // so anything below ~1e11 is treated as seconds.
    const ms = value < 1e11 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value.trim().replace(/\s+/, "T"));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function headerValue(headers: unknown, name: string): string {
  if (!headers || typeof headers !== "object") return "";
  const h = headers as Record<string, unknown>;
  const found =
    h[name] ??
    h[name.toLowerCase()] ??
    h[name.replace(/(^|-)([a-z])/g, (_, p, c) => p + c.toUpperCase())];
  if (Array.isArray(found)) return typeof found[0] === "string" ? found[0] : "";
  return typeof found === "string" ? found : "";
}

/** Strip the query string: it explodes path cardinality for no analytic gain. */
function normalizePath(raw: string): string {
  const path = (raw || "/").split(/[?#]/)[0] || "/";
  // Cap absurd paths so one hostile line cannot bloat the aggregates.
  return path.length > 300 ? `${path.slice(0, 300)}…` : path;
}

/** Host part only, for the Caddy `remote_addr` form `ip:port`. */
function normalizeIp(raw: string): string {
  const v = (raw || "").trim();
  if (!v) return "";
  // IPv6 in brackets, optionally with a port.
  const bracket = /^\[([^\]]+)\](?::\d+)?$/.exec(v);
  if (bracket) return bracket[1];
  // IPv4 with a port. A bare IPv6 has many colons and is left alone.
  const parts = v.split(":");
  if (parts.length === 2) return parts[0];
  return v;
}

/**
 * Parses one line. Returns null for blanks, comments, and anything that does not
 * match a supported format — the caller counts those as skipped.
 */
export function parseLogLine(line: string): LogRecord | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  if (trimmed.startsWith("{")) {
    let obj: unknown;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      return null;
    }
    if (!obj || typeof obj !== "object") return null;
    const o = obj as Record<string, unknown>;
    const req = (o.request ?? {}) as Record<string, unknown>;
    const ts = parseIsoish(o.ts ?? o.timestamp ?? o.time);
    if (!ts) return null;
    const status = Number(o.status ?? 0);
    const uri = req.uri ?? req.url ?? o.uri ?? "";
    return {
      ts,
      path: normalizePath(typeof uri === "string" ? uri : ""),
      status: Number.isFinite(status) ? status : 0,
      ua: headerValue(req.headers, "User-Agent"),
      ip: normalizeIp(
        typeof req.remote_ip === "string"
          ? req.remote_ip
          : typeof req.remote_addr === "string"
            ? req.remote_addr
            : typeof req.client_ip === "string"
              ? req.client_ip
              : "",
      ),
    };
  }

  const m = CLF_RE.exec(trimmed);
  if (!m) return null;
  const ts = parseClfTime(m[CLF_TIME]);
  if (!ts) return null;
  const status = Number(m[CLF_STATUS]);
  if (!Number.isFinite(status)) return null;
  return {
    ts,
    path: normalizePath(m[CLF_PATH]),
    status,
    ua: m[CLF_UA] ?? "",
    ip: normalizeIp(m[CLF_IP] ?? ""),
  };
}

// ─── Bot identification ─────────────────────────────────────────────────────
//
// Matched against the same BOT_CATALOG the access check uses, longest token
// first so `OAI-SearchBot` wins over a substring and `Applebot-Extended` is
// never reported from a bare `Applebot` hit (they are different things: the
// -Extended token is a robots.txt preference nothing crawls as, so a log line
// claiming it is not a real Applebot-Extended visit).

const CATALOG_TOKENS = BOT_CATALOG.map((b) => b.token).sort((a, b) => b.length - a.length);

/** Tokens that never appear in a real log line, because nothing fetches as them. */
const NON_FETCHING = new Set(["Google-Extended", "Applebot-Extended"]);

const FETCHING_TOKENS = CATALOG_TOKENS.filter((t) => !NON_FETCHING.has(t));

/** The catalog token this User-Agent belongs to, or null for a human/unknown. */
export function classifyBot(ua: string): string | null {
  const haystack = (ua ?? "").toLowerCase();
  if (!haystack) return null;
  for (const token of FETCHING_TOKENS) {
    if (haystack.includes(token.toLowerCase())) return token;
  }
  return null;
}

/** Bots whose identity we can check against published IP ranges. */
export const IP_VERIFIABLE_TOKENS = new Set(["Googlebot", "Bingbot"]);

// ─── Aggregation ────────────────────────────────────────────────────────────

export interface BotAggregate {
  token: string;
  total: number;
  /** Hits whose source IP fell inside the operator's published ranges. */
  verified: number;
  /** Hits we could not confirm (unverifiable bot, or ranges unavailable). */
  unverified: number;
  /** Whether verification is possible for this bot at all. */
  verifiable: boolean;
  firstSeen: string;
  lastSeen: string;
  topPaths: Array<{ path: string; hits: number }>;
  statusSplit: Record<string, number>;
}

export interface BotLogAggregates {
  /** Sorted YYYY-MM-DD keys present in the log. */
  days: string[];
  /** day → token → hits. Drives the stacked chart. */
  perDay: Record<string, Record<string, number>>;
  bots: BotAggregate[];
  totalBotHits: number;
  /** Parsed lines that were not one of our crawlers. Counted, never detailed. */
  otherHits: number;
  statusSplit: Record<string, number>;
  periodStart: string | null;
  periodEnd: string | null;
  linesParsed: number;
  linesSkipped: number;
  /** True when at least one bot could not be IP-verified. Drives the caveat. */
  hasUnverified: boolean;
}

/** Cap on distinct paths tracked per bot — a 50MB log can hold a lot of URLs. */
const MAX_PATHS_PER_BOT = 2_000;
const TOP_PATHS = 10;

export interface AggregateInput {
  records: LogRecord[];
  linesSkipped: number;
  /** Returns true when this IP is inside the token's published ranges, or null
   *  when verification was not possible (ranges unavailable / not verifiable). */
  verifyIp?: (token: string, ip: string) => boolean | null;
}

export function aggregate({
  records,
  linesSkipped,
  verifyIp,
}: AggregateInput): BotLogAggregates {
  const perDay: Record<string, Record<string, number>> = {};
  const statusSplit: Record<string, number> = {};
  const byBot = new Map<
    string,
    {
      total: number;
      verified: number;
      unverified: number;
      first: Date;
      last: Date;
      paths: Map<string, number>;
      status: Record<string, number>;
    }
  >();

  let totalBotHits = 0;
  let otherHits = 0;
  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;

  for (const r of records) {
    if (!periodStart || r.ts < periodStart) periodStart = r.ts;
    if (!periodEnd || r.ts > periodEnd) periodEnd = r.ts;

    const token = classifyBot(r.ua);
    if (!token) {
      otherHits++;
      continue;
    }

    totalBotHits++;
    const day = r.ts.toISOString().slice(0, 10);
    (perDay[day] ??= {})[token] = (perDay[day][token] ?? 0) + 1;

    const statusKey = String(r.status);
    statusSplit[statusKey] = (statusSplit[statusKey] ?? 0) + 1;

    let entry = byBot.get(token);
    if (!entry) {
      entry = {
        total: 0,
        verified: 0,
        unverified: 0,
        first: r.ts,
        last: r.ts,
        paths: new Map(),
        status: {},
      };
      byBot.set(token, entry);
    }
    entry.total++;
    if (r.ts < entry.first) entry.first = r.ts;
    if (r.ts > entry.last) entry.last = r.ts;
    entry.status[statusKey] = (entry.status[statusKey] ?? 0) + 1;

    // Path cardinality is bounded: past the cap we stop learning new paths but
    // keep counting the ones we already know, so the top-N stays meaningful.
    const seen = entry.paths.get(r.path);
    if (seen !== undefined) entry.paths.set(r.path, seen + 1);
    else if (entry.paths.size < MAX_PATHS_PER_BOT) entry.paths.set(r.path, 1);

    const verdict = verifyIp && r.ip ? verifyIp(token, r.ip) : null;
    if (verdict === true) entry.verified++;
    else entry.unverified++;
  }

  const bots: BotAggregate[] = [...byBot.entries()]
    .map(([token, e]) => ({
      token,
      total: e.total,
      verified: e.verified,
      unverified: e.unverified,
      verifiable: IP_VERIFIABLE_TOKENS.has(token),
      firstSeen: e.first.toISOString(),
      lastSeen: e.last.toISOString(),
      topPaths: [...e.paths.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, TOP_PATHS)
        .map(([path, hits]) => ({ path, hits })),
      statusSplit: e.status,
    }))
    .sort((a, b) => b.total - a.total || a.token.localeCompare(b.token));

  return {
    days: Object.keys(perDay).sort(),
    perDay,
    bots,
    totalBotHits,
    otherHits,
    statusSplit,
    periodStart: periodStart ? periodStart.toISOString() : null,
    periodEnd: periodEnd ? periodEnd.toISOString() : null,
    linesParsed: records.length,
    linesSkipped,
    hasUnverified: bots.some((b) => b.unverified > 0),
  };
}

/**
 * Parses a whole log body. Kept separate from aggregate() so a caller can stream
 * lines in without holding the text twice.
 */
export function parseLogText(
  text: string,
): { records: LogRecord[]; linesSkipped: number } {
  const records: LogRecord[] = [];
  let linesSkipped = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const rec = parseLogLine(line);
    if (rec) records.push(rec);
    else linesSkipped++;
  }
  return { records, linesSkipped };
}
