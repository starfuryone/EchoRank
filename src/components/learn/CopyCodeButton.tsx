"use client";

// Copy-to-clipboard for a Knowledge Hub code block ({k:"code", copy:true}).
// The text arrives as a prop (the block's own string), never read back from
// the DOM. Labels in en / fr / de-CH; no dependencies.

import { useState } from "react";

const LABELS = {
  en: { copy: "Copy", done: "Copied" },
  fr: { copy: "Copier", done: "Copié" },
  de: { copy: "Kopieren", done: "Kopiert" },
} as const;

export function CopyCodeButton({ text, locale }: { text: string; locale: string }) {
  const t = LABELS[locale.startsWith("fr") ? "fr" : locale.startsWith("de") ? "de" : "en"];
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      data-copy-code=""
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        font: "inherit",
        fontSize: 12,
        padding: "4px 10px",
        borderRadius: 8,
        border: "1px solid var(--line)",
        background: "var(--surface)",
        color: "var(--text)",
        cursor: "pointer",
      }}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(
          () => {
            setDone(true);
            window.setTimeout(() => setDone(false), 1800);
          },
          () => {},
        );
      }}
    >
      <span aria-live="polite">{done ? t.done : t.copy}</span>
    </button>
  );
}
