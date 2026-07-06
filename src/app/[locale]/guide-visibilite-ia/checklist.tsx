"use client";

import { useState } from "react";
import Link from "next/link";
import s from "./guide-ia.module.css";

const ITEMS = [
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
];

export default function Checklist() {
  const [checked, setChecked] = useState<boolean[]>(() => ITEMS.map(() => false));
  const score = checked.filter(Boolean).length;

  return (
    <div>
      <ul style={{ listStyle: "none", padding: 0, marginTop: 14 }}>
        {ITEMS.map((label, i) => (
          <li key={i} style={{ marginTop: 10 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", fontSize: 15, lineHeight: 1.6 }}>
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
                style={{ marginTop: 4, accentColor: "#c9971c" }}
              />
              <span>{label}</span>
            </label>
          </li>
        ))}
      </ul>
      <p style={{ marginTop: 18, fontSize: 17, fontWeight: 650 }}>
        Votre score : {score} / {ITEMS.length}
      </p>
      <p style={{ marginTop: 6, fontSize: 14, color: "rgba(17,17,17,.65)" }}>
        {score === ITEMS.length
          ? "Excellente base. Le suivi quotidien devient votre prochain levier."
          : "Chaque case vide est un point que les IA vérifient et que vos concurrents peuvent cocher avant vous."}
      </p>
      <div className={s.ctaBand}>
        <span className={s.ctaText}>
          <b>Analysez automatiquement ces critères avec EchoRank</b>
          <span>Score de visibilité IA sur 100 et feuille de route en moins de 60 secondes.</span>
        </span>
        <Link href="/register" className={s.ctaBtn}>Évaluer mon entreprise →</Link>
      </div>
    </div>
  );
}
// EOF-checklist
