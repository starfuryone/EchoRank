"use client";
import { useState } from "react";
import Link from "next/link";
import s from "./guide-ia.module.css";

const ITEMS = {
  fr: [
    "Site en HTTPS avec certificat valide",
    "Fiche Google active avec avis récents",
    "Données structurées Schema.org (LocalBusiness, FAQ)",
    "Page FAQ répondant aux vraies questions des clients",
    "Robots.txt qui autorise les robots des IA (GPTBot, ClaudeBot, PerplexityBot, Google-Extended)",
    "Sitemap XML à jour et déclaré",
    "Mentions dans la presse ou des médias locaux",
    "Citations locales (annuaires, chambres de commerce)",
    "NAP cohérent (nom, adresse, téléphone identiques partout)",
    "Pages de services distinctes et détaillées",
  ],
  en: [
    "HTTPS site with a valid certificate",
    "Active Google Business Profile with recent reviews",
    "Schema.org structured data (LocalBusiness, FAQ)",
    "FAQ page answering real customer questions",
    "Robots.txt that allows AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended)",
    "Up-to-date, declared XML sitemap",
    "Mentions in press or local media",
    "Consistent local citations (directories, chambers of commerce)",
    "Consistent NAP (identical name, address, phone everywhere)",
    "Distinct, detailed service pages",
  ],
};
const COPY = {
  fr: {
    score: "Votre score :",
    full: "Excellente base. Le suivi quotidien devient votre prochain levier.",
    partial: "Chaque case vide est un point que les IA vérifient et que vos concurrents peuvent cocher avant vous.",
    ctaTitle: "Analysez automatiquement ces critères avec Echorank",
    ctaSub: "Score de visibilité IA sur 100 et feuille de route en moins de 60 secondes.",
    ctaBtn: "Évaluer mon entreprise →",
  },
  en: {
    score: "Your score:",
    full: "Excellent foundation. Daily monitoring becomes your next lever.",
    partial: "Every empty box is something AI systems check, and something your competitors can tick before you do.",
    ctaTitle: "Check these criteria automatically with Echorank",
    ctaSub: "AI visibility score out of 100 and a fix roadmap in under 60 seconds.",
    ctaBtn: "Assess my business →",
  },
};

export default function Checklist({ lang = "fr" }: { lang?: "fr" | "en" }) {
  const items = ITEMS[lang];
  const t = COPY[lang];
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false));
  const score = checked.filter(Boolean).length;
  return (
    <div>
      <ul style={{ listStyle: "none", padding: 0, marginTop: 14 }}>
        {items.map((label, i) => (
          <li key={i} style={{ marginTop: 10 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", fontSize: 15, lineHeight: 1.6 }}>
              <input type="checkbox" checked={checked[i]}
                onChange={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
                style={{ marginTop: 4, accentColor: "#c9971c" }} />
              <span>{label}</span>
            </label>
          </li>
        ))}
      </ul>
      <p style={{ marginTop: 18, fontSize: 17, fontWeight: 650 }}>{t.score} {score} / {items.length}</p>
      <p style={{ marginTop: 6, fontSize: 14, color: "rgba(17,17,17,.65)" }}>{score === items.length ? t.full : t.partial}</p>
      <div className={s.ctaBand}>
        <span className={s.ctaText}><b>{t.ctaTitle}</b><span>{t.ctaSub}</span></span>
        <Link href="/register" className={s.ctaBtn}>{t.ctaBtn}</Link>
      </div>
    </div>
  );
}
// EOF-checklist
