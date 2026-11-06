// src/lib/i18n/ai-labels.ts
//
// The AI disclosure labels: text only, in en / fr / de-CH, one source for every
// surface that shows them.
//
//   poweredByAi      a small line under the hero subhead (homepage, /ai-visibility)
//   assistantHeader  the help assistant's header
//   draftedByAi      above every AI-written draft (Action Agent review replies,
//                    schema and FAQ drafts; Marketing Studio results; the blog
//                    agent's "Draft ready" notification)
//
// No vendor names, no logos, no "powered by <company>": a third-party model
// name is never a badge. Factual mentions (the engines named in tracking
// results) are a different thing and stay where they are.
//
// No React and no server imports: marketing pages, dashboard client
// components and the workers all import it.

export type AiLabelLocale = "en" | "fr" | "de-CH";

export const AI_LABELS: Record<AiLabelLocale, { poweredByAi: string; assistantHeader: string; draftedByAi: string }> = {
  en: {
    poweredByAi: "Powered by AI",
    assistantHeader: "AI assistant · answers can be wrong",
    draftedByAi: "Drafted by AI. Review before publishing.",
  },
  fr: {
    poweredByAi: "Propulsé par l'IA",
    assistantHeader: "Assistant IA · les réponses peuvent être erronées",
    draftedByAi: "Rédigé par l'IA. Relisez avant de publier.",
  },
  "de-CH": {
    poweredByAi: "KI-gestützt",
    assistantHeader: "KI-Assistent · Antworten können falsch sein",
    draftedByAi: "Von KI entworfen. Vor dem Veröffentlichen prüfen.",
  },
};

/** Any marketing or dashboard locale → the label locale (fr* → fr, de* → de-CH, else en). */
export function aiLabelLocale(locale: string | null | undefined): AiLabelLocale {
  if (locale?.startsWith("fr")) return "fr";
  if (locale?.startsWith("de")) return "de-CH";
  return "en";
}

export const aiLabels = (locale: string | null | undefined) => AI_LABELS[aiLabelLocale(locale)];
