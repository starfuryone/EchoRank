"use client";
import { useState } from "react";
import Link from "next/link";
import s from "./guide-ia.module.css";

const T = {
  fr: {
    f1: "Recherches mensuelles pertinentes dans votre zone", s1: "recherches / mois",
    f2: "Taux de conversion d'un prospect en client", f3: "Valeur moyenne d'un client", s3: "$ ou €",
    f4: "Part estimée des recommandations qui vous échappent",
    out: "Revenus potentiellement perdus :", per: "par mois",
    note: "Calcul transparent : recherches × part perdue × taux de conversion × valeur client. Une estimation pour dimensionner l'enjeu, pas une prévision.",
    ctaTitle: "Remplacez l'estimation par une mesure",
    ctaSub: "L'audit EchoRank identifie où et pourquoi les IA vous ignorent.",
    ctaBtn: "Lancer mon audit IA →", locale: "fr-CA",
  },
  en: {
    f1: "Relevant monthly searches in your area", s1: "searches / month",
    f2: "Prospect-to-customer conversion rate", f3: "Average customer value", s3: "$ or €",
    f4: "Estimated share of recommendations you are missing",
    out: "Revenue potentially lost:", per: "per month",
    note: "Transparent math: searches × missed share × conversion rate × customer value. An estimate to size the stakes, not a forecast.",
    ctaTitle: "Replace the estimate with a measurement",
    ctaSub: "The EchoRank audit identifies exactly where and why AI systems ignore you.",
    ctaBtn: "Run my AI audit →", locale: "en-CA",
  },
};

function Field({ label, value, onChange, suffix }: { label: string; value: number; onChange: (n: number) => void; suffix: string }) {
  return (
    <label style={{ display: "block", marginTop: 14, fontSize: 14 }}>
      <span style={{ display: "block", color: "rgba(17,17,17,.65)" }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        <input type="number" min={0} value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ width: 140, padding: "9px 10px", border: ".5px solid rgba(17,17,17,.25)", borderRadius: 8, fontSize: 15 }} />
        <span style={{ color: "rgba(17,17,17,.55)", fontSize: 13 }}>{suffix}</span>
      </span>
    </label>
  );
}

export default function RevenueCalculator({ lang = "fr" }: { lang?: "fr" | "en" }) {
  const t = T[lang];
  const [searches, setSearches] = useState(200);
  const [conversion, setConversion] = useState(3);
  const [value, setValue] = useState(250);
  const [lost, setLost] = useState(30);
  const monthly = Math.max(0, searches) * (Math.max(0, lost) / 100) * (Math.max(0, conversion) / 100) * Math.max(0, value);
  const fmt = new Intl.NumberFormat(t.locale, { maximumFractionDigits: 0 });
  return (
    <div style={{ marginTop: 18, padding: "20px 22px", border: ".5px solid rgba(17,17,17,.14)", borderRadius: 12 }}>
      <Field label={t.f1} value={searches} onChange={setSearches} suffix={t.s1} />
      <Field label={t.f2} value={conversion} onChange={setConversion} suffix="%" />
      <Field label={t.f3} value={value} onChange={setValue} suffix={t.s3} />
      <Field label={t.f4} value={lost} onChange={setLost} suffix="%" />
      <p style={{ marginTop: 20, fontSize: 18, fontWeight: 650 }}>{t.out} {fmt.format(monthly)} {t.per}</p>
      <p style={{ marginTop: 6, fontSize: 12, color: "rgba(17,17,17,.55)" }}>{t.note}</p>
      <div className={s.ctaBand}>
        <span className={s.ctaText}><b>{t.ctaTitle}</b><span>{t.ctaSub}</span></span>
        <Link href="/register" className={s.ctaBtn}>{t.ctaBtn}</Link>
      </div>
    </div>
  );
}
// EOF-calculator
