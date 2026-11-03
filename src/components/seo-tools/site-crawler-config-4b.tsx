"use client";

// Phase 4b editors for the Configuration section: custom extractors (with
// presets), and — from the later 4b commits — custom searches and segments.
// Each edits one list of the draft; the section owns the draft and sends it
// with the crawl. Caps come from the live quota (plan-config), never copy.
//
// Client-safe imports only: crawl-config.ts is dependency-free (zod).

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
        <div key={i} className="grid gap-2 rounded-lg border border-gray-100 p-2 sm:grid-cols-[8rem_8rem_1fr_7rem_auto]">
          <Input aria-label={t.exName} placeholder={t.exName} maxLength={CONFIG_LIMITS.nameChars} value={e.name} onChange={(ev) => update(i, { name: ev.target.value })} />
          <Select
            aria-label={t.exKind}
            value={e.kind}
            onChange={(ev) => update(i, { kind: ev.target.value as ExtractorKind })}
            options={EXTRACTOR_KINDS.map((k) => ({ value: k, label: kindLabel(k, t) }))}
          />
          <Input
            aria-label={t.exExpr}
            placeholder={t.exExpr}
            className="font-mono text-xs"
            maxLength={CONFIG_LIMITS.exprChars}
            value={e.expr}
            onChange={(ev) => update(i, { expr: ev.target.value })}
          />
          <Input
            aria-label={t.exAttr}
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
            <button type="button" aria-label={t.exRemove} className="text-gray-400 hover:text-gray-700" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
      {room ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange([...value, { name: "", kind: "css", expr: "", attr: null, multiple: false }])}
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> {t.exAdd}
          </Button>
          <Select
            aria-label={t.exPresetLabel}
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
        <div key={i} className="grid gap-2 rounded-lg border border-gray-100 p-2 sm:grid-cols-[10rem_1fr_auto]">
          <Input aria-label={t.srName} placeholder={t.srName} maxLength={CONFIG_LIMITS.nameChars} value={s.name} onChange={(ev) => update(i, { name: ev.target.value })} />
          <Input
            aria-label={t.srPattern}
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
            <button type="button" aria-label={t.srRemove} className="text-gray-400 hover:text-gray-700" onClick={() => onChange(value.filter((_, j) => j !== i))}>
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
