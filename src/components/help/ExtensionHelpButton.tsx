"use client";

import { useState } from "react";
import {
  HelpCircle,
  Download,
  KeyRound,
  ClipboardPaste,
  MapPin,
  MousePointerClick,
  BarChart3,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EXTENSION_HELP_COPY, type DashLocale } from "@/lib/i18n/dashboard";

/**
 * Drop-in help trigger for the browser extension. Renders a small "How to use
 * it" button that opens a modal with plain-English, non-technical instructions.
 * Use on any page where users interact with the extension (Extension,
 * Monitoring, Data Sources, etc.).
 *
 * Usage:
 *   import { ExtensionHelpButton } from "@/components/help/ExtensionHelpButton";
 *   <ExtensionHelpButton locale={locale} />
 */

interface StepProps {
  n: number;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function Step({ n, icon, title, children }: StepProps) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-amber-400">
        {n}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">{icon}</span>
          <h4 className="font-semibold text-gray-900">{title}</h4>
        </div>
        <div className="mt-1 text-sm leading-relaxed text-gray-600">{children}</div>
      </div>
    </div>
  );
}

export function ExtensionHelpButton({
  variant = "outline",
  size = "sm",
  label,
  locale = "en",
}: {
  variant?: "outline" | "ghost" | "primary";
  size?: "sm" | "md";
  label?: string;
  locale?: DashLocale;
}) {
  const [open, setOpen] = useState(false);
  const c = EXTENSION_HELP_COPY[locale];

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <HelpCircle className="h-4 w-4" /> {label ?? c.label}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={c.modalTitle}
        className="max-w-xl"
      >
        <div className="space-y-6">
          <p className="text-sm leading-relaxed text-gray-600">{c.intro}</p>

          {/* One-time setup */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {c.setupHeading}
            </h3>
            <div className="space-y-4">
              <Step n={1} icon={<Download className="h-4 w-4" />} title={c.step1Title}>
                {c.step1Body}
              </Step>

              <Step n={2} icon={<KeyRound className="h-4 w-4" />} title={c.step2Title}>
                {c.step2a}
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-800">
                  er_ext_…
                </code>
                {c.step2b}
              </Step>

              <Step n={3} icon={<ClipboardPaste className="h-4 w-4" />} title={c.step3Title}>
                {c.step3a}
                <strong className="font-medium text-gray-800">{c.step3strongSettings}</strong>
                {c.step3b}
                <strong className="font-medium text-gray-800">{c.step3strongSave}</strong>
                {c.step3c}
                <strong className="font-medium text-gray-800">{c.step3strongConnected}</strong>
                {c.step3d}
              </Step>
            </div>
          </div>

          {/* Everyday use */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {c.useHeading}
            </h3>
            <div className="space-y-4">
              <Step n={4} icon={<MapPin className="h-4 w-4" />} title={c.step4Title}>
                {c.step4a}
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-800">
                  google.com/maps
                </code>
                {c.step4b}
              </Step>

              <Step n={5} icon={<MousePointerClick className="h-4 w-4" />} title={c.step5Title}>
                {c.step5a}
                <strong className="font-medium text-gray-800">{c.step5strong}</strong>
                {c.step5b}
              </Step>

              <Step n={6} icon={<BarChart3 className="h-4 w-4" />} title={c.step6Title}>
                {c.step6a}
                <strong className="font-medium text-gray-800">{c.step6strong}</strong>
                {c.step6b}
              </Step>
            </div>
          </div>

          {/* The two lights */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              {c.lightsHeading}
            </h3>
            <p className="mb-3 text-sm text-gray-600">{c.lightsIntro}</p>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-green-600" />
                <p className="text-sm text-gray-600">
                  <strong className="font-medium text-gray-800">{c.light1Strong}</strong>
                  {c.light1Text}
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <XCircle className="mt-0.5 h-4 w-4 flex-none text-red-500" />
                <p className="text-sm text-gray-600">
                  <strong className="font-medium text-gray-800">{c.light2Strong}</strong>
                  {c.light2Text}
                </p>
              </div>
            </div>
          </div>

          {/* Reassurance */}
          <p className="text-xs leading-relaxed text-gray-500">{c.reassurance}</p>

          <div className="flex justify-end border-t border-gray-200 pt-4">
            <Button variant="primary" size="sm" onClick={() => setOpen(false)}>
              {c.gotIt}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
