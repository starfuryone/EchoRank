"use client";

// Share of Search. Two to five brands, one country, one bar per brand.

import { useState } from "react";
import { SERP_LOCATION_CODES } from "@/lib/serp/options";
import {
  FREE_LOCATION_LABELS,
  MAX_BRANDS,
  MIN_BRANDS,
} from "@/lib/free-tools/public-constants";
import f from "../_shared/free-tools.module.css";

interface Row {
  brand: string;
  volume: number;
  share: number;
  monthly: { year: number; month: number; volume: number }[] | null;
}

/**
 * Fill class by rank, leader first.
 *
 * Five entries because MAX_BRANDS is five; the array is indexed by position
 * after sorting, so the biggest brand is always gold. Colours live in the CSS
 * module rather than here so the marketing theme keeps one palette.
 */
const BRAND_FILL = [
  f.brandFill1,
  f.brandFill2,
  f.brandFill3,
  f.brandFill4,
  f.brandFill5,
];

/**
 * Biggest share first.
 *
 * The API answers in the order the visitor typed the brands, which is the right
 * contract for it to have — but "who leads" is the question this tool exists to
 * answer, and it should not depend on which box someone filled in first. Sorted
 * here rather than server-side so the route's response stays a faithful echo of
 * the request. A copy, not a sort in place: `rows` is state.
 */
function ranked(rows: Row[]): Row[] {
  return [...rows].sort((a, b) => b.share - a.share);
}

export function ShareOfSearchClient() {
  const [brands, setBrands] = useState<string[]>(["", ""]);
  const [locationCode, setLocationCode] = useState(2840);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = brands.map((b) => b.trim()).filter(Boolean);
  const ordered = rows ? ranked(rows) : null;

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/free/v1/share-of-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brands: filled, locationCode }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Try again.");
        setRows(null);
        return;
      }
      setRows(data.brands ?? []);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={f.panel}>
      <form onSubmit={run}>
        <label className={f.label}>Brands ({MIN_BRANDS}–{MAX_BRANDS})</label>
        <div style={{ display: "grid", gap: 10 }}>
          {brands.map((brand, i) => (
            <input
              key={i}
              className={f.input}
              value={brand}
              aria-label={`Brand ${i + 1}`}
              placeholder={i === 0 ? "nike" : "adidas"}
              onChange={(e) => {
                const next = [...brands];
                next[i] = e.target.value;
                setBrands(next);
              }}
            />
          ))}
        </div>

        {brands.length < MAX_BRANDS && (
          <button
            type="button"
            className={f.deviceTab}
            style={{ marginTop: 10 }}
            onClick={() => setBrands([...brands, ""])}
          >
            + Add brand
          </button>
        )}

        <div className={f.row} style={{ marginTop: 16 }}>
          <div style={{ flex: "0 0 190px" }}>
            <label className={f.label} htmlFor="sos-location">Country</label>
            <select
              id="sos-location"
              className={f.select}
              value={locationCode}
              onChange={(e) => setLocationCode(Number(e.target.value))}
            >
              {SERP_LOCATION_CODES.map((code) => (
                <option key={code} value={code}>{FREE_LOCATION_LABELS[code] ?? code}</option>
              ))}
            </select>
          </div>
          <button className={f.deviceTab} type="submit" disabled={busy || filled.length < MIN_BRANDS}>
            {busy ? "Comparing…" : "Compare"}
          </button>
        </div>
      </form>

      {error && <p className={f.error}>{error}</p>}

      {ordered && ordered.length > 0 && (
        <div className={f.sosRows}>
          {ordered.map((row, i) => (
            <div className={f.sosRow} key={row.brand}>
              <div className={f.sosHead}>
                <span className={`${f.sosBrand} ${i === 0 ? f.sosBrandLead : ""}`}>{row.brand}</span>
                {i === 0 && row.share > 0 && (
                  <span className={`${f.chip} ${f.chipLeader}`}>Leads the category</span>
                )}
                <span className={f.sosVolume}>{row.volume.toLocaleString()}/mo</span>
              </div>
              <div className={f.sosMeter}>
                <span className={f.barTrack}>
                  <span
                    className={`${f.barFill} ${BRAND_FILL[i] ?? ""}`}
                    /* Floored at 2% for the same reason the volatility bars
                       are: a real brand with a 0.4% share should read as a
                       sliver, not as nothing at all. */
                    style={{ width: `${Math.max(2, row.share)}%` }}
                  />
                </span>
                <span className={f.sosShare}>{row.share}%</span>
              </div>
            </div>
          ))}
          <p className={f.note}>
            Monthly search volume: {ordered.map((r) => `${r.brand} ${r.volume.toLocaleString()}`).join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}
