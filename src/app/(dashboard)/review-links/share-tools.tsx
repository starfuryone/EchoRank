"use client";

import { useState } from "react";
import { Copy, Check, Mail, MessageSquare, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ReviewLinkLite {
  id: string;
  platform: string;
  url: string;
  isDefault: boolean;
}

const BRAND: Record<string, { bg: string; fg: string; letter: string }> = {
  Google: { bg: "#fff", fg: "#4285F4", letter: "G" },
  Facebook: { bg: "#1877F2", fg: "#fff", letter: "f" },
  Trustpilot: { bg: "#00B67A", fg: "#fff", letter: "\u2605" },
  Yelp: { bg: "#D32323", fg: "#fff", letter: "Y" },
  Other: { bg: "#64748b", fg: "#fff", letter: "\u29C9" },
};

const SHARE_BTN =
  "inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50";

function BrandIcon({ platform, size = 36 }: { platform: string; size?: number }) {
  const b = BRAND[platform] ?? BRAND.Other;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full border border-gray-200 font-bold shadow-sm"
      style={{ width: size, height: size, background: b.bg, color: b.fg, fontSize: size * 0.5 }}
      aria-label={platform}
    >
      {b.letter}
    </span>
  );
}

export function ShareToolsCard({
  links,
  loading,
}: {
  links: ReviewLinkLite[];
  loading: boolean;
}) {
  const [copied, setCopied] = useState(false);

  if (loading || links.length === 0) return null;

  const primary = links.find((l) => l.isDefault) ?? links[0];
  const platforms = Array.from(new Set(links.map((l) => l.platform)));
  const shareText = encodeURIComponent(
    "We'd love your feedback! Leave us a review here: " + primary.url
  );
  const shareUrl = encodeURIComponent(primary.url);
  const mailHref =
    "mailto:?subject=" +
    encodeURIComponent("How was your experience?") +
    "&body=" +
    shareText;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(primary.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Card>
      <CardContent className="py-5">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Get more reviews with one link
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              <li>&bull; Share via SMS, email, or social in one click</li>
              <li>&bull; Customers land on the platform you choose</li>
              <li>&bull; Every click is tracked automatically</li>
            </ul>

            <div className="mt-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <span className="truncate text-sm text-gray-700">{primary.url}</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={copy}>
                {copied ? (
                  <Check className="mr-1.5 h-4 w-4" />
                ) : (
                  <Copy className="mr-1.5 h-4 w-4" />
                )}
                {copied ? "Copied!" : "Copy Link"}
              </Button>
              <a className={SHARE_BTN} href={mailHref}>
                <Mail className="mr-1.5 h-4 w-4" />
                Email
              </a>
              <a className={SHARE_BTN} href={"sms:?&body=" + shareText}>
                <MessageSquare className="mr-1.5 h-4 w-4" />
                SMS
              </a>
              <a
                className={SHARE_BTN}
                href={"https://wa.me/?text=" + shareText}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
              <a
                className={SHARE_BTN}
                href={"https://www.facebook.com/sharer/sharer.php?u=" + shareUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Share
              </a>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-5">
            <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              What your customers see
            </p>
            <div className="mx-auto max-w-xs rounded-xl border border-gray-200 bg-white p-5 text-center shadow-sm">
              <div className="flex justify-center gap-0.5 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-current" />
                ))}
              </div>
              <p className="mt-2 text-sm font-semibold text-gray-900">
                How was your experience?
              </p>
              <p className="mt-1 text-xs text-gray-500">Leave a review on:</p>
              <div className="mt-3 flex justify-center gap-3">
                {platforms.slice(0, 4).map((p) => (
                  <BrandIcon key={p} platform={p} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
