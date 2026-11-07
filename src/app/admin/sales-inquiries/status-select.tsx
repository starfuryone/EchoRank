"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["NEW", "CONTACTED", "CLOSED"] as const;

/** Changes one inquiry's status (PATCH /api/admin/sales-inquiries/[id]), then refreshes the list. */
export function StatusSelect({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function change(next: string) {
    const prev = value;
    setValue(next);
    setBusy(true);
    setFailed(false);
    const res = await fetch(`/api/admin/sales-inquiries/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setValue(prev);
      setFailed(true);
      return;
    }
    router.refresh();
  }

  return (
    <span>
      <select aria-label="Status" value={value} disabled={busy} onChange={(e) => change(e.target.value)}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.toLowerCase()}
          </option>
        ))}
      </select>
      {failed && <span style={{ color: "#b23838", marginLeft: 6 }}>not saved</span>}
    </span>
  );
}
