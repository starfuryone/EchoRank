"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { AuthContent } from "@/lib/i18n/auth-content";
import { postSignupRedirect } from "@/lib/plan-routing";
import { takeCheckoutConsent } from "@/lib/checkout-consent";

export default function RegisterForm({
  c,
  plan,
  interval,
  resumeCheckout,
  brand,
  locale,
}: {
  c: AuthContent["register"];
  plan?: string;
  /** Billing interval carried over from the pricing card. */
  interval?: string;
  /** Arrived from a pricing card — continue into Stripe after signup. */
  resumeCheckout?: boolean;
  brand?: string;
  locale: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, businessName, plan, brand, acceptedTerms }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || c.errFallback);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(c.errCreatedSigninFailed);
      } else if (resumeCheckout && plan) {
        // Came from a pricing card: finish what they clicked rather than
        // dropping them on a dashboard and making them find pricing again.
        //
        // THE CONSENT IS THE WHOLE REASON THIS WORKS. /api/billing/checkout
        // validates it BEFORE the auth branch, so a resumed call without it is
        // answered 400 consent_required — and this block's fallthrough would
        // swallow that and land a brand-new paying customer on a dashboard
        // with no subscription, with nothing on either side saying so. The
        // payload was stashed by the pricing card that sent them here; see
        // src/lib/checkout-consent.ts.
        //
        // NO CONSENT, NO CALL. If nothing was stashed — someone opened this URL
        // directly, or storage is unavailable — we do not invent a payload to
        // satisfy the server. Consent has to be an act the visitor performed,
        // and the fallback below leads to /pricing, where the gate is, rather
        // than to a checkout they never agreed to.
        const consent = takeCheckoutConsent();
        if (consent) {
          try {
            const r = await fetch("/api/billing/checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tier: plan,
                interval: interval === "year" ? "year" : "month",
                locale,
                consent,
              }),
            });
            const d = (await r.json()) as { url?: string };
            if (r.ok && d.url) {
              window.location.assign(d.url);
              return;
            }
          } catch {
            // fall through
          }
        }
        // Checkout could not be resumed. The account EXISTS and is signed in,
        // so this is a redirect, not an error: the new tenant is NONE, and the
        // dashboard's billing guard sends a NONE tenant to /pricing — where
        // one click now goes straight to Stripe, because they are signed in.
        // Deliberately not a hard-coded /pricing push: if the tenant somehow is
        // not NONE, postSignupRedirect's destination is the right one.
        router.push(postSignupRedirect(data.planType ?? plan));
      } else {
        // Every plan lands on /dashboard; ?plan=ai_visibility folds to STARTER.
        router.push(postSignupRedirect(data.planType ?? plan));
      }
    } catch {
      setError(c.errUnexpected);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
        {c.h2}
      </h2>
      <p className="text-gray-500 text-center mb-8">{c.sub}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <Input
          id="name"
          label={c.nameLabel}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={c.namePh}
          required
        />

        <Input
          id="email"
          label={c.emailLabel}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={c.emailPh}
          required
        />

        <Input
          id="businessName"
          label={c.businessLabel}
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder={c.businessPh}
          required
        />

        <div className="relative">
          <Input
            id="password"
            label={c.passwordLabel}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={c.passwordPh}
            minLength={8}
            required
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? c.hidePassword : c.showPassword}
            className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>

        <label className="flex items-start gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            required
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            {c.termsLabelPre}
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              className="text-blue-600 hover:text-blue-700 underline"
            >
              {c.termsLinkText}
            </button>
            {c.termsLabelPost}
          </span>
        </label>

        <Button type="submit" loading={loading} disabled={!acceptedTerms} className="w-full" size="lg">
          {c.submit}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        {c.haveAccount}{" "}
        <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
          {c.signIn}
        </Link>
      </p>

      <p className="mt-4 text-center text-xs text-gray-400">
        {c.trialNote}
      </p>

      <Modal
        open={showTerms}
        onClose={() => setShowTerms(false)}
        title={c.termsModalTitle}
        className="max-w-3xl"
      >
        <iframe
          src={`/${locale}/legal/terms`}
          title={c.termsModalTitle}
          className="h-[60vh] w-full rounded border border-gray-200 bg-white"
        />
        <div className="mt-4 flex items-center justify-between">
          <a
            href={`/${locale}/legal/terms`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-600 hover:text-blue-700 underline"
          >
            {c.termsOpenFull}
          </a>
          <Button
            type="button"
            onClick={() => {
              setAcceptedTerms(true);
              setShowTerms(false);
            }}
          >
            {c.termsAgree}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
