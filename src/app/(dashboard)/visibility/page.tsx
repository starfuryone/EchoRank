"use client";

import { useState, type ChangeEvent, type KeyboardEvent } from "react";
import {
  Search,
  Gauge,
  Bot,
  ServerCog,
  Copy,
  Lock,
  Sparkles,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VisibilityHelpButton } from "@/components/help/VisibilityHelpButton";
import { VisibilityReportButton } from "@/components/visibility/VisibilityReportButton";
import { MonitorCard } from "@/components/visibility/MonitorCard";
import { BenchmarkCard } from "@/components/visibility/BenchmarkCard";
import { AnswerTrackingCard } from "@/components/visibility/AnswerTrackingCard";
import { PromptTrends } from "@/components/visibility/prompt-trends";

// ─── Types (the sidecar's serialized audit shape) ───────────────────────────
interface Check {
  category: string;
  points: number;
  max: number;
  status: string;
  recommendation: string;
}
interface BotState {
  status: "ALLOWED" | "BLOCKED";
  detail: string;
}
interface AuditResult {
  url: string;
  score: number;
  grade: string;
  checks: Check[];
  robots: { present: boolean; sitemaps: string[]; bots: Record<string, BotState> };
  jsonld: { types: string[]; blocks: number; errors: number };
  rendering: { likely_csr: boolean; text_len: number; framework: string | null };
  llms_txt: boolean;
  error?: string;
}
interface Remediation {
  artifacts: {
    schema_jsonld: string | null;
    faq_html: string | null;
    faq_markdown: string | null;
    robots_patch: string | null;
    meta_description: string | null;
  };
  fix_index: [string, string, string][];
  blocked_bots: string[];
  mock: boolean;
}

// engine → the robots tokens that gate it (matches the auditor)
const ENGINES: { name: string; org: string; tokens: string[] }[] = [
  { name: "ChatGPT", org: "OpenAI", tokens: ["GPTBot", "OAI-SearchBot"] },
  { name: "Claude", org: "Anthropic", tokens: ["ClaudeBot", "anthropic-ai"] },
  { name: "Perplexity", org: "Perplexity", tokens: ["PerplexityBot"] },
  { name: "Gemini", org: "Google", tokens: ["Google-Extended"] },
  { name: "Apple Intelligence", org: "Apple", tokens: ["Applebot-Extended"] },
  { name: "Common Crawl", org: "open dataset", tokens: ["CCBot"] },
  { name: "Meta AI", org: "Meta", tokens: ["meta-externalagent"] },
];

const FIX_LABEL: Record<string, string> = {
  schema_jsonld: "Schema markup (JSON-LD)",
  faq_html: "FAQ content (visible HTML)",
  robots_patch: "robots.txt patch",
  meta_description: "Meta description",
};
const FIX_KEY: Record<string, keyof Remediation["artifacts"]> = {
  "Structured data (JSON-LD)": "schema_jsonld",
  "FAQ content + schema": "faq_html",
  "robots.txt": "robots_patch",
  "Meta description": "meta_description",
};

function gradeColor(score: number) {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-amber-500";
  return "text-red-500";
}

export default function VisibilityPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditResult | null>(null);

  const [rem, setRem] = useState<Remediation | null>(null);
  const [remLoading, setRemLoading] = useState(false);
  const [remLocked, setRemLocked] = useState(false);
  const [remError, setRemError] = useState<string | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // attribution
  const [log, setLog] = useState("");
  const [deploy, setDeploy] = useState("");
  const [attrLoading, setAttrLoading] = useState(false);
  const [attrLocked, setAttrLocked] = useState(false);
  const [attrError, setAttrError] = useState<string | null>(null);
  const [attr, setAttr] = useState<AttributionResult | null>(null);

  async function runAudit() {
    const v = url.trim();
    if (!v) return;
    setLoading(true);
    setError(null);
    setAudit(null);
    setRem(null);
    setRemLocked(false);
    setRemError(null);
    try {
      const res = await fetch("/api/ai/visibility/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: v, crawl: true }),
      });
      const data: AuditResult = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);
      setAudit(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function generateFixes() {
    if (!audit) return;
    setRemLoading(true);
    setRemLocked(false);
    setRemError(null);
    setRem(null);
    try {
      const res = await fetch("/api/ai/visibility/remediate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: audit.url, crawl: true }),
      });
      if (res.status === 403) {
        setRemLocked(true);
        return;
      }
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);
      setRem(data.remediation as Remediation);
    } catch (e) {
      setRemError(e instanceof Error ? e.message : "Could not generate fixes");
    } finally {
      setRemLoading(false);
    }
  }

  async function runAttribution() {
    if (!log.trim() || !deploy.trim()) {
      setAttrError("Paste an access log and a deploy date.");
      return;
    }
    setAttrLoading(true);
    setAttrLocked(false);
    setAttrError(null);
    setAttr(null);
    try {
      const res = await fetch("/api/ai/visibility/attribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log, deploy }),
      });
      if (res.status === 403) {
        setAttrLocked(true);
        return;
      }
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);
      setAttr(data.attribution as AttributionResult);
    } catch (e) {
      setAttrError(e instanceof Error ? e.message : "Could not measure impact");
    } finally {
      setAttrLoading(false);
    }
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }

  const blockedCount = audit
    ? Object.values(audit.robots.bots).filter((b) => b.status === "BLOCKED").length
    : 0;
  const botTotal = audit ? Object.keys(audit.robots.bots).length : 0;

  return (
    <div className="space-y-6">

      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
            AI Visibility
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Can AI answer engines find, crawl, and cite your site?
          </p>
        </div>
        <div className="flex items-center gap-3">
          <VisibilityReportButton />
          <VisibilityHelpButton />
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={url}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") runAudit();
              }}
              placeholder="example.com"
              className="pl-9"
            />
          </div>
          <Button onClick={runAudit} disabled={loading}>
            {loading ? "Auditing…" : "Run audit"}
          </Button>
        </CardContent>
      </Card>

      {/* Scheduled monitoring (GROWTH+) */}
      <MonitorCard suggestedUrl={audit && !loading && !error ? url : null} />

      {/* Answer tracking (AGENCY+) */}
      <AnswerTrackingCard />
      <PromptTrends />

      {/* Competitor benchmark (GROWTH+) */}
      {audit && !loading && !error && (
        <BenchmarkCard
          yourUrl={url}
          yourScore={audit.score}
          yourBlocked={blockedCount}
          botTotal={botTotal}
        />
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-xl bg-gray-200" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
          <h3 className="text-base font-semibold text-gray-900">Audit failed</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
        </div>
      )}

      {/* Results */}
      {audit && !loading && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Visibility Score"
              value={`${audit.score}/100`}
              icon={<Gauge className="h-5 w-5" />}
            />
            <StatCard
              title="Grade"
              value={audit.grade}
              icon={<Sparkles className="h-5 w-5" />}
            />
            <StatCard
              title="AI Crawlers Open"
              value={`${botTotal - blockedCount}/${botTotal}`}
              changeType={blockedCount ? "negative" : "positive"}
              icon={<Bot className="h-5 w-5" />}
            />
            <StatCard
              title="Rendering"
              value={audit.rendering.likely_csr ? "Client-side" : "Server-side"}
              changeType={audit.rendering.likely_csr ? "negative" : "positive"}
              icon={<ServerCog className="h-5 w-5" />}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Reachability */}
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-gray-900">
                  Answer-engine reachability
                </h3>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-gray-200">
                  {ENGINES.map((e) => {
                    const open = !e.tokens.some(
                      (t) => audit.robots.bots[t]?.status === "BLOCKED",
                    );
                    return (
                      <li
                        key={e.name}
                        className="flex items-center justify-between px-6 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">{e.name}</p>
                          <p className="text-xs text-gray-400">{e.org}</p>
                        </div>
                        <Badge variant={open ? "success" : "danger"}>
                          {open ? "OPEN" : "BLOCKED"}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>

            {/* Scored checks */}
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-gray-900">Scored checks</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                {audit.checks.map((c) => {
                  const ratio = c.max ? c.points / c.max : 0;
                  const bar =
                    ratio >= 0.999 ? "bg-green-500" : ratio > 0 ? "bg-amber-500" : "bg-red-500";
                  return (
                    <div key={c.category}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-medium text-gray-800">
                          {c.category}
                        </span>
                        <span className="text-xs text-gray-500">
                          {c.points}/{c.max}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded bg-gray-100">
                        <div
                          className={`h-full rounded ${bar}`}
                          style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-400">{c.status}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Fixes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Generated fixes</h3>
                {rem?.mock && (
                  <Badge variant="warning">mock copy — set ANTHROPIC_API_KEY</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!rem && !remLocked && (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-sm text-gray-500">
                    Turn the findings into paste-ready artifacts: schema markup, FAQ
                    content, and a robots.txt patch, written from your live page.
                  </p>
                  <Button variant="outline" onClick={generateFixes} disabled={remLoading}>
                    {remLoading ? "Generating…" : "Generate fixes"}
                  </Button>
                </div>
              )}

              {remError && <p className="text-sm text-red-500">{remError}</p>}

              {remLocked && (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
                  <Lock className="h-6 w-6 text-gray-400" />
                  <p className="max-w-md text-sm text-gray-500">
                    AI-written schema, FAQ, and metadata are a{" "}
                    <span className="font-medium text-gray-700">Growth</span> feature.
                    Upgrade your plan to generate paste-ready fixes grounded in your page.
                  </p>
                  <a href="/billing">
                    <Button>Upgrade plan</Button>
                  </a>
                </div>
              )}

              {rem &&
                rem.fix_index.map(([cat, note, fname]) => {
                  const key = FIX_KEY[cat];
                  const content = key ? rem.artifacts[key] : null;
                  if (!content) return null;
                  const display =
                    key === "meta_description"
                      ? `<meta name="description" content="${content.replace(/"/g, "&quot;")}">`
                      : content;
                  const label = key ? FIX_LABEL[key] : cat;
                  return (
                    <div key={cat} className="overflow-hidden rounded-lg border border-gray-200">
                      <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                        <span className="text-sm font-semibold text-gray-800">{label}</span>
                        <span className="ml-auto text-xs text-gray-400">{fname}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copy(cat, display)}
                        >
                          <Copy className="mr-1.5 h-3.5 w-3.5" />
                          {copiedKey === cat ? "Copied" : "Copy"}
                        </Button>
                      </div>
                      <p className="px-4 pt-3 text-xs text-gray-500">{note}</p>
                      <pre className="m-4 max-h-72 overflow-auto rounded-md bg-gray-900 p-3 text-xs leading-relaxed text-gray-100">
                        <code>{display}</code>
                      </pre>
                    </div>
                  );
                })}
            </CardContent>
          </Card>

          {/* Attribution */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-gray-400" />
                <h3 className="text-base font-semibold text-gray-900">
                  AI impact — prove the fix paid off
                </h3>
                <Badge variant="info">Growth</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">
                Paste a web-server access log and the date you deployed fixes.
                Measures AI crawler hits and AI referral traffic, before vs after.
              </p>
              <Textarea
                value={log}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setLog(e.target.value)}
                placeholder={`1.2.3.4 - - [02/Jun/2026:10:00:00 +0000] "GET /about HTTP/1.1" 200 1200 "-" "GPTBot/1.0"\n... or Caddy JSON lines`}
                rows={6}
                className="font-mono text-xs"
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  value={deploy}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDeploy(e.target.value)}
                  placeholder="Deploy date, e.g. 2026-06-01"
                  className="sm:max-w-xs"
                />
                <Button variant="outline" onClick={runAttribution} disabled={attrLoading}>
                  {attrLoading ? "Measuring…" : "Measure AI impact"}
                </Button>
              </div>

              {attrError && <p className="text-sm text-red-500">{attrError}</p>}

              {attrLocked && (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
                  <Lock className="h-6 w-6 text-gray-400" />
                  <p className="max-w-md text-sm text-gray-500">
                    ROI attribution is a Growth feature. Upgrade to connect your access
                    logs and prove the fixes drove AI crawlers and referrals.
                  </p>
                  <a href="/billing">
                    <Button>Upgrade plan</Button>
                  </a>
                </div>
              )}

              {attr && <AttributionTables data={attr} />}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Attribution rendering ──────────────────────────────────────────────────
interface EngineDelta {
  before_per_day: number;
  after_per_day: number;
  delta_pct: number | string | null;
}
interface AttributionResult {
  deploy: string;
  window: { days_before: number; days_after: number };
  crawlers: {
    by_engine: Record<string, EngineDelta>;
    total_before_per_day: number;
    total_after_per_day: number;
    total_delta_pct: number | string | null;
  };
  referrals: {
    by_engine: Record<string, EngineDelta>;
    total_before_per_day: number;
    total_after_per_day: number;
    total_delta_pct: number | string | null;
  };
  _caveats?: string[];
  _parsed?: number;
}

function fmtDelta(p: number | string | null): string {
  if (p === null || p === undefined) return "n/a";
  if (p === "Infinity" || p === Infinity) return "new";
  if (typeof p === "string") return p;
  return `${p > 0 ? "+" : ""}${Math.round(p)}%`;
}

function DeltaTable({
  rows,
  totalB,
  totalA,
  totalD,
}: {
  rows: [string, EngineDelta][];
  totalB: number;
  totalA: number;
  totalD: number | string | null;
}) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([eng, d]) => (
          <tr key={eng} className="border-b border-gray-100">
            <td className="py-1.5 text-gray-700">{eng}</td>
            <td className="py-1.5 text-gray-500">
              {d.before_per_day} → {d.after_per_day}
            </td>
            <td className="py-1.5 text-right font-medium text-green-600">
              {fmtDelta(d.delta_pct)}
            </td>
          </tr>
        ))}
        <tr className="border-t border-gray-200">
          <td className="py-1.5 text-gray-500">TOTAL</td>
          <td className="py-1.5 text-gray-500">
            {totalB} → {totalA}
          </td>
          <td className="py-1.5 text-right font-medium text-green-600">
            {fmtDelta(totalD)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function AttributionTables({ data }: { data: AttributionResult }) {
  const cr = Object.entries(data.crawlers.by_engine);
  const rf = Object.entries(data.referrals.by_engine);
  return (
    <div className="space-y-5 pt-2">
      <p className="text-xs text-gray-400">
        Deploy {data.deploy} · {data.window.days_before}d before vs{" "}
        {data.window.days_after}d after · parsed {data._parsed ?? 0} lines
      </p>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          AI crawler activity (hits/day)
        </p>
        <DeltaTable
          rows={cr}
          totalB={data.crawlers.total_before_per_day}
          totalA={data.crawlers.total_after_per_day}
          totalD={data.crawlers.total_delta_pct}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          AI referral traffic (views/day)
        </p>
        {rf.length === 0 ? (
          <p className="text-xs text-gray-400">
            none detected (many AI surfaces send no Referer — see caveats)
          </p>
        ) : (
          <DeltaTable
            rows={rf}
            totalB={data.referrals.total_before_per_day}
            totalA={data.referrals.total_after_per_day}
            totalD={data.referrals.total_delta_pct}
          />
        )}
      </div>

      {data._caveats && data._caveats.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Caveats
          </p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-gray-400">
            {data._caveats.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
