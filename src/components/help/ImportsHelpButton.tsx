"use client";

import { useState } from "react";
import { ExternalLink, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { IMPORTS_HELP_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { KnowledgeBaseLinks } from "@/components/help/KnowledgeBaseLinks";

const GUIDE_URL = "/extension/howto-import-reviews.html";

/**
 * Help triggers for the Data Sources page. Two ways into the same guide,
 * user's choice: "Full guide" opens it as a page in a new tab; "How it
 * works" opens it inside the app in a modal (embed mode hides the guide's
 * own header/footer so it reads as native content).
 *
 * Usage:
 *   import { ImportsHelpButton } from "@/components/help/ImportsHelpButton";
 *   <ImportsHelpButton locale={locale} />
 */
export function ImportsHelpButton({ locale = "en" }: { locale?: DashLocale }) {
  const t = IMPORTS_HELP_COPY[locale];
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-none items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.open(GUIDE_URL, "_blank", "noopener,noreferrer")}
      >
        <ExternalLink className="h-4 w-4" /> {t.fullGuide}
      </Button>

      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <HelpCircle className="h-4 w-4" /> {t.howItWorks}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t.modalTitle}
        className="max-w-4xl"
      >
        <iframe
          src={`${GUIDE_URL}?embed=1`}
          title={t.iframeTitle}
          className="h-[75vh] w-full rounded-lg border border-gray-200 bg-white"
        />
        <div className="mt-3 text-right">
          <a
            href={GUIDE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            {t.openFullPage}
          </a>
        </div>
        <KnowledgeBaseLinks locale={locale} route="/imports" />
      </Modal>
    </div>
  );
}
