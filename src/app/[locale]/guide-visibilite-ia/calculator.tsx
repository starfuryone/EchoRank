"use client";
import { useState } from "react";
import Link from "next/link";
import s from "./guide-ia.module.css";

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

export default function RevenueCalculator() {
  const [searches, setSearches] = useState(200);
  const [conversion, setConversion] = useState(3);
  const [value, setValue] = useState(250);
  const [lost, setLost] = useState(30);
  const monthly = Math.max(0, searches) * (Math.max(0, lost) / 100) * (Math.max(0, conversion) / 100) * Math.max(0, value);
  const fmt = new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 0 });
  return (
    <div style={{ marginTop: 18, padding: "20px 22px", border: ".5px solid rgba(17,17,17,.14)", borderRadius: 12 }}>
      <Field label="Recherches mensuelles pertinentes dans votre zone" value={searches} onChange={setSearches} suffix="recherches / mois" />
      <Field label="Taux de conversion d'un prospect en client" value={conversion} onChange={setConversion} suffix="%" />
      <Field label="Valeur moyenne d'un client" value={value} onChange={setValue} suffix="$ ou €" />
      <Field label="Part estimée des recommandations qui vous échappent" value={lost} onChange={setLost} suffix="%" />
      <p style={{ marginTop: 20, fontSize: 18, fontWeight: 650 }}>Revenus potentiellement perdus : {fmt.format(monthly)} par mois</p>
      <p style={{ marginTop: 6, fontSize: 12, color: "rgba(17,17,17,.55)" }}>Calcul transparent : recherches × part perdue × taux de conversion × valeur client. Une estimation pour dimensionner l'enjeu, pas une prévision.</p>
      <div className={s.ctaBand}>
        <span className={s.ctaText}><b>Remplacez l'estimation par une mesure</b><span>L'audit EchoRank identifie où et pourquoi les IA vous ignorent.</span></span>
        <Link href="/register" className={s.ctaBtn}>Lancer mon audit IA →</Link>
      </div>
    </div>
  );
}
// EOF-calculator
