"use client";

// AI prompts on the start card (Phase 4e): up to 3 prompts on the crawl's
// top N pages (by inlinks, or inside one saved segment), N capped by the
// plan. Claude runs on the house key and the Marketing Studio token budget;
// OpenAI / Gemini on the tenant's own key from Settings → Integrations. The
// token estimate (N × prompts × ~2k) shows here and in the confirm step.

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SiteCrawler4eCopy } from "@/lib/i18n/site-crawler-4e";
import type { SiteCrawler4dCopy } from "@/lib/i18n/site-crawler-4d";
import { AI_LIMITS, AI_PRESETS, AI_PROVIDERS, aiTokenEstimate, type AiConfig, type AiPreset, type AiProvider } from "@/lib/site-crawler/ai-shared";

export interface AiQuota {
  aiPageCap: number;
  aiTokensUsed: number;
  /** null = unmetered. */
  aiTokenLimit: number | null;
  aiClaude: boolean;
  aiKeys: { openai: boolean; gemini: boolean };
}

const PROVIDER_NAME: Record<AiProvider, string> = { claude: "Claude", openai: "OpenAI", gemini: "Gemini" };

/** The first provider this tenant can use: Claude when the plan has it, else a saved key. */
export function defaultProvider(q: AiQuota): AiProvider {
  if (q.aiClaude) return "claude";
  if (q.aiKeys.openai) return "openai";
  if (q.aiKeys.gemini) return "gemini";
  return "claude";
}

export function providerUsable(p: AiProvider, q: AiQuota): boolean {
  return p === "claude" ? q.aiClaude : q.aiKeys[p];
}

/** The estimate sentence for the current choice. */
export function aiEstimateLine(t: SiteCrawler4eCopy, ai: AiConfig, q: AiQuota, int: Intl.NumberFormat): string {
  const tokens = int.format(aiTokenEstimate(ai));
  if (ai.provider !== "claude") return t.aiEstimateOwn(tokens, PROVIDER_NAME[ai.provider]);
  if (q.aiTokenLimit === null) return t.aiEstimateUnmetered(tokens);
  return t.aiEstimate(tokens, int.format(Math.max(0, q.aiTokenLimit - q.aiTokensUsed)));
}

export function aiConfirmLine(t: SiteCrawler4eCopy, ai: AiConfig, int: Intl.NumberFormat): string {
  return t.confirmAi(int.format(ai.top.pages), String(ai.prompts.length), int.format(aiTokenEstimate(ai)));
}

export function AiPromptsSection({
  t,
  t4d,
  quota,
  value,
  segments,
  int,
  disabled,
  onChange,
}: {
  t: SiteCrawler4eCopy;
  t4d: SiteCrawler4dCopy;
  quota: AiQuota;
  value: AiConfig | null;
  /** The host's saved segment names, from the Add data section. */
  segments: string[];
  int: Intl.NumberFormat;
  disabled: boolean;
  onChange: (v: AiConfig | null) => void;
}) {
  const cap = quota.aiPageCap;
  const set = (patch: Partial<AiConfig>) => value && onChange({ ...value, ...patch });
  const setPrompt = (i: number, preset: AiPreset, text: string | null = null) =>
    value && set({ prompts: value.prompts.map((p, j) => (j === i ? { preset, text } : p)) });
  return (
    <div className="space-y-2" aria-labelledby="crawl-ai-title">
      <label className="flex items-center gap-2 text-sm text-gray-800">
        <input
          type="checkbox"
          checked={value !== null}
          disabled={disabled || cap <= 0}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? { provider: defaultProvider(quota), prompts: [{ preset: "title", text: null }], top: { pages: Math.min(10, cap), segment: null } }
                : null,
            )
          }
        />
        <span id="crawl-ai-title">{t.aiOn}</span>
      </label>
      <p className="pl-6 text-xs text-gray-500">{t.aiHelp(int.format(cap))}</p>
      {value && (
        <div className="space-y-2 pl-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-24">
              <label htmlFor="ai-pages" className="mb-1 block text-xs font-medium text-gray-700">
                {t4d.pagesLabel}
              </label>
              <Input
                id="ai-pages"
                inputMode="numeric"
                value={String(value.top.pages)}
                disabled={disabled}
                onChange={(e) => set({ top: { ...value.top, pages: Math.max(1, Math.min(cap, Number(e.target.value.replace(/\D/g, "")) || 1)) } })}
              />
            </div>
            <div className="w-72">
              <Select
                id="ai-by"
                label={t4d.byLabel}
                value={value.top.segment === null ? "" : String(value.top.segment)}
                disabled={disabled}
                onChange={(e) => set({ top: { ...value.top, segment: e.target.value === "" ? null : Number(e.target.value) } })}
                options={[{ value: "", label: t4d.byInlinks }, ...segments.map((name, i) => ({ value: String(i), label: t4d.bySegment(name) }))]}
              />
            </div>
            <div className="w-56">
              <Select
                id="ai-provider"
                label={t.aiProvider}
                value={value.provider}
                disabled={disabled}
                onChange={(e) => set({ provider: e.target.value as AiProvider })}
                options={AI_PROVIDERS.map((p) => ({ value: p, label: t.aiProviders[p] ?? p }))}
              />
            </div>
          </div>
          {!providerUsable(value.provider, quota) && (
            <p className="text-xs text-amber-700">{value.provider === "claude" ? t.aiClaudeUnavailable : t.aiKeyMissing(PROVIDER_NAME[value.provider])}</p>
          )}
          {value.prompts.map((p, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[14rem_1fr_auto]">
              <Select
                id={`ai-prompt-${i}`}
                label={t.aiPrompt(String(i + 1))}
                value={p.preset}
                disabled={disabled}
                onChange={(e) => setPrompt(i, e.target.value as AiPreset)}
                options={AI_PRESETS.map((x) => ({ value: x, label: t.aiPresets[x] ?? x }))}
              />
              {p.preset === "custom" ? (
                <Input
                  id={`ai-custom-${i}`}
                  label={t.aiCustom}
                  placeholder={t.aiCustom}
                  maxLength={AI_LIMITS.customChars}
                  value={p.text ?? ""}
                  disabled={disabled}
                  onChange={(e) => setPrompt(i, "custom", e.target.value || null)}
                />
              ) : (
                <span />
              )}
              <button
                type="button"
                aria-label={t.aiRemove}
                className="self-end rounded p-1 text-gray-600 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40"
                disabled={disabled || value.prompts.length <= 1}
                onClick={() => set({ prompts: value.prompts.filter((_, j) => j !== i) })}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
          {value.prompts.length < AI_LIMITS.prompts && (
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => set({ prompts: [...value.prompts, { preset: "summary", text: null }] })}>
              <Plus className="h-4 w-4" aria-hidden="true" /> {t.aiAdd}
            </Button>
          )}
          <p className="text-xs text-gray-500">{aiEstimateLine(t, value, quota, int)}</p>
        </div>
      )}
    </div>
  );
}

/** The crawl's AI step, from summary.metrics.ai. Null before it starts. */
export function aiStatusText(
  st: { status?: string; stoppedReason?: string; targets?: number; completed?: number; tokens?: number } | undefined,
  t: SiteCrawler4eCopy,
  int: Intl.NumberFormat,
): string | null {
  if (!st?.status) return null;
  const done = int.format(st.completed ?? 0);
  const total = int.format(st.targets ?? 0);
  if (st.status === "stopped") return st.stoppedReason === "token_budget" ? t.aiStatusBudget : t.aiStatusKey;
  if (st.status === "done") return t.aiStatusDone(done, total, int.format(st.tokens ?? 0));
  if (st.status === "queued_batch") return t.aiStatusBatch(done, total);
  return t.aiStatusRunning(done, total);
}

export function AiStatusLine({ status, t, int }: { status: object | undefined; t: SiteCrawler4eCopy; int: Intl.NumberFormat }) {
  const text = aiStatusText((status as { ai?: Parameters<typeof aiStatusText>[0] } | undefined)?.ai, t, int);
  return text ? <p className="text-xs text-gray-600">{text}</p> : null;
}
