"use client";

// SERP Location Changer. Posts a standard-queue task, then polls until the
// existing sweep completes it — the crawl outlives the page view, so nothing
// here depends on the tab staying open beyond the poll.

import { useCallback, useEffect, useState } from "react";
import { SERP_LOCATION_CODES } from "@/lib/serp/options";
import {
  FREE_LOCATION_LABELS,
  FREE_VISIBLE_POSITIONS,
} from "@/lib/free-tools/public-constants";
import f from "../_shared/free-tools.module.css";

const POLL_MS = 5_000;

interface Item {
  position: number;
  title: string;
  url: string;
  domain: string;
  description: string | null;
  locked: boolean;
}

export function SerpLocationClient() {
  const [keyword, setKeyword] = useState("");
  const [locationCode, setLocationCode] = useState(2840);
  const [checkId, setCheckId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const poll = useCallback(async (id: string) => {
    const res = await fetch(`/api/free/v1/serp-location/${id}`);
    if (!res.ok) return null;
    return res.json();
  }, []);

  useEffect(() => {
    if (!checkId || status === "completed" || status === "failed") return;
    const timer = setInterval(async () => {
      const data = await poll(checkId);
      if (!data) return;
      setStatus(data.status);
      if (data.status === "completed") setItems(data.results ?? []);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [checkId, status, poll]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setItems(null);
    try {
      const res = await fetch("/api/free/v1/serp-location", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyword, locationCode }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Try again.");
        return;
      }
      setCheckId(data.id);
      setStatus(data.status ?? "queued");
      if (data.results) setItems(data.results);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const waiting = checkId && status !== "completed" && status !== "failed" && !items;

  return (
    <div className={f.panel}>
      <form onSubmit={start} className={f.row}>
        <div className={f.grow}>
          <label className={f.label} htmlFor="sl-keyword">Keyword</label>
          <input
            id="sl-keyword"
            className={f.input}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="running shoes"
          />
        </div>
        <div style={{ flex: "0 0 190px" }}>
          <label className={f.label} htmlFor="sl-location">Country</label>
          <select
            id="sl-location"
            className={f.select}
            value={locationCode}
            onChange={(e) => setLocationCode(Number(e.target.value))}
          >
            {SERP_LOCATION_CODES.map((code) => (
              <option key={code} value={code}>{FREE_LOCATION_LABELS[code] ?? code}</option>
            ))}
          </select>
        </div>
        <button className={f.deviceTab} type="submit" disabled={busy || keyword.trim().length < 2}>
          {busy ? "Starting…" : "Check results"}
        </button>
      </form>

      {error && <p className={f.error}>{error}</p>}

      {waiting && (
        <p className={f.note}>
          Queued with our data provider — this usually takes a few minutes. The results appear here
          automatically; you can leave this page and come back.
        </p>
      )}

      {status === "failed" && (
        <p className={f.error}>That check did not complete. Try again in a few minutes.</p>
      )}

      {items && items.length > 0 && (
        <div className={f.results}>
          {items.map((item) =>
            item.locked ? (
              // The server withheld this row's data entirely — there is nothing
              // in the payload to reveal.
              <div className={`${f.result} ${f.locked}`} key={item.position}>
                <p className={f.resultMeta}>#{item.position}</p>
                <div className={f.lockedBar} />
                <div className={f.lockedBar} />
              </div>
            ) : (
              <div className={f.result} key={item.position}>
                <p className={f.resultH}>
                  #{item.position} · {item.title}
                </p>
                <p className={f.resultMeta}>{item.domain}</p>
              </div>
            ),
          )}
          <p className={f.note}>
            Positions {FREE_VISIBLE_POSITIONS + 1}–10 are part of a paid plan.
          </p>
        </div>
      )}
    </div>
  );
}
