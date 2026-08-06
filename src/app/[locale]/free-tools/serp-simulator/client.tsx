"use client";

// SERP Simulator — pixel-accurate snippet preview, entirely client-side.
//
// The white snippet box is deliberately light against the dark page: it is a
// preview of Google, not of us, and rendering it in our own palette would
// misrepresent what a searcher sees.

import { useMemo, useState } from "react";
import { previewSnippet } from "@/lib/free-tools/serp-preview";
import f from "../_shared/free-tools.module.css";

export function SerpSimulatorClient() {
  const [title, setTitle] = useState("Best running shoes for beginners in 2026");
  const [description, setDescription] = useState(
    "We tested 40 pairs over six months. Here are the five that held up, what they cost, and who each one suits.",
  );
  const [url, setUrl] = useState("https://example.com/running-shoes/beginners");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const preview = useMemo(
    () => previewSnippet({ title, description, url }, device),
    [title, description, url, device],
  );

  return (
    <div className={f.panel}>
      <div>
        <label className={f.label} htmlFor="ss-title">Title tag</label>
        <input id="ss-title" className={f.input} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div style={{ marginTop: 14 }}>
        <label className={f.label} htmlFor="ss-url">Page URL</label>
        <input id="ss-url" className={f.input} value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>

      <div style={{ marginTop: 14 }}>
        <label className={f.label} htmlFor="ss-desc">Meta description</label>
        <textarea
          id="ss-desc"
          className={f.textarea}
          style={{ minHeight: 110 }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div style={{ marginTop: 22 }}>
        <div className={f.deviceTabs}>
          {(["desktop", "mobile"] as const).map((d) => (
            <button
              key={d}
              type="button"
              className={`${f.deviceTab} ${device === d ? f.deviceTabOn : ""}`}
              onClick={() => setDevice(d)}
              aria-current={device === d ? "true" : undefined}
            >
              {d === "desktop" ? "Desktop" : "Mobile"}
            </button>
          ))}
        </div>

        <div className={f.snippet}>
          <p className={f.snippetCrumb}>{preview.breadcrumb}</p>
          <p className={f.snippetTitle}>{preview.title.display}</p>
          <p className={f.snippetDesc}>{preview.description.display}</p>
        </div>

        <p className={f.note}>
          Title {preview.title.width}px of {preview.title.limit}px
          {preview.title.truncated ? " — truncated" : " — fits"} · Description{" "}
          {preview.description.width}px of {preview.description.limit}px
          {preview.description.truncated ? " — truncated" : " — fits"}
        </p>
      </div>
    </div>
  );
}
