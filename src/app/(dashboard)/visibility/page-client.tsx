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
import { FirstAuditRunner } from "@/components/onboarding/first-audit-runner";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import { VisibilityReportButton } from "@/components/visibility/VisibilityReportButton";
import { MonitorCard } from "@/components/visibility/MonitorCard";
import { BenchmarkCard } from "@/components/visibility/BenchmarkCard";
import { AnswerTrackingCard } from "@/components/visibility/AnswerTrackingCard";
import { PromptTrends } from "@/components/visibility/prompt-trends";
import { VISIBILITY_COPY, type DashLocale, type VisibilityCopy } from "@/lib/i18n/dashboard";

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

// keys are API category strings — do not translate
const FIX_KEY: Record<string, keyof Remediation["artifacts"]> = {
  "Structured data (JSON-LD)": "schema_jsonld",
  "FAQ content + schema": "faq_html",
  "robots.txt": "robots_patch",
  "Meta description": "meta_description",
};

export function VisibilityPageClient({
  locale,
  onboarding = false,
}: {
  locale: DashLocale;
  onboarding?: boolean;
}) {
  const t = VISIBILITY_COPY[locale];
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
      if (!res.ok || data.error) throw new Error(data.error || t.requestFailed(res.status));
      setAudit(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.somethingWrong);
    } finally {
      setLoading(false);
    }
  }

  // Onboarding "explore your fix roadmap" marker: engaging with the fixes
  // card counts, whether it renders artifacts or the upgrade lock.
  function markRoadmapViewed() {
    fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "step_complete", step: "roadmap_viewed" }),
    }).catch(() => {});
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
        markRoadmapViewed();
        return;
      }
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || t.requestFailed(res.status));
      setRem(data.remediation as Remediation);
      markRoadmapViewed();
    } catch (e) {
      setRemError(e instanceof Error ? e.message : t.fixesFailed);
    } finally {
      setRemLoading(false);
    }
  }

  async function runAttribution() {
    if (!log.trim() || !deploy.trim()) {
      setAttrError(t.pasteLogAndDate);
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
      if (!res.ok || data.error) throw new Error(data.error || t.requestFailed(res.status));
      setAttr(data.attribution as AttributionResult);
    } catch (e) {
      setAttrError(e instanceof Error ? e.message : t.attrFailed);
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
            {t.title}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/visibility/keywords">
            <Button variant="outline">{t.keywordsLink}</Button>
          </a>
          <VisibilityReportButton />
          <VisibilityHelpButton locale={locale} />
        </div>
      </div>

      {/* First-audit auto-run banner (onboarding) */}
      <FirstAuditRunner
        locale={locale}
        triggered={onboarding}
        onResult={(data, target) => {
          setUrl(target);
          setAudit(data as AuditResult);
          setError(null);
        }}
      />

      {/* Onboarding checklist */}
      <OnboardingChecklist locale={locale} />

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
              placeholder={t.urlPlaceholder}
              className="pl-9"
            />
          </div>
          <Button onClick={runAudit} disabled={loading}>
            {loading ? t.auditing : t.runAudit}
          </Button>
        </CardContent>
      </Card>

      {/* Scheduled monitoring (GROWTH+) */}
      <MonitorCard locale={locale} suggestedUrl={audit && !loading && !error ? url : null} />

      {/* Answer tracking (AGENCY+). #prompts is the target of the SEO Tools
          "Custom Prompts" card, the onboarding "Add 3 tracked prompts" step,
          Brand Radar and the Keywords page. scroll-mt-20 (5rem) clears the
          sticky h-16 (4rem) header in layout/header.tsx — without it the
          browser scrolls the heading exactly under the header. */}
      <div id="prompts" className="scroll-mt-20">
        <AnswerTrackingCard locale={locale} />
      </div>
      <PromptTrends locale={locale} />

      {/* Competitor benchmark (GROWTH+) */}
      {audit && !loading && !error && (
        <BenchmarkCard
          locale={locale}
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
          <h3 className="text-base font-semibold text-gray-900">{t.auditFailed}</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
        </div>
      )}

      {/* Results */}
      {audit && !loading && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title={t.statScore}
              value={`${audit.score}/100`}
              icon={<Gauge className="h-5 w-5" />}
            />
            <StatCard
              title={t.statGrade}
              value={audit.grade}
              icon={<Sparkles className="h-5 w-5" />}
            />
            <StatCard
              title={t.statCrawlersOpen}
              value={`${botTotal - blockedCount}/${botTotal}`}
              changeType={blockedCount ? "negative" : "positive"}
              icon={<Bot className="h-5 w-5" />}
            />
            <StatCard
              title={t.statRendering}
              value={audit.rendering.likely_csr ? t.clientSide : t.serverSide}
              changeType={audit.rendering.likely_csr ? "negative" : "positive"}
              icon={<ServerCog className="h-5 w-5" />}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Reachability */}
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold text-gray-900">
                  {t.reachabilityTitle}
                </h3>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-gray-200">
                  {ENGINES.map((e) => {
                    const open = !e.tokens.some(
                      (tok) => audit.robots.bots[tok]?.status === "BLOCKED",
                    );
                    return (
                      <li
                        key={e.name}
                        className="flex items-center justify-between px-6 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">{e.name}</p>
                          <p className="text-xs text-gray-400">
                            {e.org === "open dataset" ? t.openDataset : e.org}
                          </p>
                        </div>
                        <Badge variant={open ? "success" : "danger"}>
                          {open ? t.openBadge : t.blockedBadge}
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
                <h3 className="text-base font-semibold text-gray-900">{t.checksTitle}</h3>
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
          <div id="fixes">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">{t.fixesTitle}</h3>
                {rem?.mock && (
                  <Badge variant="warning">{t.mockBadge}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!rem && !remLocked && (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-sm text-gray-500">
                    {t.fixesIntro}
                  </p>
                  <Button variant="outline" onClick={generateFixes} disabled={remLoading}>
                    {remLoading ? t.generating : t.generateFixes}
                  </Button>
                </div>
              )}

              {remError && <p className="text-sm text-red-500">{remError}</p>}

              {remLocked && (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
                  <Lock className="h-6 w-6 text-gray-400" />
                  <p className="max-w-md text-sm text-gray-500">
                    {t.lockedFixesA}
                    <span className="font-medium text-gray-700">Growth</span>
                    {t.lockedFixesB}
                  </p>
                  <a href="/billing">
                    <Button>{t.upgradePlan}</Button>
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
                  const label = key ? t.fixLabels[key] : cat;
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
                          {copiedKey === cat ? t.copied : t.copy}
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
          </div>

          {/* Attribution */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-gray-400" />
                <h3 className="text-base font-semibold text-gray-900">
                  {t.attrTitle}
                </h3>
                <Badge variant="info">Growth</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">
                {t.attrIntro}
              </p>
              <Textarea
                value={log}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setLog(e.target.value)}
                placeholder={t.logPlaceholder}
                rows={6}
                className="font-mono text-xs"
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  value={deploy}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDeploy(e.target.value)}
                  placeholder={t.deployPlaceholder}
                  className="sm:max-w-xs"
                />
                <Button variant="outline" onClick={runAttribution} disabled={attrLoading}>
                  {attrLoading ? t.measuring : t.measureImpact}
                </Button>
              </div>

              {attrError && <p className="text-sm text-red-500">{attrError}</p>}

              {attrLocked && (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
                  <Lock className="h-6 w-6 text-gray-400" />
                  <p className="max-w-md text-sm text-gray-500">
                    {t.lockedAttr}
                  </p>
                  <a href="/billing">
                    <Button>{t.upgradePlan}</Button>
                  </a>
                </div>
              )}

              {attr && <AttributionTables data={attr} copy={t} />}
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

function fmtDelta(p: number | string | null, copy: VisibilityCopy): string {
  if (p === null || p === undefined) return copy.deltaNa;
  if (p === "Infinity" || p === Infinity) return copy.deltaNew;
  if (typeof p === "string") return p;
  return `${p > 0 ? "+" : ""}${Math.round(p)}%`;
}

function DeltaTable({
  rows,
  totalB,
  totalA,
  totalD,
  copy,
}: {
  rows: [string, EngineDelta][];
  totalB: number;
  totalA: number;
  totalD: number | string | null;
  copy: VisibilityCopy;
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
              {fmtDelta(d.delta_pct, copy)}
            </td>
          </tr>
        ))}
        <tr className="border-t border-gray-200">
          <td className="py-1.5 text-gray-500">{copy.totalRow}</td>
          <td className="py-1.5 text-gray-500">
            {totalB} → {totalA}
          </td>
          <td className="py-1.5 text-right font-medium text-green-600">
            {fmtDelta(totalD, copy)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function AttributionTables({ data, copy }: { data: AttributionResult; copy: VisibilityCopy }) {
  const cr = Object.entries(data.crawlers.by_engine);
  const rf = Object.entries(data.referrals.by_engine);
  return (
    <div className="space-y-5 pt-2">
      <p className="text-xs text-gray-400">
        {copy.deploySummary(
          data.deploy,
          data.window.days_before,
          data.window.days_after,
          data._parsed ?? 0,
        )}
      </p>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          {copy.crawlerActivity}
        </p>
        <DeltaTable
          rows={cr}
          totalB={data.crawlers.total_before_per_day}
          totalA={data.crawlers.total_after_per_day}
          totalD={data.crawlers.total_delta_pct}
          copy={copy}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          {copy.referralTraffic}
        </p>
        {rf.length === 0 ? (
          <p className="text-xs text-gray-400">
            {copy.noneDetected}
          </p>
        ) : (
          <DeltaTable
            rows={rf}
            totalB={data.referrals.total_before_per_day}
            totalA={data.referrals.total_after_per_day}
            totalD={data.referrals.total_delta_pct}
            copy={copy}
          />
        )}
      </div>

      {data._caveats && data._caveats.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {copy.caveatsTitle}
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
