"use client";

// Phase 4b editors for the Configuration section: custom extractors (with
// presets), and — from the later 4b commits — custom searches and segments.
// Each edits one list of the draft; the section owns the draft and sends it
// with the crawl. Caps come from the live quota (plan-config), never copy.
//
// Client-safe imports only: crawl-config.ts is dependency-free (zod).

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SiteCrawlerCopy } from "@/lib/i18n/dashboard";
import {
  CONFIG_LIMITS,
  type CustomSearch,
  EXTRACTOR_KINDS,
  EXTRACTOR_PRESETS,
  type Extractor,
  type ExtractorKind,
  type ExtractorPreset,
} from "@/lib/site-crawler/crawl-config";
import { SEGMENT_NAME_CHARS, STATUS_CLASSES, SegmentDefSchema, type SegmentDef, type SegmentRule, type StatusClass } from "@/lib/site-crawler/segments";

type T4b = SiteCrawlerCopy["p4b"];

/** Preset groups as the picker offers them; each adds one row per extractor. */
export const PRESET_GROUPS: { id: "og" | "product" | "author" | "hreflang" | "canonical"; presets: ExtractorPreset[] }[] = [
  { id: "og", presets: ["ogTitle", "ogDescription", "ogImage"] },
  { id: "product", presets: ["price", "sku"] },
  { id: "author", presets: ["author", "published"] },
  { id: "hreflang", presets: ["hreflang"] },
  { id: "canonical", presets: ["canonical"] },
];

function presetLabel(id: (typeof PRESET_GROUPS)[number]["id"], t: T4b): string {
  if (id === "og") return t.presetOg;
  if (id === "product") return t.presetProduct;
  if (id === "author") return t.presetAuthor;
  if (id === "hreflang") return t.presetHreflang;
  return t.presetCanonical;
}

function kindLabel(k: ExtractorKind, t: T4b): string {
  return k === "css" ? t.kindCss : k === "xpath" ? t.kindXpath : t.kindRegex;
}

/** Append a preset group's rows, as many as the cap leaves room for. */
export function withPreset(list: Extractor[], group: (typeof PRESET_GROUPS)[number]["id"], cap: number): Extractor[] {
  const presets = PRESET_GROUPS.find((g) => g.id === group)?.presets ?? [];
  const added = presets.map((p): Extractor => ({ ...EXTRACTOR_PRESETS[p] }));
  return [...list, ...added].slice(0, Math.max(cap, list.length));
}

export function ExtractorsEditor({
  t,
  value,
  cap,
  capText,
  onChange,
}: {
  t: T4b;
  value: Extractor[];
  cap: number;
  /** The cap, formatted for the locale. */
  capText: string;
  onChange: (next: Extractor[]) => void;
}) {
  const update = (i: number, patch: Partial<Extractor>) => onChange(value.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const room = value.length < cap;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-900">{t.exSection}</p>
      <p className="text-xs text-gray-500">{t.exHelp(capText)}</p>
      {value.map((e, i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-gray-100 p-2 sm:grid-cols-[8rem_8rem_1fr_7rem_auto] sm:items-end">
          <Input id={`cr-ex-name-${i}`} label={t.exName} placeholder={t.exName} maxLength={CONFIG_LIMITS.nameChars} value={e.name} onChange={(ev) => update(i, { name: ev.target.value })} />
          <Select
            id={`cr-ex-kind-${i}`} label={t.exKind}
            value={e.kind}
            onChange={(ev) => update(i, { kind: ev.target.value as ExtractorKind })}
            options={EXTRACTOR_KINDS.map((k) => ({ value: k, label: kindLabel(k, t) }))}
          />
          <Input
            id={`cr-ex-expr-${i}`} label={t.exExpr}
            placeholder={t.exExpr}
            className="font-mono text-xs"
            maxLength={CONFIG_LIMITS.exprChars}
            value={e.expr}
            onChange={(ev) => update(i, { expr: ev.target.value })}
          />
          <Input
            id={`cr-ex-attr-${i}`} label={t.exAttr}
            placeholder={e.kind === "regex" ? "" : t.exAttr}
            disabled={e.kind === "regex"}
            maxLength={CONFIG_LIMITS.attrChars}
            value={e.attr ?? ""}
            onChange={(ev) => update(i, { attr: ev.target.value || null })}
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-xs text-gray-600">
              <input type="checkbox" checked={e.multiple} onChange={(ev) => update(i, { multiple: ev.target.checked })} />
              {t.exMultiple}
            </label>
            <button type="button" aria-label={t.exRemove} className="self-end rounded p-1.5 text-gray-600 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
      {room ? (
        <div className="flex flex-wrap items-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange([...value, { name: "", kind: "css", expr: "", attr: null, multiple: false }])}
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> {t.exAdd}
          </Button>
          <Select
            id="cr-ex-preset" label={t.exPresetLabel}
            className="w-auto"
            value=""
            onChange={(ev) => {
              if (ev.target.value) onChange(withPreset(value, ev.target.value as (typeof PRESET_GROUPS)[number]["id"], cap));
            }}
            options={[{ value: "", label: t.exPresetPick }, ...PRESET_GROUPS.map((g) => ({ value: g.id, label: presetLabel(g.id, t) }))]}
          />
        </div>
      ) : (
        <p className="text-xs text-gray-500">{t.capReached(capText)}</p>
      )}
    </div>
  );
}

export function SearchesEditor({
  t,
  value,
  cap,
  capText,
  onChange,
}: {
  t: T4b;
  value: CustomSearch[];
  cap: number;
  capText: string;
  onChange: (next: CustomSearch[]) => void;
}) {
  const update = (i: number, patch: Partial<CustomSearch>) => onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-900">{t.srSection}</p>
      <p className="text-xs text-gray-500">{t.srHelp(capText)}</p>
      {value.map((s, i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-gray-100 p-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
          <Input id={`cr-sr-name-${i}`} label={t.srName} placeholder={t.srName} maxLength={CONFIG_LIMITS.nameChars} value={s.name} onChange={(ev) => update(i, { name: ev.target.value })} />
          <Input
            id={`cr-sr-pattern-${i}`} label={t.srPattern}
            placeholder={t.srPattern}
            className="font-mono text-xs"
            maxLength={CONFIG_LIMITS.exprChars}
            value={s.pattern}
            onChange={(ev) => update(i, { pattern: ev.target.value })}
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-xs text-gray-600">
              <input type="checkbox" checked={s.isRegex} onChange={(ev) => update(i, { isRegex: ev.target.checked })} />
              {t.srRegex}
            </label>
            <button type="button" aria-label={t.srRemove} className="self-end rounded p-1.5 text-gray-600 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
      {value.length < cap ? (
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...value, { name: "", pattern: "", isRegex: false }])}>
          <Plus className="h-4 w-4" aria-hidden="true" /> {t.srAdd}
        </Button>
      ) : (
        <p className="text-xs text-gray-500">{t.capReached(capText)}</p>
      )}
    </div>
  );
}

const RULE_KINDS = ["urlPattern", "extractorValue", "depthMax", "statusClass"] as const;

function ruleKindLabel(k: SegmentRule["kind"], t: T4b): string {
  if (k === "urlPattern") return t.ruleUrlPattern;
  if (k === "extractorValue") return t.ruleExtractorValue;
  if (k === "depthMax") return t.ruleDepthMax;
  return t.ruleStatusClass;
}

/** A fresh rule of a kind, keeping what can be kept. */
export function blankRule(kind: SegmentRule["kind"]): SegmentRule {
  if (kind === "urlPattern") return { kind, pattern: "" };
  if (kind === "extractorValue") return { kind, index: 0, equals: "" };
  if (kind === "depthMax") return { kind, max: 1 };
  return { kind, cls: "2xx" };
}

/** The segments as the API takes them, or null when one is incomplete. */
export function segmentsPayload(list: SegmentDef[]): SegmentDef[] | null {
  const parsed = list.map((s) => SegmentDefSchema.safeParse(s));
  return parsed.every((p) => p.success) ? parsed.map((p) => p.data!) : null;
}

/**
 * Segments are saved per site, not per crawl: "Save for this site" writes
 * them, and every later crawl of the host copies them.
 */
export function SegmentsEditor({
  t,
  host,
  cap,
  extractorNames,
}: {
  t: T4b;
  host: string;
  cap: number;
  /** The draft's extractors, for extracted-value rules. */
  extractorNames: string[];
}) {
  const [list, setList] = useState<SegmentDef[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/seo/v1/crawl/segments?host=${encodeURIComponent(host)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { segments: SegmentDef[] } | null) => {
        if (cancelled) return;
        setList(d?.segments ?? []);
        setStatus("idle");
      });
    return () => {
      cancelled = true;
    };
  }, [host]);

  const change = (next: SegmentDef[]) => {
    setList(next);
    setStatus("idle");
  };
  const update = (i: number, patch: Partial<SegmentDef>) => change(list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const setRule = (i: number, rule: SegmentRule) => update(i, { rule });

  async function save() {
    const segments = segmentsPayload(list);
    if (!segments) return setStatus("failed");
    setStatus("saving");
    const res = await fetch("/api/seo/v1/crawl/segments", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ host, segments }),
    }).catch(() => null);
    setStatus(res?.ok ? "saved" : "failed");
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-900">{t.segSection}</p>
      <p className="text-xs text-gray-500">{t.segHelp(String(cap))}</p>
      {list.map((s, i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-gray-100 p-2 sm:grid-cols-[9rem_11rem_1fr_auto] sm:items-end">
          <Input id={`cr-seg-name-${i}`} label={t.segName} placeholder={t.segName} maxLength={SEGMENT_NAME_CHARS} value={s.name} onChange={(ev) => update(i, { name: ev.target.value })} />
          <Select
            id={`cr-seg-rule-${i}`} label={t.segRule}
            value={s.rule.kind}
            onChange={(ev) => setRule(i, blankRule(ev.target.value as SegmentRule["kind"]))}
            options={RULE_KINDS.map((k) => ({ value: k, label: ruleKindLabel(k, t) }))}
          />
          <RuleValue id={`cr-seg-${i}`} t={t} rule={s.rule} extractorNames={extractorNames} onChange={(r) => setRule(i, r)} />
          <button type="button" aria-label={t.segRemove} className="self-end rounded p-1.5 text-gray-600 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" onClick={() => change(list.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        {list.length < cap ? (
          <Button type="button" size="sm" variant="outline" onClick={() => change([...list, { name: "", rule: blankRule("urlPattern") }])}>
            <Plus className="h-4 w-4" aria-hidden="true" /> {t.segAdd}
          </Button>
        ) : (
          <p className="text-xs text-gray-500">{t.capReached(String(cap))}</p>
        )}
        <Button type="button" size="sm" onClick={() => void save()} disabled={status === "saving"}>
          {t.segSave}
        </Button>
        {status === "saved" && <span className="text-xs text-green-700">{t.segSaved}</span>}
        {status === "failed" && <span className="text-xs text-red-700">{t.segSaveFailed}</span>}
      </div>
    </div>
  );
}

function RuleValue({
  id,
  t,
  rule,
  extractorNames,
  onChange,
}: {
  /** Prefix for the controls' ids (each has a visible label). */
  id: string;
  t: T4b;
  rule: SegmentRule;
  extractorNames: string[];
  onChange: (r: SegmentRule) => void;
}) {
  if (rule.kind === "urlPattern") {
    return (
      <Input id={`${id}-rule-url-pattern`} label={t.ruleUrlPattern} placeholder={t.segPattern} className="font-mono text-xs" maxLength={200} value={rule.pattern} onChange={(ev) => onChange({ ...rule, pattern: ev.target.value })} />
    );
  }
  if (rule.kind === "extractorValue") {
    if (extractorNames.length === 0) return <p className="self-center text-xs text-gray-500">{t.segNoExtractor}</p>;
    return (
      <div className="grid grid-cols-2 gap-2">
        <Select
          id={`${id}-seg-extractor`} label={t.segExtractor}
          value={String(rule.index)}
          onChange={(ev) => onChange({ ...rule, index: Number(ev.target.value) })}
          options={extractorNames.map((n, i) => ({ value: String(i), label: n || `#${i + 1}` }))}
        />
        <Input id={`${id}-seg-equals`} label={t.segEquals} placeholder={t.segEquals} maxLength={500} value={rule.equals} onChange={(ev) => onChange({ ...rule, equals: ev.target.value })} />
      </div>
    );
  }
  if (rule.kind === "depthMax") {
    return (
      <Input
        id={`${id}-seg-depth`} label={t.segDepth}
        inputMode="numeric"
        value={String(rule.max)}
        onChange={(ev) => onChange({ ...rule, max: Math.min(100, Number(ev.target.value.replace(/\D/g, "") || 0)) })}
      />
    );
  }
  return (
    <Select
      id={`${id}-rule-status-class`} label={t.ruleStatusClass}
      value={rule.cls}
      onChange={(ev) => onChange({ ...rule, cls: ev.target.value as StatusClass })}
      options={STATUS_CLASSES.map((c) => ({ value: c, label: c === "none" ? t.statusNone : c }))}
    />
  );
}
