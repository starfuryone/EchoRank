"use client";

// Custom JavaScript snippets in the crawl configuration (Phase 4e). Verified
// sites only, rendered pages only, at most the plan's crawlJsSnippets. The
// server checks all three again; this only keeps the form honest.

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SiteCrawler4eCopy } from "@/lib/i18n/site-crawler-4e";
import { JS_LIMITS, JS_PRESETS, type JsPreset, type JsSnippet } from "@/lib/site-crawler/js-snippets";

export const newSnippet = (preset: JsPreset, t: SiteCrawler4eCopy): JsSnippet => ({
  name: t.jsPresets[preset] ?? preset,
  preset,
  selector: null,
  code: null,
});

export function JsSnippetsEditor({
  t,
  value,
  cap,
  verified,
  renders,
  onChange,
}: {
  t: SiteCrawler4eCopy;
  value: JsSnippet[];
  cap: number;
  verified: boolean;
  /** The crawl will render pages (a render mode is chosen and the plan renders). */
  renders: boolean;
  onChange: (next: JsSnippet[]) => void;
}) {
  const update = (i: number, patch: Partial<JsSnippet>) => onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const room = value.length < cap;
  return (
    <div className="space-y-2" aria-labelledby="cfg-js-title">
      <p id="cfg-js-title" className="text-sm font-medium text-gray-900">
        {t.jsTitle}
      </p>
      <p className="text-xs text-gray-500">{t.jsHelp(String(cap))}</p>
      {!verified && <p className="text-xs text-gray-500">{t.jsVerifiedOnly}</p>}
      {verified && !renders && <p className="text-xs text-amber-700">{t.jsNeedsRender}</p>}
      {value.map((s, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-gray-100 p-2">
          <div className="grid gap-2 sm:grid-cols-[10rem_14rem_1fr_auto]">
            <Input aria-label={t.jsName} placeholder={t.jsName} maxLength={JS_LIMITS.nameChars} value={s.name} onChange={(ev) => update(i, { name: ev.target.value })} />
            <Select
              aria-label={t.jsPreset}
              value={s.preset}
              onChange={(ev) => update(i, { preset: ev.target.value as JsPreset })}
              options={JS_PRESETS.map((p) => ({ value: p, label: t.jsPresets[p] ?? p }))}
            />
            {s.preset === "loadMore" ? (
              <Input
                aria-label={t.jsSelector}
                placeholder={t.jsSelector}
                className="font-mono text-xs"
                maxLength={JS_LIMITS.selectorChars}
                value={s.selector ?? ""}
                onChange={(ev) => update(i, { selector: ev.target.value || null })}
              />
            ) : (
              <span />
            )}
            <button type="button" aria-label={t.jsRemove} className="text-gray-400 hover:text-gray-700" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {s.preset === "custom" && (
            <textarea
              aria-label={t.jsCode}
              placeholder={t.jsCode}
              rows={4}
              maxLength={JS_LIMITS.codeChars}
              className="w-full rounded-md border border-gray-200 p-2 font-mono text-xs"
              value={s.code ?? ""}
              onChange={(ev) => update(i, { code: ev.target.value || null })}
            />
          )}
        </div>
      ))}
      {room ? (
        <Button type="button" size="sm" variant="outline" disabled={!verified} onClick={() => onChange([...value, newSnippet("dataLayer", t)])}>
          <Plus className="h-4 w-4" aria-hidden="true" /> {t.jsAdd}
        </Button>
      ) : (
        <p className="text-xs text-gray-500">{t.jsCapReached(String(cap))}</p>
      )}
    </div>
  );
}
