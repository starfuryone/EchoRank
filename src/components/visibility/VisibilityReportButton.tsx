"use client";

import { useEffect, useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * "Download PDF report" for the AI Visibility dashboard. Shown only once the
 * tenant has audit or prompt data (probed via GET /api/ai/visibility/report).
 * The click POSTs to the same route, which assembles the tenant's real data
 * server-side and streams back a PDF — no tenant id is ever sent from here.
 */
export function VisibilityReportButton() {
  const [available, setAvailable] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    let alive = true;
    fetch("/api/ai/visibility/report", { method: "GET" })
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then((d) => alive && setAvailable(Boolean(d?.available)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function download() {
    if (status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/ai/visibility/report", { method: "POST" });
      if (!res.ok) throw new Error(`report failed: ${res.status}`);
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const m = /filename="?([^"]+)"?/.exec(cd);
      const name = m ? m[1] : "Echorank-360-AI-Visibility-Report.pdf";
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

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" onClick={download} disabled={status === "loading"}>
        <FileDown className="mr-1.5 h-4 w-4" />
        {status === "loading" ? "Generating…" : "Download PDF report"}
      </Button>
      {status === "error" && (
        <button
          type="button"
          onClick={download}
          className="text-xs text-red-500 hover:underline"
        >
          Report failed — try again
        </button>
      )}
    </div>
  );
}
