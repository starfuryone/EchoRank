// AI disclosure labels (src/lib/i18n/ai-labels.ts): text only, en / fr / de-CH,
// one source, on every surface that needs one, and never a vendor badge.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AI_LABELS, aiLabelLocale, aiLabels } from "@/lib/i18n/ai-labels";
import { ASSISTANT_COPY } from "@/lib/i18n/dashboard";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const VENDORS = /\b(claude|anthropic|openai|chatgpt|gpt|google|gemini)\b/i;

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name.includes(".bak") || name === "generated" || name === "__tests__") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(tsx?|css|html)$/.test(name)) yield p;
  }
}

describe("AI labels", () => {
  it("are the agreed text in en, fr and de-CH, with no vendor name and no ß", () => {
    expect(AI_LABELS.en).toEqual({
      poweredByAi: "Powered by AI",
      assistantHeader: "AI assistant · answers can be wrong",
      draftedByAi: "Drafted by AI. Review before publishing.",
    });
    for (const loc of ["fr", "de-CH"] as const) {
      expect(Object.keys(AI_LABELS[loc]).sort()).toEqual(Object.keys(AI_LABELS.en).sort());
      for (const [k, v] of Object.entries(AI_LABELS[loc])) expect(v, `${loc}.${k}`).not.toBe(AI_LABELS.en[k as keyof typeof AI_LABELS.en]);
    }
    const all = JSON.stringify(AI_LABELS);
    expect(all).not.toMatch(VENDORS);
    expect(JSON.stringify(AI_LABELS["de-CH"])).not.toContain("ß");
  });

  it("folds every marketing and dashboard locale", () => {
    expect(["en", "en-CA", "fr", "fr-CA", "de-CH", "es-ES", undefined].map(aiLabelLocale)).toEqual([
      "en", "en", "fr", "fr", "de-CH", "en", "en",
    ]);
    expect(aiLabels("fr-CA").poweredByAi).toBe(AI_LABELS.fr.poweredByAi);
  });

  it("the assistant header carries the label in every dashboard locale", () => {
    for (const loc of ["en", "fr", "de-CH"] as const) expect(ASSISTANT_COPY[loc].aiLabel).toBe(AI_LABELS[loc].assistantHeader);
    expect(read("src/components/assistant/AssistantPanel.tsx")).toMatch(/data-testid="assistant-ai-label"[\s\S]{0,40}\{c\.aiLabel\}/);
  });

  it("is under the hero subhead on the homepage and /ai-visibility", () => {
    const home = read("src/app/[locale]/HomeClient.tsx");
    expect(home).toMatch(/\{t\.hero\.sub\}<\/p>\s*\{\/\*[^]*?\*\/\}\s*<p className=\{s\.poweredByAi\} data-testid="powered-by-ai">\{AI_LABELS\[baseOf\(locale\)\]\.poweredByAi\}/);
    const av = read("src/app/[locale]/ai-visibility/page.tsx");
    expect(av).toMatch(/\{c\.hero\.sub\}<\/p>\s*\{\/\*[^]*?\*\/\}\s*<p className=\{s\.poweredByAi\} data-testid="powered-by-ai">\{aiLabels\(locale\)\.poweredByAi\}/);
  });

  it("labels AI-written drafts: Action Agent items, Marketing Studio results, the blog agent's notification", () => {
    expect(read("src/components/seo-tools/action-agent-client.tsx")).toMatch(/data-testid="drafted-by-ai">\s*\{AI_LABELS\[locale\]\.draftedByAi\}/);
    expect(read("src/components/seo-tools/marketing-brief-client.tsx")).toMatch(/data-testid="drafted-by-ai">\s*\{AI_LABELS\[locale\]\.draftedByAi\}/);
    expect(read("src/lib/blog-agent/pipeline.ts")).toMatch(/title: `Draft ready: [^`]+`,\s*lines: \[\s*\/\/[^\n]*\n\s*AI_LABELS\.en\.draftedByAi,/);
  });

  it("no label text is hard-coded elsewhere, and nothing says 'powered by' a vendor", () => {
    const offenders: string[] = [];
    for (const f of files(join(ROOT, "src"))) {
      const text = readFileSync(f, "utf8");
      const rel = f.slice(ROOT.length + 1);
      if (/powered by\s+(claude|anthropic|openai|chatgpt|gpt|google|gemini)/i.test(text)) offenders.push(`${rel}: vendor badge`);
      if (rel !== "src/lib/i18n/ai-labels.ts" && /Drafted by AI|answers can be wrong/.test(text)) offenders.push(`${rel}: inline label`);
    }
    expect(offenders).toEqual([]);
  });
});
