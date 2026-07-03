"use client";

import { useState } from "react";
import { ExternalLink, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

const GUIDE_URL = "/extension/howto-ai-visibility.html";

/**
 * Help triggers for the AI Visibility page. Two ways into the same guide,
 * user's choice: "Full guide" opens it as a page in a new tab; "How it
 * works" opens it inside the app in a modal (embed mode hides the guide's
 * own header/footer so it reads as native content).
 *
 * Usage:
 *   import { VisibilityHelpButton } from "@/components/help/VisibilityHelpButton";
 *   <VisibilityHelpButton />
 */
export function VisibilityHelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-none items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.open(GUIDE_URL, "_blank", "noopener,noreferrer")}
      >
        <ExternalLink className="h-4 w-4" /> Full guide
      </Button>

      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <HelpCircle className="h-4 w-4" /> How it works
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="How AI visibility works"
        className="max-w-4xl"
      >
        <iframe
          src={`${GUIDE_URL}?embed=1`}
          title="AI visibility — guide"
          className="h-[75vh] w-full rounded-lg border border-gray-200 bg-white"
        />
        <div className="mt-3 text-right">
          <a
            href={GUIDE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Open as a full page →
          </a>
        </div>
      </Modal>
    </div>
  );
}
