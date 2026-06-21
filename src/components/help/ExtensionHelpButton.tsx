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

/**
 * Drop-in help trigger for the browser extension. Renders a small "How to use
 * it" button that opens a modal with plain-English, non-technical instructions.
 * Use on any page where users interact with the extension (Extension,
 * Monitoring, Data Sources, etc.).
 *
 * Usage:
 *   import { ExtensionHelpButton } from "@/components/help/ExtensionHelpButton";
 *   <ExtensionHelpButton />
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
  label = "How to use it",
}: {
  variant?: "outline" | "ghost" | "primary";
  size?: "sm" | "md";
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <HelpCircle className="h-4 w-4" /> {label}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="How to import your reviews"
        className="max-w-xl"
      >
        <div className="space-y-6">
          <p className="text-sm leading-relaxed text-gray-600">
            The Review Importer is a small add-on for your browser. When you&apos;re
            looking at your reviews on Google, Facebook, or Trustpilot, it copies
            them into EchoRank with one click. You don&apos;t type anything in — it
            does the work for you.
          </p>

          {/* One-time setup */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              First-time setup (you only do this once)
            </h3>
            <div className="space-y-4">
              <Step n={1} icon={<Download className="h-4 w-4" />} title="Install the importer">
                Add it to Microsoft Edge, Brave, Opera, or Vivaldi. You&apos;ll then
                see a small EchoRank button near the top-right of your browser, by
                the address bar. If it&apos;s hidden, click the puzzle-piece icon up
                there and pin it.
              </Step>

              <Step n={2} icon={<KeyRound className="h-4 w-4" />} title="Create your connection key">
                On this Extension page, give a key a name you&apos;ll recognise (like
                &ldquo;My laptop&rdquo;) and create it. A code starting with{" "}
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-800">
                  er_ext_…
                </code>{" "}
                appears. Copy it right away — for your security it&apos;s shown only
                once. Lost it? Just make a new one.
              </Step>

              <Step n={3} icon={<ClipboardPaste className="h-4 w-4" />} title="Paste the key into the importer">
                Click the EchoRank button in your browser, then{" "}
                <strong className="font-medium text-gray-800">Settings</strong>. Paste
                your key, leave the web address as it is, and click{" "}
                <strong className="font-medium text-gray-800">Save</strong>. The top
                should now show a green dot and the word{" "}
                <strong className="font-medium text-gray-800">Connected</strong>.
              </Step>
            </div>
          </div>

          {/* Everyday use */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Bringing in reviews (any time)
            </h3>
            <div className="space-y-4">
              <Step n={4} icon={<MapPin className="h-4 w-4" />} title="Open your business's review page">
                Go to the real page where your reviews live. For Google, open{" "}
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-800">
                  google.com/maps
                </code>
                , search your business by name, and click it so the full listing with
                reviews opens.
              </Step>

              <Step n={5} icon={<MousePointerClick className="h-4 w-4" />} title="Click Scan & Import Reviews">
                Open the EchoRank button again. On the right kind of page, the{" "}
                <strong className="font-medium text-gray-800">Scan &amp; Import
                Reviews</strong>{" "}
                button comes to life — click it. The Found / Imported counters will
                move, and you&apos;re done.
              </Step>

              <Step n={6} icon={<BarChart3 className="h-4 w-4" />} title="See them here">
                Your imported reviews appear under{" "}
                <strong className="font-medium text-gray-800">Monitoring</strong>,
                sorted and ready to track.
              </Step>
            </div>
          </div>

          {/* The two lights */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              The two status lights tell you everything
            </h3>
            <p className="mb-3 text-sm text-gray-600">
              When you open the importer, both lines at the top must be green before
              the Scan button will work.
            </p>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-green-600" />
                <p className="text-sm text-gray-600">
                  <strong className="font-medium text-gray-800">Connected</strong> —
                  your account is linked. If this is red, redo step 3.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <XCircle className="mt-0.5 h-4 w-4 flex-none text-red-500" />
                <p className="text-sm text-gray-600">
                  <strong className="font-medium text-gray-800">
                    Open a Google, Facebook, or Trustpilot review page
                  </strong>{" "}
                  — you&apos;re not on a review page it recognises yet. A regular search
                  results page won&apos;t work, even if it shows reviews. Go to your
                  business&apos;s actual page and this turns green.
                </p>
              </div>
            </div>
          </div>

          {/* Reassurance */}
          <p className="text-xs leading-relaxed text-gray-500">
            Your login is safe — the importer never sees your Google, Facebook, or
            Trustpilot password. It only reads the reviews already shown on the page,
            and sends them to your own EchoRank account. Scanning the same page again
            later brings in new reviews and skips ones you already have.
          </p>

          <div className="flex justify-end border-t border-gray-200 pt-4">
            <Button variant="primary" size="sm" onClick={() => setOpen(false)}>
              Got it
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
