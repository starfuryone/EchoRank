"use client";

// The free crawl's progress: polls GET /api/free/v1/site-crawler/<token> and
// shows the queue position, then pages crawled of the cap. `onDone` runs once
// when the crawl has ended (any terminal status).

import { useEffect, useRef, useState } from "react";
import { FREE_CRAWLER_COPY, freeBase } from "@/lib/site-crawler/free-copy";
import f from "../_shared/free-tools.module.css";

const POLL_MS = 3000;
const TERMINAL = new Set(["completed", "failed", "cancelled"]);

interface Status {
  status: string;
  pagesCrawled: number;
  urlCap: number;
  queuePosition: number | null;
}

export function FreeCrawlProgress({ token, locale, reused, onDone }: { token: string; locale: string; reused?: boolean; onDone: (status: string) => void }) {
  const c = FREE_CRAWLER_COPY[freeBase(locale)].progress;
  const [st, setSt] = useState<Status | null>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const res = await fetch(`/api/free/v1/site-crawler/${encodeURIComponent(token)}`, { cache: "no-store" });
        if (stop) return;
        if (res.ok) {
          const s = (await res.json()) as Status;
          if (stop) return;
          setSt(s);
          if (TERMINAL.has(s.status)) {
            done.current(s.status);
            return;
          }
        }
      } catch {
        /* a dropped poll is retried */
      }
      if (!stop) timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [token]);

  const pct = st && st.urlCap > 0 ? Math.min(100, Math.round((st.pagesCrawled / st.urlCap) * 100)) : 0;
  const line = !st
    ? c.queued(null)
    : st.status === "queued"
      ? c.queued(st.queuePosition)
      : st.status === "crawling"
        ? c.crawling(st.pagesCrawled, st.urlCap)
        : st.status === "completed"
          ? c.done
          : c.failed;

  return (
    <div className={f.panel} data-testid="free-crawl-progress">
      <h2 className={f.resultH}>{c.title}</h2>
      {reused && <p className={f.note}>{c.reused}</p>}
      <p role="status" aria-live="polite" style={{ margin: "10px 0" }}>
        {line}
      </p>
      <span className={f.barTrack} aria-hidden="true" style={{ display: "block" }}>
        <span className={f.barFill} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}
