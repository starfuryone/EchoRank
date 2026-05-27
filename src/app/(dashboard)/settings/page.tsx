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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "UTC", label: "UTC" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/tenants");
        if (!res.ok) throw new Error("Failed to load settings");
        const json = await res.json();
        setSettings(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

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
      if (!res.ok) throw new Error("Failed to save settings");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      alert("Failed to save settings. Please try again.");
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
          Failed to load settings
        </h2>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!settings) return null;

  const isAgencyPlan = settings.plan === "AGENCY";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your business settings and brand configuration.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Business Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gray-400" />
              <h2 className="text-base font-semibold text-gray-900">
                Business Information
              </h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Business Name"
                id="business-name"
                value={settings.businessName}
                onChange={(e) => update("businessName", e.target.value)}
                placeholder="Your Business Name"
              />
              <Input
                label="Logo URL"
                id="logo-url"
                type="url"
                value={settings.logoUrl}
                onChange={(e) => update("logoUrl", e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </div>
            <Input
              label="Support Email"
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
                Brand Colors
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
                  Primary Color
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
                  Secondary Color
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
                Review Platform Links
              </h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Google Review Link"
              id="google-review"
              type="url"
              value={settings.googleReviewLink}
              onChange={(e) => update("googleReviewLink", e.target.value)}
              placeholder="https://g.page/r/your-business/review"
            />
            <Input
              label="Facebook Review Link"
              id="facebook-review"
              type="url"
              value={settings.facebookReviewLink}
              onChange={(e) => update("facebookReviewLink", e.target.value)}
              placeholder="https://facebook.com/your-business/reviews"
            />
            <Input
              label="Trustpilot Link"
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
                Localization
              </h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Timezone"
                id="timezone"
                value={settings.timezone}
                onChange={(e) => update("timezone", e.target.value)}
                options={TIMEZONES}
              />
              <Select
                label="Default Language"
                id="language"
                value={settings.defaultLanguage}
                onChange={(e) => update("defaultLanguage", e.target.value)}
                options={LANGUAGES}
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
                  White-label
                </h2>
              </div>
              {!isAgencyPlan && (
                <Badge variant="info">Agency Plan Required</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Custom Domain"
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
                Enable white-label branding (removes EchoRank branding)
              </span>
            </label>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex items-center justify-between border-t border-gray-200 pt-6">
          <div>
            {success && (
              <p className="text-sm font-medium text-green-600">
                Settings saved successfully!
              </p>
            )}
          </div>
          <Button type="submit" loading={saving} size="lg">
            <Save className="mr-2 h-4 w-4" />
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
