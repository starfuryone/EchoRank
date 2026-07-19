"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ONBOARDING_COPY, type DashLocale } from "@/lib/i18n/dashboard";

/**
 * Minimal client-workspace creation for the agency onboarding step: creates
 * the tenant, switches to it, and hard-reloads so every server component
 * picks up the new active-tenant cookie.
 */
export function AddClientModal({
  locale = "en",
  open,
  onClose,
}: {
  locale?: DashLocale;
  open: boolean;
  onClose: () => void;
}) {
  const t = ONBOARDING_COPY[locale];
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      await fetch("/api/tenants/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: data.tenant.id }),
      });
      window.location.assign("/dashboard");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t.genericError);
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t.addClientTitle}>
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-gray-600">{t.addClientIntro}</p>
        <Input
          id="add-client-name"
          label={t.addClientNameLabel}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.addClientNamePlaceholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
          }}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4">
        <Button variant="outline" onClick={onClose}>
          {t.skipForNow}
        </Button>
        <Button onClick={create} disabled={!name.trim()} loading={busy}>
          {t.addClientCta}
        </Button>
      </div>
    </Modal>
  );
}
