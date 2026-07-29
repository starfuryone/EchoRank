"use client";

// The compact AI Lens section inside the /visibility audit results.
//
// The AI Visibility audit says whether engines are ALLOWED to read your site;
// this says whether there is anything there to read once they do. They belong
// next to each other.
//
// IT DOES NOT AUTO-RUN. A render costs one of the tenant's monthly analyses
// (10 on STARTER), and spending one every time somebody looks at an audit would
// quietly eat a third of the allowance for anyone auditing daily. So on mount it
// only LOOKS for a result already in the 24 h window — a free read of the history
// the tool already exposes — and otherwise offers a button. Same API either way,
// no new endpoint, and nothing spent without a click.

import { useCallback, useEffect, useState } from "react";
import { Loader2, ScanEye } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AiLensResult } from "@/components/seo-tools/ai-lens-result";
import { AI_LENS_CACHE_TTL_MS } from "@/lib/ai-lens/options";
import { AI_LENS_COPY, SEO_TOOLS_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import type { AiLensAnalysisDto, AiLensHistoryRow } from "@/lib/ai-lens/types";

const API = "/api/seo/v1/ai-lens";

/** The audited site's homepage. Audit urls arrive both bare and fully qualified. */
function homepageOf(auditUrl: string): string | null {
  try {
    const withScheme = /^https?:\/\//i.test(auditUrl) ? auditUrl : `https://${auditUrl}`;
    const parsed = new URL(withScheme);
    if (!parsed.hostname.includes(".")) return null;
    return `${parsed.protocol}//${parsed.hostname}/`;
  } catch {
    return null;
  }
}

export function AiLensAuditPanel({
  locale,
  auditUrl,
}: {
  locale: DashLocale;
  auditUrl: string;
}) {
  const t = AI_LENS_COPY[locale];
  const it = SEO_TOOLS_COPY[locale].items.ai_lens;
  const homepage = homepageOf(auditUrl);

  const [analysis, setAnalysis] = useState<AiLensAnalysisDto | null>(null);
  // Derived from the URL rather than set in the effect: with no parseable
  // homepage there is nothing to look up, and setting state synchronously inside
  // the effect to say so is the render-phase write the compiler rejects.
  const [looking, setLooking] = useState(() => homepageOf(auditUrl) !== null);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);

  const loadById = useCallback(async (id: string) => {
    const res = await fetch(`${API}/${id}`);
    if (!res.ok) return null;
    const body = await res.json();
    return body.analysis as AiLensAnalysisDto;
  }, []);

  // Free lookup: is there already a fresh analysis of this homepage?
  useEffect(() => {
    if (!homepage) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/history`);
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { analyses: AiLensHistoryRow[] };
        const cutoff = Date.now() - AI_LENS_CACHE_TTL_MS;
        const hit = body.analyses.find(
          (row) => row.url === homepage && Date.parse(row.createdAt) >= cutoff,
        );
        if (hit && !cancelled) {
          const full = await loadById(hit.id);
          if (full && !cancelled) setAnalysis(full);
        }
      } catch {
        // Non-critical panel: absence of a cached result and a failed lookup
        // both land on the same "run it?" state.
      } finally {
        if (!cancelled) setLooking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [homepage, loadById]);

  async function run() {
    if (!homepage || running) return;
    setRunning(true);
    setFailed(false);
    try {
      const res = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: homepage }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.analysis) {
        setFailed(true);
        return;
      }
      setAnalysis(body.analysis as AiLensAnalysisDto);
    } catch {
      setFailed(true);
    } finally {
      setRunning(false);
    }
  }

  if (!homepage || looking) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ScanEye className="h-4 w-4 text-blue-600" aria-hidden="true" />
          <h3 className="text-base font-semibold text-gray-900">{it.name}</h3>
        </div>
        <p className="mt-1 text-sm text-gray-500">{it.description}</p>
      </CardHeader>
      <CardContent>
        {analysis ? (
          <AiLensResult analysis={analysis} locale={locale} compact />
        ) : running ? (
          <div className="flex flex-col items-center py-8 text-center">
            <Loader2 className="mb-3 h-7 w-7 animate-spin text-blue-500" aria-hidden="true" />
            <p className="text-sm text-gray-600">{t.progressRaw}</p>
            <p className="text-sm text-gray-600">{t.progressRender}</p>
            <p className="mt-2 text-xs text-gray-400">{t.progressNote}</p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-sm text-gray-600">{t.formIntro}</p>
            <Button variant="outline" size="sm" onClick={() => void run()}>
              {t.submit}
            </Button>
          </div>
        )}
        {failed && <p className="mt-3 text-sm text-red-600">{t.failedBody}</p>}
      </CardContent>
    </Card>
  );
}
