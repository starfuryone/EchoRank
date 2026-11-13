"use client";

// The AEO plan worksheet: six sections (summary first, then one per module),
// saved to localStorage as you type (store.ts; in-memory if storage is
// unavailable, with a visible note), "Copy as text" and "Print". Nothing is
// sent anywhere.

import { useEffect, useState } from "react";
import { useHydrated, useStore, worksheetStore } from "./store";
import css from "./aeo.module.css";

export interface SheetSection {
  section: string;
  title: string;
  label?: string;
  fields: { id: string; label: string; hint: string }[];
}

export interface SheetCopy {
  copy: string;
  print: string;
  copied: string;
  copyFailed: string;
  saved: string;
  unsaved: string;
  clear: string;
  clearConfirm: string;
  heading: string;
}

const keyOf = (section: string, field: string) => `${section}.${field}`;

/** The plan as plain text, the same order as the page. Exported for the test. */
export function planAsText(sections: SheetSection[], values: Record<string, string>, heading: string): string {
  const out: string[] = [heading, ""];
  for (const s of sections) {
    out.push(s.title.toUpperCase());
    for (const f of s.fields) {
      out.push(`${f.label}:`);
      out.push((values[keyOf(s.section, f.id)] ?? "").trim() || "—");
      out.push("");
    }
  }
  return out.join("\n").trimEnd() + "\n";
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function Worksheet({ sections, copy }: { sections: SheetSection[]; copy: SheetCopy }) {
  const values = useStore(worksheetStore);
  const hydrated = useHydrated();
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const update = (key: string, v: string) => worksheetStore.set({ ...worksheetStore.get(), [key]: v });
  const text = planAsText(sections, values, copy.heading);

  return (
    <div>
      <div className={`${css.actions} ${css.noPrint}`}>
        <button type="button" className={css.ghost} onClick={async () => setToast((await copyText(text)) ? copy.copied : copy.copyFailed)}>
          {copy.copy}
        </button>
        <button type="button" className={css.ghost} onClick={() => window.print()}>
          {copy.print}
        </button>
        <button
          type="button"
          className={css.ghost}
          onClick={() => {
            if (window.confirm(copy.clearConfirm)) worksheetStore.set({});
          }}
        >
          {copy.clear}
        </button>
        <span className={css.status} aria-live="polite">
          {hydrated ? (worksheetStore.persisted() ? copy.saved : copy.unsaved) : ""}
        </span>
      </div>
      <div className={css.sheet}>
        {sections.map((s) => (
          <section key={s.section} className={css.sheetSection} aria-labelledby={`sheet-${s.section}`}>
            {s.label && <span>{s.label}</span>}
            <h2 id={`sheet-${s.section}`}>{s.title}</h2>
            {s.fields.map((f) => {
              const key = keyOf(s.section, f.id);
              const id = `sheet-${s.section}-${f.id}`;
              return (
                <div key={key} className={css.field}>
                  <label htmlFor={id}>{f.label}</label>
                  <small id={`${id}-hint`}>{f.hint}</small>
                  <textarea id={id} aria-describedby={`${id}-hint`} value={values[key] ?? ""} onChange={(e) => update(key, e.target.value)} />
                  <div className={css.printOnly}>{values[key] ?? ""}</div>
                </div>
              );
            })}
          </section>
        ))}
      </div>
      <div role="status" aria-live="polite" className={toast ? `${css.toast} ${css.toastOn}` : css.toast}>
        {toast}
      </div>
    </div>
  );
}
