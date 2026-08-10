// Shared renderer for the knowledge-base workflow guides.
//
// Every guide is data — a typed GuideDoc — and this renders it. One shell means
// the seven articles cannot drift apart in structure, and adding an eighth is a
// data file rather than a layout exercise.
//
// LOCALE MODEL: en/fr bases, matching the homepage and /resources. en-CA folds
// to en, fr-CA to fr, and de-CH mirrors English per the house convention, so a
// third catalog here would be unreachable code.

import Link from "next/link";
import { PublicNav } from "../../PublicNav";
import { CONTENT } from "@/lib/i18n/content";
import type { Locale } from "@/lib/i18n/config";
import s from "../../home2.module.css";
import g from "./guide.module.css";

export type Base = "en" | "fr";
export const baseOf = (locale: string): Base => (locale.startsWith("fr") ? "fr" : "en");

export interface Callout {
  kind: "tip" | "warning" | "note";
  body: string;
}

export interface Step {
  h: string;
  paras: string[];
  callout?: Callout;
  /** Caption for a screenshot placeholder. No image is invented. */
  shot?: string;
  /** Optional real image (from public/) rendered instead of the placeholder box. */
  shotSrc?: string;
}

export interface GuideLink {
  /** Path after the locale segment, e.g. "/guides/keyword-research". */
  href: string;
  label: string;
  /** Set for assets served outside the Next app (Caddy) — rendered as <a>. */
  external?: boolean;
}

export interface GuideDoc {
  title: string;
  intro: string;
  needs: string[];
  steps: Step[];
  next: GuideLink[];
}

/** Section headings and box labels, en/fr. */
const CHROME = {
  en: {
    eyebrow: "GUIDE",
    needs: "What you'll need",
    next: "Next steps",
    tip: "Tip",
    warning: "Warning",
    note: "Note",
    shot: "Screenshot",
    // The live UI is edited more often than these articles are, so every guide
    // says this once rather than each one guessing at a nav label.
    uiNote:
      "Interface labels change as the product ships. If a name here does not match what you see, check the current interface — the workflow is the same.",
  },
  fr: {
    eyebrow: "GUIDE",
    needs: "Ce qu'il vous faut",
    next: "Prochaines étapes",
    tip: "Conseil",
    warning: "Avertissement",
    note: "À noter",
    shot: "Capture d'écran",
    uiNote:
      "Les libellés de l'interface évoluent au fil des versions. Si un nom ne correspond pas à ce que vous voyez, vérifiez l'interface actuelle — la marche à suivre reste la même.",
  },
} as const;

export function GuideArticle({ locale, doc }: { locale: string; doc: GuideDoc }) {
  const b = baseOf(locale);
  const c = CHROME[b];
  const foot = CONTENT[locale as Locale].footer;
  const L = (p: string) => `/${locale}${p.startsWith("/") ? p : `/${p}`}`;

  return (
    <div className={s.page}>
      <PublicNav locale={locale} />

      <section className={s.section}>
        <div className={`${s.container} ${g.article}`}>
          <p className={s.label}>
            <b>/ {c.eyebrow}</b>
          </p>
          <h1 className={s.h2}>{doc.title}</h1>
          <p className={s.sub}>{doc.intro}</p>

          <div className={g.needsBox}>
            <h2 className={g.needsTitle}>{c.needs}</h2>
            <ul className={g.needsList}>
              {doc.needs.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>

          <p className={g.uiNote}>{c.uiNote}</p>

          {doc.steps.map((step, i) => (
            <section className={g.step} key={step.h}>
              <h2 className={g.stepH}>
                <span className={g.stepNum}>{i + 1}</span>
                {step.h}
              </h2>
              {step.paras.map((p) => (
                <p className={g.para} key={p.slice(0, 40)}>
                  {p}
                </p>
              ))}

              {step.shot && (
                <figure className={g.shot} aria-label={`${c.shot}: ${step.shot}`}>
                  {step.shotSrc ? (
                    <img
                      src={step.shotSrc}
                      alt={step.shot}
                      loading="lazy"
                      style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,.08)" }}
                    />
                  ) : (
                    <div className={g.shotBox} aria-hidden="true">
                      {c.shot}
                    </div>
                  )}
                  <figcaption className={g.shotCap}>{step.shot}</figcaption>
                </figure>
              )}

              {step.callout && (
                <aside className={`${g.callout} ${g[step.callout.kind]}`}>
                  <span className={g.calloutLabel}>{c[step.callout.kind]}</span>
                  <p className={g.calloutBody}>{step.callout.body}</p>
                </aside>
              )}
            </section>
          ))}

          <section className={g.step}>
            <h2 className={g.stepH}>{c.next}</h2>
            <ul className={g.nextList}>
              {doc.next.map((n) =>
                n.external ? (
                  <li key={n.href}>
                    <a href={n.href}>{n.label}</a>
                  </li>
                ) : (
                  <li key={n.href}>
                    <Link href={L(n.href)}>{n.label}</Link>
                  </li>
                ),
              )}
            </ul>
          </section>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.container}>
          <div className={s.footin}>
            <span>{foot.copyright}</span>
            <span>
              {foot.links.map((l) => (
                <Link key={l.label} href={L(l.href)} style={{ marginLeft: 14 }}>
                  {l.label}
                </Link>
              ))}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
