"use client";

// Crawl configuration (Phase 4a): the collapsible section of the start card.
//
// Holds a draft as form strings and reports a CrawlConfigInput upward on every
// change. Saved secrets are never in the draft: the site's defaults come back
// as { set: true }, the field stays blank with a "saved" placeholder, and a
// blank field is sent as { keep: true } so the server reuses the stored value.
//
// The site panel (verification, saved defaults) and the robots.txt tester
// load for the host of the start URL, once the section is open.

import type { SiteCrawler4dCopy } from "@/lib/i18n/site-crawler-4d";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SiteCrawlerCopy } from "@/lib/i18n/dashboard";
import { flag } from "@/lib/flags";
import { ExtractorsEditor, SearchesEditor, SegmentsEditor } from "./site-crawler-config-4b";
import { JsSnippetsEditor } from "./site-crawler-js";
import { LoginEditor } from "./site-crawler-login";
import type { SiteCrawler4eCopy } from "@/lib/i18n/site-crawler-4e";
import type { SiteCrawler4gCopy } from "@/lib/i18n/site-crawler-4g";
import type { JsSnippet } from "@/lib/site-crawler/js-snippets";
import {
  CONFIG_LIMITS,
  type ConfigProblem,
  type CrawlConfigInput,
  type CrawlConfigView,
  type CustomSearch,
  type Extractor,
  type QueryMode,
  type UserAgentChoice,
} from "@/lib/site-crawler/crawl-config";

type T = SiteCrawlerCopy["p4a"];
type T4b = SiteCrawlerCopy["p4b"];

/** Phase 4b plan caps, from the live quota. */
export interface FeatureCaps {
  extractors: number;
  searches: number;
  segments: number;
  /** Phase 4e: custom JavaScript snippets per crawl. */
  js?: number;
}

export interface SiteInfo {
  host: string;
  verified: boolean;
  verifyMethod: string | null;
  metaTag: string;
  dnsRecord: string;
  defaults: CrawlConfigView | null;
}

interface Draft {
  maxUrls: string;
  maxDepth: string;
  include: string;
  exclude: string;
  crawlSubdomains: boolean;
  followNofollow: boolean;
  queryStrings: QueryMode;
  stripParams: string;
  speed: string;
  userAgent: UserAgentChoice;
  customUserAgent: string;
  headers: { name: string; value: string; saved: boolean }[];
  cookies: string;
  cookiesSaved: boolean;
  basicUser: string;
  basicPassword: string;
  basicSaved: boolean;
  respectRobots: boolean;
  customRobots: string;
  /** Phase 4b. */
  extractors: Extractor[];
  searches: CustomSearch[];
  /** Phase 4e. */
  js: JsSnippet[];
  useLogin: boolean;
}

const EMPTY: Draft = {
  maxUrls: "",
  maxDepth: "",
  include: "",
  exclude: "",
  crawlSubdomains: true,
  followNofollow: false,
  queryStrings: "keep",
  stripParams: "",
  speed: "2",
  userAgent: "echorank",
  customUserAgent: "",
  headers: [],
  cookies: "",
  cookiesSaved: false,
  basicUser: "",
  basicPassword: "",
  basicSaved: false,
  respectRobots: true,
  customRobots: "",
  extractors: [],
  searches: [],
  js: [],
  useLogin: false,
};

const lines = (s: string) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const num = (s: string) => (s.trim() === "" ? null : Number(s));

function fromView(v: CrawlConfigView): Draft {
  return {
    maxUrls: v.maxUrls === null ? "" : String(v.maxUrls),
    maxDepth: v.maxDepth === null ? "" : String(v.maxDepth),
    include: v.include.join("\n"),
    exclude: v.exclude.join("\n"),
    crawlSubdomains: v.crawlSubdomains,
    followNofollow: v.followNofollow,
    queryStrings: v.queryStrings,
    stripParams: v.stripParams.join(", "),
    speed: String(v.speed),
    userAgent: v.userAgent,
    customUserAgent: v.customUserAgent ?? "",
    headers: v.headers.map((h) => ({ name: h.name, value: "", saved: true })),
    cookies: "",
    cookiesSaved: Boolean(v.cookies),
    basicUser: v.basicAuth?.user ?? "",
    basicPassword: "",
    basicSaved: Boolean(v.basicAuth),
    respectRobots: v.respectRobots,
    customRobots: v.customRobots ?? "",
    extractors: v.extractors ?? [],
    searches: v.searches ?? [],
    js: v.js ?? [],
    useLogin: false,
  };
}

/** The draft as the API takes it. Blank + saved = keep the stored secret. */
export function toInput(d: Draft): CrawlConfigInput {
  const secret = (value: string, saved: boolean) => (value ? value : saved ? ({ keep: true } as const) : null);
  return {
    maxUrls: num(d.maxUrls),
    maxDepth: num(d.maxDepth),
    include: lines(d.include),
    exclude: lines(d.exclude),
    crawlSubdomains: d.crawlSubdomains,
    followNofollow: d.followNofollow,
    queryStrings: d.queryStrings,
    stripParams: d.stripParams.split(",").map((p) => p.trim()).filter(Boolean),
    speed: Number(d.speed),
    userAgent: d.userAgent,
    customUserAgent: d.userAgent === "custom" ? d.customUserAgent.trim() || null : null,
    headers: d.headers
      .filter((h) => h.name.trim() && (h.value || h.saved))
      .map((h) => ({ name: h.name.trim(), value: secret(h.value, h.saved) ?? "" })),
    cookies: secret(d.cookies, d.cookiesSaved),
    basicAuth: d.basicUser.trim() ? { user: d.basicUser.trim(), password: secret(d.basicPassword, d.basicSaved) ?? "" } : null,
    respectRobots: d.respectRobots,
    customRobots: d.customRobots.trim() ? d.customRobots : null,
    extractors: d.extractors,
    searches: d.searches,
    js: d.js,
    useLogin: d.useLogin,
  };
}

/** One server-side problem as a sentence. */
export function problemText(p: ConfigProblem, t: T, t4b: T4b, t4d?: SiteCrawler4dCopy, t4e?: SiteCrawler4eCopy, t4g?: SiteCrawler4gCopy): string {
  // Phase 4g: URL Inspection.
  if (p.field === "inspection") {
    if (p.code === "gsc_not_covering") return t4g?.problemInsGsc ?? t.problemVerified(p.field);
    if (p.code === "over_plan_cap" && t4d) return t4d.problemCap(String(p.limit));
    if (p.code === "unknown_segment" && t4d) return t4d.problemSegment;
  }
  // Phase 4g: semantic duplicates.
  if (p.field === "semantic") {
    if (p.code === "ai_key_missing") return t4g?.problemSemKey ?? t.problemVerified(p.field);
    if (p.code === "over_plan_cap" && t4d) return t4d.problemCap(String(p.limit));
    if (p.code === "unknown_segment" && t4d) return t4d.problemSegment;
  }
  // Phase 4e: forms login.
  if (p.code === "login_missing") return t4e?.problemLoginMissing ?? t.problemVerified(p.field);
  if (p.code === "requires_verified_site" && p.field === "login" && t4e) return `${t4e.loginTitle}: ${t4e.loginVerifiedOnly}`;
  // Phase 4e: AI prompts.
  if (p.code === "ai_key_missing") return t4e?.problemAiKey(p.provider === "openai" ? "OpenAI" : "Gemini") ?? t.problemVerified(p.field);
  if (p.code === "ai_unavailable") return t4e?.problemAiUnavailable ?? t.problemVerified(p.field);
  if (p.code === "invalid_prompt") return t4e?.problemAiPrompt(String(p.index + 1)) ?? t4b.problemExtractor(String(p.index + 1));
  if (p.code === "unknown_segment" && p.field === "ai" && t4d) return t4d.problemSegment;
  if (p.code === "over_plan_cap" && p.field === "ai" && t4d) return t4d.problemCap(String(p.limit));
  // Phase 4e: custom JavaScript.
  if (p.code === "requires_render") return t4e?.problemRender ?? t.problemVerified(p.field);
  if (p.code === "invalid_snippet") return t4e?.problemSnippet(String(p.index + 1)) ?? t4b.problemExtractor(String(p.index + 1));
  if (p.code === "requires_verified_site" && p.field === "js" && t4e) return `${t4e.jsTitle}: ${t4e.jsVerifiedOnly}`;
  // Phase 4d: the Add data opt-ins.
  if (p.code === "unknown_segment") return t4d?.problemSegment ?? t4b.problemCap("0");
  if (p.code === "over_plan_cap" && p.field.startsWith("addData.") && t4d) return t4d.problemCap(String(p.limit));
  if (p.code === "over_plan_cap") return t4b.problemCap(String(p.limit));
  if (p.code === "invalid_expression") {
    return p.field === "searches" ? t4b.problemSearch(String(p.index + 1)) : t4b.problemExtractor(String(p.index + 1));
  }
  if (p.code === "requires_verified_site") return t.problemVerified(p.field);
  if (p.code === "invalid_pattern") return t.problemPattern(p.pattern);
  if (p.code === "reserved_header") return t.problemHeader(p.name);
  return t.problemCustomUa;
}

function hostOf(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-gray-700">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function Toggle({ id, label, checked, disabled, onChange, note }: { id: string; label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; note?: string }) {
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-sm text-gray-700">
        <input id={id} type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      {note && <p className="ml-6 text-xs text-gray-500">{note}</p>}
    </div>
  );
}

function CopyLine({ value, t }: { value: string; t: T }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded bg-gray-50 px-2 py-1 text-xs text-gray-700" title={value}>
        {value}
      </code>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => setDone(true));
        }}
      >
        {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        {done ? t.copied : t.copy}
      </button>
    </div>
  );
}

export function CrawlConfigSection({
  t,
  t4b,
  t4e,
  renders = false,
  caps,
  rootUrl,
  urlCap,
  disabled,
  onChange,
  children,
}: {
  t: T;
  t4b: T4b;
  /** Phase 4e copy; its editors render only when given. */
  t4e?: SiteCrawler4eCopy;
  /** Phase 4e: the crawl will render pages (custom JavaScript needs it). */
  renders?: boolean;
  caps: FeatureCaps;
  rootUrl: string;
  urlCap: string;
  disabled: boolean;
  onChange: (next: { config: CrawlConfigInput | null; saveAsDefault: boolean }) => void;
  /** Phase 4c: the "Run this crawl on a schedule" block, inside the section. */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [dirty, setDirty] = useState(false);
  // Read by the site fetch without re-running it when the form is touched.
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [site, setSite] = useState<SiteInfo | null>(null);
  const [checking, setChecking] = useState<"idle" | "checking" | "failed">("idle");
  const host = hostOf(rootUrl);

  // The site panel follows the start URL's host, once the section is open.
  useEffect(() => {
    if (!open || !host) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const res = await fetch(`/api/seo/v1/crawl/sites?host=${encodeURIComponent(host)}`).catch(() => null);
        const data: SiteInfo | null = res?.ok ? await res.json().catch(() => null) : null;
        if (cancelled || !data) return;
        setSite(data);
        setChecking("idle");
        // Saved defaults fill an untouched form.
        if (data.defaults && !dirtyRef.current) {
          setDraft(fromView(data.defaults));
          setDirty(true);
        }
      })();
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, host]);

  useEffect(() => {
    onChange({ config: dirty ? toInput(draft) : null, saveAsDefault: dirty && saveAsDefault });
  }, [draft, dirty, saveAsDefault, onChange]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  };
  const verified = Boolean(site?.verified);

  async function verify() {
    if (!host) return;
    setChecking("checking");
    const res = await fetch("/api/seo/v1/crawl/sites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ host }),
    }).catch(() => null);
    const data: SiteInfo | null = res?.ok ? await res.json().catch(() => null) : null;
    if (data) setSite(data);
    setChecking(data?.verified ? "idle" : "failed");
  }

  const method = (m: string | null) => (m === "gsc" ? t.methodGsc : m === "dns" ? t.methodDns : t.methodMeta);

  return (
    <details
      className="mt-4 rounded-lg border border-gray-200 bg-white"
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-900">{t.configTitle}</summary>
      <fieldset disabled={disabled} className="space-y-5 border-t border-gray-100 px-4 py-4">
        <p className="text-xs text-gray-500">{t.configHelp}</p>

        {site && (
          <div className="rounded-lg bg-gray-50 p-3 text-sm">
            <p className="font-medium text-gray-900">
              {t.verifyTitle(site.host)} ·{" "}
              <span className={verified ? "text-green-700" : "text-gray-600"}>
                {verified ? t.verified(method(site.verifyMethod)) : t.notVerified}
              </span>
            </p>
            {!verified && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-gray-600">{t.verifyHelp}</p>
                <p className="text-xs font-medium text-gray-700">{t.verifyMeta}</p>
                <CopyLine value={site.metaTag} t={t} />
                <p className="text-xs font-medium text-gray-700">{t.verifyDns}</p>
                <CopyLine value={site.dnsRecord} t={t} />
                <div className="flex items-center gap-3">
                  <Button type="button" size="sm" variant="outline" onClick={verify} disabled={checking === "checking"}>
                    {checking === "checking" ? t.verifyChecking : t.verifyCheck}
                  </Button>
                  {checking === "failed" && <span className="text-xs text-gray-500">{t.verifyFailed}</span>}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.maxUrls} hint={t.maxUrlsHint(urlCap)} htmlFor="cfg-max-urls">
            <Input id="cfg-max-urls" inputMode="numeric" value={draft.maxUrls} onChange={(e) => set("maxUrls", e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label={t.maxDepth} hint={t.maxDepthHint} htmlFor="cfg-max-depth">
            <Input id="cfg-max-depth" inputMode="numeric" value={draft.maxDepth} onChange={(e) => set("maxDepth", e.target.value.replace(/\D/g, "").slice(0, 3))} />
          </Field>
          <Field label={t.include} hint={t.patternsHint} htmlFor="cfg-include">
            <textarea id="cfg-include" rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs" value={draft.include} onChange={(e) => set("include", e.target.value)} />
          </Field>
          <Field label={t.exclude} hint={t.patternsHint} htmlFor="cfg-exclude">
            <textarea id="cfg-exclude" rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs" value={draft.exclude} onChange={(e) => set("exclude", e.target.value)} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Toggle id="cfg-subdomains" label={t.subdomains} checked={draft.crawlSubdomains} onChange={(v) => set("crawlSubdomains", v)} />
          <Toggle id="cfg-nofollow" label={t.followNofollow} checked={draft.followNofollow} onChange={(v) => set("followNofollow", v)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Select
              id="cfg-query"
              label={t.queryLabel}
              value={draft.queryStrings}
              onChange={(e) => set("queryStrings", e.target.value as QueryMode)}
              options={[
                { value: "keep", label: t.queryKeep },
                { value: "strip_all", label: t.queryStripAll },
                { value: "strip_listed", label: t.queryStripListed },
              ]}
            />
            {draft.queryStrings === "strip_listed" && (
              <Input aria-label={t.stripParams} placeholder={t.stripParams} value={draft.stripParams} onChange={(e) => set("stripParams", e.target.value)} />
            )}
          </div>
          <Select
            id="cfg-speed"
            label={t.speed}
            value={draft.speed}
            onChange={(e) => set("speed", e.target.value)}
            options={["2", "1.5", "1", "0.5"].map((v) => ({ value: v, label: t.speedValue(v) }))}
          />
          <div className="space-y-2">
            <Select
              id="cfg-ua"
              label={t.uaLabel}
              value={draft.userAgent}
              onChange={(e) => set("userAgent", e.target.value as UserAgentChoice)}
              disabled={!verified}
              options={[
                { value: "echorank", label: t.uaEchorank },
                { value: "googlebot_smartphone", label: t.uaGoogleSmart },
                { value: "googlebot_desktop", label: t.uaGoogleDesktop },
                { value: "custom", label: t.uaCustom },
              ]}
            />
            {!verified && <p className="text-xs text-gray-500">{t.verifiedOnly}</p>}
            {draft.userAgent === "custom" && (
              <Input aria-label={t.customUa} placeholder={t.customUa} maxLength={CONFIG_LIMITS.customUaChars} value={draft.customUserAgent} onChange={(e) => set("customUserAgent", e.target.value)} />
            )}
          </div>
          <Toggle
            id="cfg-robots"
            label={t.respectRobots}
            checked={draft.respectRobots}
            disabled={!verified}
            onChange={(v) => set("respectRobots", v)}
            note={verified ? undefined : t.verifiedOnly}
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-700">{t.headersLabel}</p>
          {draft.headers.map((h, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <Input
                aria-label={t.headerName}
                placeholder={t.headerName}
                className="w-40"
                value={h.name}
                onChange={(e) => set("headers", draft.headers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <Input
                aria-label={t.headerValue}
                placeholder={h.saved ? t.secretSaved : t.headerValue}
                className="min-w-0 flex-1"
                type="password"
                autoComplete="off"
                value={h.value}
                onChange={(e) => set("headers", draft.headers.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
              />
              <button type="button" aria-label={t.removeHeader} className="text-gray-400 hover:text-gray-700" onClick={() => set("headers", draft.headers.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
          {draft.headers.length < CONFIG_LIMITS.headers && (
            <Button type="button" size="sm" variant="outline" onClick={() => set("headers", [...draft.headers, { name: "", value: "", saved: false }])}>
              <Plus className="h-4 w-4" aria-hidden="true" /> {t.addHeader}
            </Button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t.cookies} htmlFor="cfg-cookies">
            <Input id="cfg-cookies" type="password" autoComplete="off" placeholder={draft.cookiesSaved ? t.secretSaved : ""} value={draft.cookies} onChange={(e) => set("cookies", e.target.value)} />
          </Field>
          <Field label={t.basicUser} htmlFor="cfg-basic-user">
            <Input id="cfg-basic-user" autoComplete="off" value={draft.basicUser} onChange={(e) => set("basicUser", e.target.value)} />
          </Field>
          <Field label={t.basicPassword} htmlFor="cfg-basic-pw">
            <Input id="cfg-basic-pw" type="password" autoComplete="new-password" placeholder={draft.basicSaved ? t.secretSaved : ""} value={draft.basicPassword} onChange={(e) => set("basicPassword", e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-gray-500">{t.secretsNote}</p>

        <Field label={t.customRobots} hint={verified ? t.customRobotsReplace : t.customRobotsTest} htmlFor="cfg-custom-robots">
          <textarea
            id="cfg-custom-robots"
            rows={5}
            maxLength={CONFIG_LIMITS.customRobotsChars}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
            placeholder={"User-agent: *\nDisallow: /search"}
            value={draft.customRobots}
            onChange={(e) => set("customRobots", e.target.value)}
          />
        </Field>

        {host && <RobotsTester t={t} rootUrl={rootUrl} customRobots={draft.customRobots} />}

        {flag("crawl.extraction") && (
          <ExtractorsEditor
            t={t4b}
            value={draft.extractors}
            cap={caps.extractors}
            capText={String(caps.extractors)}
            onChange={(v) => set("extractors", v)}
          />
        )}
        {flag("crawl.extraction") && (
          <SearchesEditor
            t={t4b}
            value={draft.searches}
            cap={caps.searches}
            capText={String(caps.searches)}
            onChange={(v) => set("searches", v)}
          />
        )}
        {flag("crawl.segments") && host && (
          <SegmentsEditor t={t4b} host={host} cap={caps.segments} extractorNames={draft.extractors.map((e) => e.name)} />
        )}

        {flag("crawl.login") && t4e && host && (
          <LoginEditor t={t4e} host={host} verified={verified} use={draft.useLogin} onUse={(v) => set("useLogin", v)} disabled={disabled} />
        )}

        {flag("crawl.customJs") && t4e && (caps.js ?? 0) > 0 && (
          <JsSnippetsEditor t={t4e} value={draft.js} cap={caps.js ?? 0} verified={verified} renders={renders} onChange={(v) => set("js", v)} />
        )}

        <Toggle id="cfg-save-default" label={t.saveDefault} checked={saveAsDefault} onChange={(v) => { setSaveAsDefault(v); setDirty(true); }} />
      </fieldset>
      {children}
    </details>
  );
}

interface Verdict {
  allowed: boolean;
  line: number | null;
  text: string | null;
}
interface TesterResult {
  url: string;
  error?: "other_host" | "not_a_url";
  live?: Verdict;
  custom?: Verdict;
}

function VerdictCell({ v, t }: { v: Verdict | undefined; t: T }) {
  if (!v) return <span className="text-gray-400">—</span>;
  return (
    <span>
      <span className={v.allowed ? "text-green-700" : "text-red-700"}>{v.allowed ? t.allowed : t.blocked}</span>
      <span className="block text-xs text-gray-500" title={v.text ?? undefined}>
        {v.line ? `${t.lineN(String(v.line))}: ${v.text ?? ""}` : t.noRule}
      </span>
    </span>
  );
}

export function RobotsTester({ t, rootUrl, customRobots }: { t: T; rootUrl: string; customRobots: string }) {
  const [urls, setUrls] = useState("");
  const [agent, setAgent] = useState("");
  const [state, setState] = useState<"idle" | "running">("idle");
  const [result, setResult] = useState<{ live: { found: boolean; unreachable: boolean }; results: TesterResult[] } | null>(null);

  async function run() {
    setState("running");
    const res = await fetch("/api/seo/v1/crawl/robots-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: rootUrl,
        urls: lines(urls).slice(0, 100),
        customRobots: customRobots.trim() ? customRobots : null,
        ...(agent.trim() ? { agent: agent.trim() } : {}),
      }),
    }).catch(() => null);
    setResult(res?.ok ? await res.json().catch(() => null) : null);
    setState("idle");
  }

  return (
    <div className="space-y-2 rounded-lg border border-gray-100 p-3">
      <p className="text-sm font-medium text-gray-900">{t.testerTitle}</p>
      <p className="text-xs text-gray-500">{t.testerHelp}</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
        <textarea aria-label={t.testerUrls} placeholder={t.testerUrls} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs" value={urls} onChange={(e) => setUrls(e.target.value)} />
        <div className="space-y-2">
          <Input aria-label={t.testerAgent} placeholder={`${t.testerAgent}: Echorank360Bot`} value={agent} onChange={(e) => setAgent(e.target.value)} />
          <Button type="button" size="sm" variant="outline" onClick={run} disabled={state === "running" || lines(urls).length === 0}>
            {state === "running" ? t.testerRunning : t.testerRun}
          </Button>
        </div>
      </div>
      {result && (
        <>
          {!result.live.found && <p className="text-xs text-gray-500">{result.live.unreachable ? t.liveUnreachable : t.liveMissing}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th scope="col" className="py-2 pr-3">{t.colUrl}</th>
                  <th scope="col" className="py-2 pr-3">{t.colLive}</th>
                  {customRobots.trim() && <th scope="col" className="py-2">{t.colCustom}</th>}
                </tr>
              </thead>
              <tbody>
                {result.results.map((r) => (
                  <tr key={r.url} className="border-b border-gray-100 align-top">
                    <td className="max-w-xs py-2 pr-3">
                      <span className="block truncate text-gray-600" title={r.url}>
                        {r.url}
                      </span>
                    </td>
                    {r.error ? (
                      <td colSpan={2} className="py-2 text-xs text-gray-500">
                        {r.error === "other_host" ? t.otherHost : t.notAUrl}
                      </td>
                    ) : (
                      <>
                        <td className="py-2 pr-3">
                          <VerdictCell v={r.live} t={t} />
                        </td>
                        {customRobots.trim() && (
                          <td className="py-2">
                            <VerdictCell v={r.custom} t={t} />
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
