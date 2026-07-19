"use client";

import { Mail, MessageSquare, Wand2, ShieldCheck, FileText } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { TEMPLATES_COPY, type DashLocale } from "@/lib/i18n/dashboard";

export function TemplatesHelpModal({
  open,
  onClose,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  locale: DashLocale;
}) {
  const t = TEMPLATES_COPY[locale];
  const h = t.help;
  return (
    <Modal open={open} onClose={onClose} title={h.title} className="max-w-2xl">
      <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1 text-sm text-gray-700">
        <p>{h.intro}</p>

        {/* Included templates */}
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <FileText className="h-4 w-4 text-blue-600" />
            {h.includedTitle}
          </h3>
          <div className="space-y-2">
            {h.templates.map((tpl) => (
              <div key={tpl.name} className="rounded-lg border border-gray-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{tpl.name}</span>
                  <Badge variant={tpl.channel === "SMS" ? "success" : "info"}>
                    {tpl.channel === "SMS" ? (
                      <MessageSquare className="mr-1 inline h-3 w-3" />
                    ) : (
                      <Mail className="mr-1 inline h-3 w-3" />
                    )}
                    {t.channelLabels[tpl.channel] ?? tpl.channel}
                  </Badge>
                  <Badge variant="default">{t.typeLabels[tpl.typeKey] ?? tpl.typeKey}</Badge>
                </div>
                <p className="mt-1 text-xs font-medium text-gray-500">{h.sent(tpl.when)}</p>
                <p className="mt-1 text-xs text-gray-600">{tpl.what}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Placeholders */}
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <Wand2 className="h-4 w-4 text-blue-600" />
            {h.variablesTitle}
          </h3>
          <p className="mb-2 text-gray-600">{h.variablesIntro}</p>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <div className="grid grid-cols-[auto_1fr_auto] gap-x-4 bg-gray-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <span>{h.colVariable}</span>
              <span>{h.colBecomes}</span>
              <span>{h.colExample}</span>
            </div>
            {h.placeholders.map((p, i) => (
              <div
                key={p.tag}
                className={`grid grid-cols-[auto_1fr_auto] items-center gap-x-4 px-3 py-2 ${
                  i % 2 ? "bg-gray-50" : "bg-white"
                }`}
              >
                <code className="text-xs text-blue-600">{p.tag}</code>
                <span className="text-xs text-gray-600">{p.desc}</span>
                <span className="text-xs italic text-gray-400">{p.example}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Best practices */}
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-green-900">
            <ShieldCheck className="h-4 w-4" />
            {h.bestPracticesTitle}
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-xs text-green-900">
            {h.bestPractices.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
