"use client";

import { useActionState } from "react";
import { User, CreditCard, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { ACCOUNT_COPY } from "@/lib/i18n/account";
import type { DashLocale } from "@/lib/i18n/dashboard";
import { TeamChatSection } from "@/components/account/TeamChatSection";
import { updateTenantNameAction, type UpdateTenantNameState } from "./actions";

interface Props {
  locale: DashLocale;
  user: { name: string | null; email: string | null };
  tenant: {
    name: string;
    createdAt: string | null;
    planType: string | null;
    billingStatus: string | null;
  };
  subscription: { planType: string; status: string } | null;
  price: { currency: string; interval: string } | null;
  chat: { eligible: boolean; existingMxid: string | null; elementUrl: string };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-gray-800 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-100">{children}</span>
    </div>
  );
}

export function AccountPageClient({ locale, user, tenant, subscription, price, chat }: Props) {
  const t = ACCOUNT_COPY[locale];

  const [state, formAction, pending] = useActionState<UpdateTenantNameState, FormData>(
    updateTenantNameAction,
    { status: "idle" }
  );

  const intervalLabel =
    price?.interval === "year"
      ? t.intervalYear
      : price?.interval === "month"
        ? t.intervalMonth
        : t.priceUnavailable;

  const dateFmt = new Intl.DateTimeFormat(
    locale === "de-CH" ? "de-CH" : locale === "fr" ? "fr-CA" : "en-CA",
    { dateStyle: "medium" }
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-100">{t.title}</h1>
        <p className="mt-1 text-sm text-gray-400">{t.subtitle}</p>
      </header>

      {/* ── Profile (read-only) ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-amber-300" />
            <h2 className="text-base font-medium text-gray-100">{t.profileTitle}</h2>
            <Badge>{t.readOnly}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-4">
            <InitialsAvatar name={user.name} email={user.email} size={56} />
            <p className="text-xs text-gray-500">{t.profileHint}</p>
          </div>
          <Row label={t.nameLabel}>{user.name || t.notSet}</Row>
          <Row label={t.emailLabel}>{user.email || t.notSet}</Row>
        </CardContent>
      </Card>

      {/* ── Plan (read-only) ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-amber-300" />
            <h2 className="text-base font-medium text-gray-100">{t.planTitle}</h2>
            <Badge>{t.readOnly}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Row label={t.planLabel}>
            <Badge>{subscription?.planType ?? tenant.planType ?? t.notSet}</Badge>
          </Row>
          <Row label={t.billingStatusLabel}>
            {subscription?.status ?? tenant.billingStatus ?? t.notSet}
          </Row>
          <Row label={t.intervalLabel}>{intervalLabel}</Row>
          <Row label={t.currencyLabel}>{price?.currency ?? t.priceUnavailable}</Row>
          {!subscription && (
            <p className="pt-3 text-xs text-gray-500">{t.noSubscription}</p>
          )}
        </CardContent>
      </Card>

      {/* ── Workspace (name editable) ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-amber-300" />
            <h2 className="text-base font-medium text-gray-100">{t.tenantTitle}</h2>
          </div>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-3">
            <label htmlFor="name" className="block text-sm text-gray-400">
              {t.tenantNameLabel}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="name"
                name="name"
                defaultValue={state.name ?? tenant.name}
                maxLength={200}
                required
                className="flex-1"
              />
              <Button type="submit" disabled={pending}>
                {pending ? t.saving : t.save}
              </Button>
            </div>

            {state.status === "error" && state.errorKey && (
              <p role="alert" className="text-sm text-red-400">
                {t[state.errorKey]}
              </p>
            )}
            {state.status === "success" && (
              <p role="status" className="text-sm text-emerald-400">
                {t.saved}
              </p>
            )}
          </form>

          <div className="mt-3">
            <Row label={t.createdAtLabel}>
              {tenant.createdAt ? dateFmt.format(new Date(tenant.createdAt)) : t.notSet}
            </Row>
          </div>
        </CardContent>
      </Card>

      <TeamChatSection
        copy={t}
        eligible={chat.eligible}
        existingMxid={chat.existingMxid}
        elementUrl={chat.elementUrl}
      />
    </div>
  );
}
