"use client";

// Reddit Threads Finder. One POST, one list.

import { useState } from "react";
import f from "../_shared/free-tools.module.css";

interface Thread {
  id: string;
  title: string;
  subreddit: string;
  score: number;
  comments: number;
  ageSeconds: number;
  permalink: string;
}

/** "3 months ago" from a second count — no date library needed for this. */
function age(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months <= 1 ? "1 month ago" : `${months} months ago`;
}

export function RedditThreadsClient() {
  const [keyword, setKeyword] = useState("");
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/free/v1/reddit-threads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyword }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Try again.");
        setThreads(null);
        return;
      }
      setThreads(data.threads ?? []);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={f.panel}>
      <form onSubmit={search} className={f.row}>
        <div className={f.grow}>
          <label className={f.label} htmlFor="rt-keyword">Keyword</label>
          <input
            id="rt-keyword"
            className={f.input}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="best project management software"
          />
        </div>
        <button className={f.deviceTab} type="submit" disabled={busy || keyword.trim().length < 2}>
          {busy ? "Searching…" : "Find threads"}
        </button>
      </form>

      {error && <p className={f.error}>{error}</p>}

      {threads && threads.length === 0 && (
        <p className={f.note}>No Reddit threads found for that keyword in the last year.</p>
      )}

      {threads && threads.length > 0 && (
        <div className={f.results}>
          {threads.map((t) => (
            <div className={f.result} key={t.id}>
              <p className={f.resultH}>
                <a className={f.resultLink} href={t.permalink} target="_blank" rel="noopener noreferrer">
                  {t.title}
                </a>
              </p>
              <p className={f.resultMeta}>
                r/{t.subreddit} · {t.score} points · {t.comments} comments · {age(t.ageSeconds)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
