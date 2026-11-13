"use client";

// The second click. The reason and note are optional and never block: an
// empty form submits exactly like a filled one.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CANCEL_NOTE_MAX } from "@/lib/billing/cancel-reasons";

export interface CancelFormCopy {
  reasonLabel: string;
  reasonPlaceholder: string;
  noteLabel: string;
  confirm: string;
  busy: string;
  keep: string;
  error: string;
}

export function CancelForm({
  reasons,
  copy,
}: {
  reasons: { value: string; label: string }[];
  copy: CancelFormCopy;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason || undefined, note: note || undefined }),
      });
      if (!res.ok) throw new Error("cancel failed");
      router.push("/billing?cancelled=1");
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" data-testid="billing-cancel-form">
      <div className="space-y-1.5">
        <label htmlFor="cancel-reason" className="block text-sm font-medium text-gray-700">
          {copy.reasonLabel}
        </label>
        <select
          id="cancel-reason"
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{copy.reasonPlaceholder}</option>
          {reasons.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="cancel-note" className="block text-sm font-medium text-gray-700">
          {copy.noteLabel}
        </label>
        <textarea
          id="cancel-note"
          name="note"
          rows={3}
          maxLength={CANCEL_NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" loading={busy} data-testid="billing-cancel-confirm">
          {busy ? copy.busy : copy.confirm}
        </Button>
        <Link href="/billing" className="text-sm font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900">
          {copy.keep}
        </Link>
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {copy.error}
        </p>
      )}
    </form>
  );
}
