"use client";

// The widget itself. Runs inside a sandboxed iframe on an agency's site.
//
// ── Inline styles, not Tailwind, and that is on purpose ────────────────────
// Every other component in this app uses the shared utility classes. This one
// cannot: the visual contract is "themed ONLY from branding", and a Tailwind
// class carries our design tokens — our greys, our radii, our type scale — into
// a frame that is supposed to look like the agency's. Inline styles derived
// from `branding.accentColor` are what make the page genuinely neutral. It also
// means the widget does not depend on globals.css being loaded in the frame.
//
// ── The submit goes to the PARENT, not to our API ──────────────────────────
// postMessage up, result back down. The parent issues the actual request so the
// browser sets Origin to the agency's own origin, which is what the server's
// allowlist checks. Full reasoning: src/app/api/public/funnel/audit/route.ts.
//
// NO BRAND STRING ANYWHERE IN THIS FILE. Asserted in tests/funnel.test.ts.

import { useCallback, useEffect, useRef, useState } from "react";
import type { EmbedAuditCopy } from "@/lib/i18n/dashboard";
import type { FunnelBranding } from "@/lib/funnel/branding";

interface Gap {
  category: string;
  status: string;
  recommendation: string;
  lost: number;
}

interface AuditResult {
  domain: string;
  score: number;
  grade: string;
  gaps: Gap[];
}

type Status = "idle" | "running" | "done" | "error";

/** What the parent relays back after it has called the API. */
interface ResultMessage {
  t: "audit-funnel:result";
  k: string;
  status: number;
  data: Record<string, unknown>;
}

function isResultMessage(value: unknown, key: string): value is ResultMessage {
  if (typeof value !== "object" || value === null) return false;
  const msg = value as Record<string, unknown>;
  return msg.t === "audit-funnel:result" && msg.k === key && typeof msg.status === "number";
}

export function EmbedAuditClient({
  funnelKey,
  branding,
  c,
}: {
  funnelKey: string;
  branding: FunnelBranding;
  c: EmbedAuditCopy;
}) {
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<AuditResult | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // ── Height reporting ──────────────────────────────────────────────────────
  // The parent cannot measure inside a cross-origin frame, so the frame has to
  // tell it. A ResizeObserver rather than a one-shot on mount: the form is
  // short and the result is tall, and the frame would otherwise clip the score
  // it just revealed — which is the one moment the widget exists for.
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof window === "undefined" || window.parent === window) return;

    const report = () => {
      window.parent.postMessage(
        {
          t: "audit-funnel:height",
          k: funnelKey,
          // scrollHeight over getBoundingClientRect: margins on the last child
          // are inside the former and outside the latter, and the difference is
          // a few pixels of clipped text.
          h: Math.ceil(node.scrollHeight) + 8,
        },
        // The parent's origin is not known to this frame — it is whatever site
        // embedded us, which is exactly the set the SERVER validates. Targeting
        // "*" here leaks nothing: the payload is a pixel count.
        "*",
      );
    };

    report();
    const observer = new ResizeObserver(report);
    observer.observe(node);
    return () => observer.disconnect();
  }, [funnelKey, status, result]);

  // ── Result relay ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    function onMessage(event: MessageEvent) {
      // Only the window that embedded us may drive this widget. The origin is
      // not checked because it cannot be known here (see above) and because it
      // is checked where it matters — on the server, against the funnel's own
      // allowlist, using a header the page cannot forge.
      if (event.source !== window.parent) return;
      if (!isResultMessage(event.data, funnelKey)) return;

      const { status: httpStatus, data } = event.data;

      if (httpStatus === 200 && typeof data.score === "number") {
        setResult({
          domain: String(data.domain ?? ""),
          score: data.score,
          grade: String(data.grade ?? ""),
          gaps: Array.isArray(data.gaps) ? (data.gaps as Gap[]) : [],
        });
        setStatus("done");
        return;
      }

      // Every failure below leaves the form filled in, so a visitor who hit a
      // rate limit can retry without retyping.
      setStatus("error");
      if (httpStatus === 429) setError(c.errLimit);
      else if (data.error === "email_required") setError(c.errEmail);
      else if (data.error === "invalid_domain") setError(c.errDomain);
      else if (data.error === "audit_failed") setError(c.errAudit);
      else setError(c.errGeneric);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [funnelKey, c]);

  const submit = useCallback(() => {
    const d = domain.trim();
    const e = email.trim();
    if (!d || !e || status === "running") return;

    // Client-side checks are a COURTESY, not the gate. The server re-validates
    // both and is the only thing that decides whether a lead is captured — this
    // just saves a visitor a round trip on an obvious typo.
    if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(e)) {
      setStatus("error");
      setError(c.errEmail);
      return;
    }

    setStatus("running");
    setError("");

    if (typeof window === "undefined" || window.parent === window) {
      // Opened directly rather than embedded. There is no parent to issue the
      // request, and saying so plainly beats an indefinite spinner.
      setStatus("error");
      setError(c.errGeneric);
      return;
    }
    window.parent.postMessage(
      { t: "audit-funnel:submit", k: funnelKey, email: e, domain: d },
      "*",
    );
  }, [domain, email, status, funnelKey, c]);

  const accent = branding.accentColor;

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    fontSize: "15px",
    lineHeight: "1.4",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    background: "#fff",
    color: "#0f172a",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    fontWeight: 600,
    marginBottom: "6px",
    color: "#334155",
  };

  return (
    <div
      ref={rootRef}
      style={{
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        color: "#0f172a",
        padding: "20px",
        maxWidth: "560px",
        margin: "0 auto",
      }}
    >
      {/*
        The logo is ALWAYS an <img>, never an inline <svg> and never an
        <object>. branding.logoDataUri is a document a customer pointed us at,
        and <img> is the one container in which browsers render SVG with
        scripting and external fetches disabled. See branding.ts.
      */}
      {(branding.logoDataUri || branding.name) && (
        <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
          {branding.logoDataUri && (
            // next/image is deliberately not used, and the lint rule is
            // suppressed rather than satisfied. The src is an inline data: URI
            // we produced server-side — there is no remote asset to optimise,
            // the loader would have to be told to pass it through untouched,
            // and routing it through /_next/image would put OUR path in the
            // markup on the agency's site. Plain <img> is also what keeps the
            // SVG non-scriptable; see branding.ts.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoDataUri}
              alt=""
              aria-hidden="true"
              style={{ height: "32px", width: "auto", maxWidth: "180px", display: "block" }}
            />
          )}
          {branding.name && (
            <span style={{ fontSize: "16px", fontWeight: 700, color: accent }}>
              {branding.name}
            </span>
          )}
        </div>
      )}

      {status !== "done" && (
        <>
          <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 8px" }}>{c.heading}</h2>
          <p style={{ fontSize: "14px", color: "#475569", margin: "0 0 18px", lineHeight: 1.5 }}>
            {c.intro}
          </p>

          <div style={{ marginBottom: "14px" }}>
            <label htmlFor="af-domain" style={labelStyle}>
              {c.domainLabel}
            </label>
            <input
              id="af-domain"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder={c.domainPlaceholder}
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              disabled={status === "running"}
              style={fieldStyle}
            />
          </div>

          <div style={{ marginBottom: "6px" }}>
            <label htmlFor="af-email" style={labelStyle}>
              {c.emailLabel}
            </label>
            <input
              id="af-email"
              type="email"
              autoComplete="email"
              placeholder={c.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              disabled={status === "running"}
              style={fieldStyle}
            />
          </div>
          {/*
            Stated BEFORE the button, not after the capture. The address is
            required to see the score and the visitor is told why while they can
            still decline.
          */}
          <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 16px" }}>{c.emailNote}</p>

          <button
            type="button"
            onClick={submit}
            disabled={status === "running" || !domain.trim() || !email.trim()}
            style={{
              width: "100%",
              padding: "12px 16px",
              fontSize: "15px",
              fontWeight: 600,
              color: "#fff",
              background: accent,
              border: "none",
              borderRadius: "6px",
              cursor: status === "running" ? "default" : "pointer",
              opacity: status === "running" || !domain.trim() || !email.trim() ? 0.6 : 1,
            }}
          >
            {status === "running" ? c.submitBusy : c.submitIdle}
          </button>

          {status === "error" && (
            <p role="alert" style={{ fontSize: "13px", color: "#b91c1c", margin: "12px 0 0" }}>
              {error}
            </p>
          )}
        </>
      )}

      {status === "done" && result && (
        <div>
          <p style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 4px" }}>
            {c.resultHeading
              .replace("{domain}", result.domain)
              .replace("{score}", String(result.score))}
          </p>
          <p style={{ fontSize: "14px", color: "#475569", margin: "0 0 18px" }}>
            {c.gradeLabel}: <strong style={{ color: accent }}>{result.grade}</strong>
          </p>

          {result.gaps.length > 0 ? (
            <>
              <h3 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 10px" }}>
                {c.gapsHeading}
              </h3>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 18px" }}>
                {result.gaps.map((gap) => (
                  <li
                    key={gap.category}
                    style={{
                      padding: "10px 12px",
                      marginBottom: "8px",
                      borderLeft: `3px solid ${accent}`,
                      background: "#f8fafc",
                      borderRadius: "4px",
                    }}
                  >
                    <div style={{ fontSize: "14px", fontWeight: 600 }}>
                      {gap.category}{" "}
                      <span style={{ fontWeight: 400, color: "#64748b" }}>
                        +{gap.lost} {c.gapsSuffix}
                      </span>
                    </div>
                    {gap.recommendation && (
                      <div style={{ fontSize: "13px", color: "#475569", marginTop: "4px" }}>
                        {gap.recommendation}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p style={{ fontSize: "14px", color: "#475569", margin: "0 0 18px" }}>{c.noGaps}</p>
          )}

          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setResult(null);
              setDomain("");
              setError("");
            }}
            style={{
              padding: "10px 14px",
              fontSize: "14px",
              fontWeight: 600,
              color: accent,
              background: "transparent",
              border: `1px solid ${accent}`,
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            {c.again}
          </button>
        </div>
      )}
    </div>
  );
}
