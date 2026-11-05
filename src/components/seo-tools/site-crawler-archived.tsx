"use client";

// "Archived — Restore" (CRAWL-ARCHIVE.md Phase 4): wherever a crawl whose rows
// are in the archive is shown — a History row, the results page in place of
// the tabs. Restore POSTs /api/seo/v1/crawl/[id]/restore, then polls GET
// /api/seo/v1/crawl/[id] every RESTORE_POLL_MS until the crawl is HOT again
// (a toast, and onRestored) or back to ARCHIVED (the restore failed: a toast,
// and the button again). Nothing here reads a crawl's pages.

import { useEffect, useRef, useState } from "react";
import { Archive, Loader2 } from "lucide-react";
import type { SiteCrawlerCopy } from "@/lib/i18n/dashboard";
import type { StorageState } from "@/lib/site-crawler/data-state";

export const RESTORE_POLL_MS = 5_000;
const TOAST_MS = 8_000;

type ArchiveCopy = SiteCrawlerCopy["archive"];

export function useRestore(crawlId: string, initial: StorageState, onRestored?: () => void) {
  const [state, setState] = useState<StorageState>(initial);
  const [toast, setToast] = useState<{ kind: "ok" | "error"; text: "restored" | "failed" | "unavailable" } | null>(null);
  const restoredRef = useRef(onRestored);
  useEffect(() => {
    restoredRef.current = onRestored;
  }, [onRestored]);

  useEffect(() => {
    if (state !== "RESTORING") return;
    const timer = setInterval(() => {
      void fetch(`/api/seo/v1/crawl/${crawlId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { storageState?: StorageState } | null) => {
          if (!d?.storageState || d.storageState === "RESTORING") return;
          setState(d.storageState);
          if (d.storageState === "HOT") {
            setToast({ kind: "ok", text: "restored" });
            restoredRef.current?.();
          } else if (d.storageState === "ARCHIVED") {
            setToast({ kind: "error", text: "failed" });
          }
        })
        .catch(() => undefined);
    }, RESTORE_POLL_MS);
    return () => clearInterval(timer);
  }, [state, crawlId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  async function restore() {
    if (state !== "ARCHIVED") return;
    setState("RESTORING");
    const res = await fetch(`/api/seo/v1/crawl/${crawlId}/restore`, { method: "POST" }).catch(() => null);
    const body = (res ? await res.json().catch(() => null) : null) as { storageState?: StorageState; code?: string } | null;
    if (res && (res.status === 202 || res.ok) && body?.storageState) {
      setState(body.storageState);
      if (body.storageState === "HOT") restoredRef.current?.();
      return;
    }
    setState(body?.code === "ARCHIVING" ? "ARCHIVING" : "ARCHIVED");
    setToast({ kind: "error", text: res?.status === 503 ? "unavailable" : "failed" });
  }

  return { state, toast, restore };
}

function Toast({ toast, a, host }: { toast: NonNullable<ReturnType<typeof useRestore>["toast"]>; a: ArchiveCopy; host: string }) {
  const text = toast.text === "restored" ? a.restored(host) : toast.text === "unavailable" ? a.unavailable : a.failed;
  return (
    <div
      role="status"
      data-testid="restore-toast"
      data-kind={toast.kind}
      className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg ${
        toast.kind === "ok" ? "bg-emerald-700 text-white" : "bg-red-700 text-white"
      }`}
    >
      {text}
    </div>
  );
}

/** The History row's badge + button. */
export function ArchivedBadge({ crawlId, storageState, host, a, onRestored }: { crawlId: string; storageState: StorageState; host: string; a: ArchiveCopy; onRestored?: () => void }) {
  const { state, toast, restore } = useRestore(crawlId, storageState, onRestored);
  return (
    <>
      {state === "ARCHIVED" && (
        <span className="inline-flex items-center gap-1" data-testid="archived-badge" data-state="ARCHIVED">
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{a.label}</span>
          <button
            type="button"
            onClick={() => void restore()}
            aria-label={a.restoreAria(host)}
            className="rounded px-2 py-1 text-sm font-medium text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {a.restore}
          </button>
        </span>
      )}
      {(state === "RESTORING" || state === "ARCHIVING") && (
        <span className="inline-flex items-center gap-1 text-xs text-gray-700" data-testid="archived-badge" data-state={state}>
          <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" focusable="false" />
          {state === "RESTORING" ? a.restoring : a.archiving}
        </span>
      )}
      {toast && <Toast toast={toast} a={a} host={host} />}
    </>
  );
}

/** The results page's panel, in place of the tabs that read rows. */
export function ArchivedPanel({ crawlId, storageState, host, a, onRestored }: { crawlId: string; storageState: StorageState; host: string; a: ArchiveCopy; onRestored?: () => void }) {
  const { state, toast, restore } = useRestore(crawlId, storageState, onRestored);
  if (state === "HOT") return toast ? <Toast toast={toast} a={a} host={host} /> : null;
  return (
    <section className="flex flex-col items-start gap-3 rounded-xl border border-gray-200 bg-white p-6" data-testid="archived-panel" data-state={state}>
      <div className="flex items-center gap-2">
        <Archive className="h-5 w-5 text-gray-600" aria-hidden="true" focusable="false" />
        <h2 className="text-base font-semibold text-gray-900">{a.panelTitle}</h2>
      </div>
      <p className="max-w-2xl text-sm text-gray-700">{state === "RESTORING" ? a.restoringBody : state === "ARCHIVING" ? a.archivingBody : a.panelBody}</p>
      {state === "ARCHIVED" ? (
        <button
          type="button"
          onClick={() => void restore()}
          aria-label={a.restoreAria(host)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          {a.restore}
        </button>
      ) : (
        <span className="inline-flex items-center gap-2 text-sm text-gray-700">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" focusable="false" />
          {state === "RESTORING" ? a.restoring : a.archiving}
        </span>
      )}
      {toast && <Toast toast={toast} a={a} host={host} />}
    </section>
  );
}
