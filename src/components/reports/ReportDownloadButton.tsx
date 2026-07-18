"use client";

import { useEffect, useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Reusable "Download PDF report" button for authenticated dashboard reports.
 *
 * Probes `endpoint` with GET and renders nothing until it reports {available:true}
 * (so it stays hidden when the tenant has no data or lacks the feature/plan — the
 * route's own requireTenant()/requireFeature()/requirePlan() gating decides). A
 * click POSTs to the same endpoint, which assembles the tenant's real data
 * server-side and streams back a PDF — no tenant id is ever sent from here.
 *
 * Used by /visibility, /monitoring and /intelligence via a thin per-surface
 * wrapper (see VisibilityReportButton) or directly with an `endpoint` prop.
 */

type Loc = "en" | "fr" | "de-CH";

const LABELS: Record<Loc, { download: string; loading: string; retry: string }> = {
  en: {
    download: "Download PDF report",
    loading: "Generating…",
    retry: "Report failed — try again",
  },
  // fr covers fr and fr-CA (faithful French)
  fr: {
    download: "Télécharger le rapport PDF",
    loading: "Génération…",
    retry: "Échec du rapport — réessayer",
  },
  // Swiss German — faithful, and "ss" is used, never "ß"
  "de-CH": {
    download: "PDF-Bericht herunterladen",
    loading: "Wird erstellt…",
    retry: "Bericht fehlgeschlagen — erneut versuchen",
  },
};

/** Map the echorank_locale cookie to a label set. fr* → fr, de-CH → de-CH, else en. */
function localeFromCookie(): Loc {
  if (typeof document === "undefined") return "en";
  const m = /(?:^|;\s*)echorank_locale=([^;]+)/.exec(document.cookie);
  const v = m ? decodeURIComponent(m[1]) : "";
  if (v.startsWith("fr")) return "fr";
  if (v === "de-CH") return "de-CH";
  return "en";
}

export function ReportDownloadButton({
  endpoint,
  className,
}: {
  endpoint: string;
  className?: string;
}) {
  const [available, setAvailable] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [loc, setLoc] = useState<Loc>("en");

  useEffect(() => {
    setLoc(localeFromCookie());
    let alive = true;
    fetch(endpoint, { method: "GET" })
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then((d) => alive && setAvailable(Boolean(d?.available)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [endpoint]);

  async function download() {
    if (status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) throw new Error(`report failed: ${res.status}`);
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const m = /filename="?([^"]+)"?/.exec(cd);
      const name = m ? m[1] : "Echorank-360-Report.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  if (!available) return null;

  const t = LABELS[loc];

  return (
    <div className={`flex flex-col items-end gap-1 ${className ?? ""}`}>
      <Button variant="outline" onClick={download} disabled={status === "loading"}>
        <FileDown className="mr-1.5 h-4 w-4" />
        {status === "loading" ? t.loading : t.download}
      </Button>
      {status === "error" && (
        <button
          type="button"
          onClick={download}
          className="text-xs text-red-500 hover:underline"
        >
          {t.retry}
        </button>
      )}
    </div>
  );
}
