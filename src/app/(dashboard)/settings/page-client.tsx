"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  AlertCircle,
  Save,
  Building2,
  Palette,
  Globe,
  Mail,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { SETTINGS_COPY, type DashLocale, type SettingsCopy } from "@/lib/i18n/dashboard";

interface TenantSettings {
  businessName: string;
  logoUrl: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  supportEmail: string;
  googleReviewLink: string;
  facebookReviewLink: string;
  trustpilotLink: string;
  timezone: string;
  defaultLanguage: string;
  plan: string;
  customDomain: string;
  whitelabelEnabled: boolean;
}

const TIMEZONE_VALUES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "UTC",
];

const LANGUAGE_VALUES = ["en", "es", "fr", "de", "pt", "it", "nl", "ja", "zh"];

function HelpSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-3">
      <div className="flex items-center gap-2 text-gray-900">
        <span className="text-gray-400">{icon}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-gray-600">{children}</p>
    </div>
  );
}

function SettingsHelpModal({
  open,
  onClose,
  t,
}: {
  open: boolean;
  onClose: () => void;
  t: SettingsCopy;
}) {
  return (
    <Modal open={open} onClose={onClose} title={t.helpModal.title}>
      <div className="divide-y divide-gray-100">
        <HelpSection icon={<Building2 className="h-4 w-4" />} title={t.businessInfoTitle}>
          {t.helpModal.businessBody}
        </HelpSection>
        <HelpSection icon={<Palette className="h-4 w-4" />} title={t.brandColorsTitle}>
          {t.helpModal.brandBody}
        </HelpSection>
        <HelpSection icon={<Globe className="h-4 w-4" />} title={t.reviewLinksTitle}>
          {t.helpModal.reviewBody}
        </HelpSection>
        <HelpSection icon={<Mail className="h-4 w-4" />} title={t.localizationTitle}>
          {t.helpModal.localizationBody}
        </HelpSection>
        <HelpSection icon={<Settings className="h-4 w-4" />} title={t.whitelabelTitle}>
          {t.helpModal.whitelabelBody}
        </HelpSection>
      </div>
      <div className="mt-2 flex justify-end border-t border-gray-100 pt-4">
        <Button type="button" onClick={onClose}>
          {t.helpModal.gotIt}
        </Button>
      </div>
    </Modal>
  );
}

export function SettingsPageClient({ locale }: { locale: DashLocale }) {
  const t = SETTINGS_COPY[locale];
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/tenants");
        if (!res.ok) throw new Error(t.loadFailed);
        const json = await res.json();
        setSettings(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : t.genericError);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, [t.loadFailed, t.genericError]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSuccess(false);
    try {
      const res = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(t.saveFailed);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      alert(t.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof TenantSettings, value: string | boolean) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-200" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="text-lg font-semibold text-gray-900">
          {t.errorTitle}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          {t.retry}
        </Button>
      </div>
    );
  }

  if (!settings) return null;

  const isAgencyPlan = settings.plan === "AGENCY";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t.subtitle}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setHelpOpen(true)}
          className="shrink-0"
        >
          <HelpCircle className="mr-2 h-4 w-4" />
          {t.helpButton}
        </Button>
      </div>

      <SettingsHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} t={t} />

      <form onSubmit={handleSave} className="space-y-6">
        {/* Business Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gray-400" />
              <h2 className="text-base font-semibold text-gray-900">
                {t.businessInfoTitle}
              </h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label={t.businessNameLabel}
                id="business-name"
                value={settings.businessName}
                onChange={(e) => update("businessName", e.target.value)}
                placeholder={t.businessNamePlaceholder}
              />
              <Input
                label={t.logoUrlLabel}
                id="logo-url"
                type="url"
                value={settings.logoUrl}
                onChange={(e) => update("logoUrl", e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </div>
            <Input
              label={t.supportEmailLabel}
              id="support-email"
              type="email"
              value={settings.supportEmail}
              onChange={(e) => update("supportEmail", e.target.value)}
              placeholder="support@yourbusiness.com"
            />
          </CardContent>
        </Card>

        {/* Brand Colors */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-gray-400" />
              <h2 className="text-base font-semibold text-gray-900">
                {t.brandColorsTitle}
              </h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="primary-color"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {t.primaryColorLabel}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="primary-color"
                    value={settings.brandPrimaryColor || "#2563eb"}
                    onChange={(e) =>
                      update("brandPrimaryColor", e.target.value)
                    }
                    className="h-10 w-10 rounded border border-gray-300 cursor-pointer"
                  />
                  <Input
                    value={settings.brandPrimaryColor}
                    onChange={(e) =>
                      update("brandPrimaryColor", e.target.value)
                    }
                    placeholder="#2563eb"
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="secondary-color"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {t.secondaryColorLabel}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="secondary-color"
                    value={settings.brandSecondaryColor || "#7c3aed"}
                    onChange={(e) =>
                      update("brandSecondaryColor", e.target.value)
                    }
                    className="h-10 w-10 rounded border border-gray-300 cursor-pointer"
                  />
                  <Input
                    value={settings.brandSecondaryColor}
                    onChange={(e) =>
                      update("brandSecondaryColor", e.target.value)
                    }
                    placeholder="#7c3aed"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Review Links */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-gray-400" />
              <h2 className="text-base font-semibold text-gray-900">
                {t.reviewLinksTitle}
              </h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label={t.googleLinkLabel}
              id="google-review"
              type="url"
              value={settings.googleReviewLink}
              onChange={(e) => update("googleReviewLink", e.target.value)}
              placeholder="https://g.page/r/your-business/review"
            />
            <Input
              label={t.facebookLinkLabel}
              id="facebook-review"
              type="url"
              value={settings.facebookReviewLink}
              onChange={(e) => update("facebookReviewLink", e.target.value)}
              placeholder="https://facebook.com/your-business/reviews"
            />
            <Input
              label={t.trustpilotLinkLabel}
              id="trustpilot"
              type="url"
              value={settings.trustpilotLink}
              onChange={(e) => update("trustpilotLink", e.target.value)}
              placeholder="https://trustpilot.com/review/your-business.com"
            />
          </CardContent>
        </Card>

        {/* Localization */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-gray-400" />
              <h2 className="text-base font-semibold text-gray-900">
                {t.localizationTitle}
              </h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label={t.timezoneLabel}
                id="timezone"
                value={settings.timezone}
                onChange={(e) => update("timezone", e.target.value)}
                options={TIMEZONE_VALUES.map((value) => ({
                  value,
                  label: t.timezones[value] ?? value,
                }))}
              />
              <Select
                label={t.languageLabel}
                id="language"
                value={settings.defaultLanguage}
                onChange={(e) => update("defaultLanguage", e.target.value)}
                options={LANGUAGE_VALUES.map((value) => ({
                  value,
                  label: t.languages[value] ?? value,
                }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* White-label (Agency plan only) */}
        <Card
          className={!isAgencyPlan ? "opacity-60" : undefined}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-gray-400" />
                <h2 className="text-base font-semibold text-gray-900">
                  {t.whitelabelTitle}
                </h2>
              </div>
              {!isAgencyPlan && (
                <Badge variant="info">{t.agencyRequired}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label={t.customDomainLabel}
              id="custom-domain"
              value={settings.customDomain}
              onChange={(e) => update("customDomain", e.target.value)}
              placeholder="feedback.yourbusiness.com"
              disabled={!isAgencyPlan}
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.whitelabelEnabled}
                onChange={(e) =>
                  update("whitelabelEnabled", e.target.checked)
                }
                disabled={!isAgencyPlan}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
              <span
                className={`text-sm ${isAgencyPlan ? "text-gray-700" : "text-gray-400"}`}
              >
                {t.whitelabelCheckbox}
              </span>
            </label>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex items-center justify-between border-t border-gray-200 pt-6">
          <div>
            {success && (
              <p className="text-sm font-medium text-green-600">
                {t.savedSuccess}
              </p>
            )}
          </div>
          <Button type="submit" loading={saving} size="lg">
            <Save className="mr-2 h-4 w-4" />
            {t.saveButton}
          </Button>
        </div>
      </form>
    </div>
  );
}
