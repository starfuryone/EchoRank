"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Building2, ArrowRight } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ONBOARDING_COPY, type DashLocale } from "@/lib/i18n/dashboard";

type Intent = "business" | "agency";

/**
 * Mounted globally from the dashboard layout. Shows the two-question welcome
 * step exactly once (until intent is saved or the user skips — skipping sets
 * welcomeSeenAt so it never comes back). Never blocks the dashboard.
 */
export function OnboardingGate({ locale = "en" }: { locale?: DashLocale }) {
  const [open, setOpen] = useState(false);
  const [storedDomain, setStoredDomain] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/onboarding");
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        if (json.needsProfile && !json.welcomeSeen) {
          setStoredDomain(json.domain ?? null);
          setOpen(true);
        }
      } catch {
        /* onboarding is non-critical — fail silent */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!open) return null;
  return (
    <WelcomeSetupModal
      locale={locale}
      storedDomain={storedDomain}
      onClose={() => setOpen(false)}
    />
  );
}

export function WelcomeSetupModal({
  locale = "en",
  storedDomain,
  onClose,
}: {
  locale?: DashLocale;
  storedDomain: string | null;
  onClose: () => void;
}) {
  const t = ONBOARDING_COPY[locale];
  const router = useRouter();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skip = () => {
    // Marks the welcome as seen so the modal doesn't nag on every page load.
    fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "welcome_seen" }),
    }).catch(() => {});
    onClose();
  };

  const submit = async () => {
    if (!intent || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "profile",
          intent,
          // The domain carried over from the landing audit wins server-side;
          // only send what the user typed here.
          ...(storedDomain ? {} : { domain: domain.trim() }),
        }),
      });
      if (!res.ok) throw new Error();
      onClose();
      router.push("/visibility?onboarding=1");
    } catch {
      setError(t.genericError);
    } finally {
      setBusy(false);
    }
  };

  const intents: { value: Intent; label: string; hint: string; icon: React.ReactNode }[] = [
    {
      value: "business",
      label: t.intentBusiness,
      hint: t.intentBusinessHint,
      icon: <Building2 className="h-5 w-5" />,
    },
    {
      value: "agency",
      label: t.intentAgency,
      hint: t.intentAgencyHint,
      icon: <Briefcase className="h-5 w-5" />,
    },
  ];

  return (
    <Modal open onClose={skip} title={t.welcomeTitle}>
      <div className="space-y-5">
        <p className="text-sm leading-relaxed text-gray-600">{t.welcomeIntro}</p>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">{t.intentQuestion}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {intents.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setIntent(opt.value)}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  intent === opt.value
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span
                  className={intent === opt.value ? "text-blue-600" : "text-gray-400"}
                >
                  {opt.icon}
                </span>
                <span>
                  <span className="block text-sm font-medium">{opt.label}</span>
                  <span className="block text-xs text-gray-500">{opt.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {!storedDomain && (
          <Input
            id="onboarding-domain"
            label={t.domainLabel}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder={t.domainPlaceholder}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 border-t border-gray-100 pt-4">
        <Button variant="ghost" onClick={skip}>
          {t.skipForNow}
        </Button>
        <Button onClick={submit} disabled={!intent} loading={busy}>
          {t.runAuditCta}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </Modal>
  );
}
