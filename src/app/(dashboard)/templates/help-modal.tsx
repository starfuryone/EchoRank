"use client";

import { Mail, MessageSquare, Wand2, ShieldCheck, FileText } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";

const PLACEHOLDERS: Array<{ tag: string; desc: string; example: string }> = [
  { tag: "{{customer_name}}", desc: "Customer's first name", example: "Marie" },
  { tag: "{{business_name}}", desc: "Your business name", example: "ABC Dental" },
  { tag: "{{location_name}}", desc: "Location the customer visited", example: "ABC Dental - Downtown" },
  { tag: "{{review_link}}", desc: "Public Google review link (same link for every customer)", example: "g.page/r/..." },
  { tag: "{{feedback_link}}", desc: "Private feedback form, goes only to your team", example: "echorank360.com/f/..." },
  { tag: "{{unsubscribe_link}}", desc: "Required opt-out link in every email", example: "echorank360.com/u/..." },
];

const INCLUDED_TEMPLATES: Array<{
  name: string;
  channel: "EMAIL" | "SMS";
  type: string;
  when: string;
  what: string;
}> = [
  {
    name: "Private Pulse Check",
    channel: "EMAIL",
    type: "Feedback Request",
    when: "~24h after the visit",
    what: "A quiet check-in asking how things went. Catches problems early so you can fix them before asking for a public review.",
  },
  {
    name: "Initial Review Request",
    channel: "EMAIL",
    type: "Review Request",
    when: "~72h after the visit",
    what: "The main ask. Invites the customer to leave a Google review, with the private feedback link offered as a secondary option.",
  },
  {
    name: "Friendly Reminder",
    channel: "EMAIL",
    type: "Review Request",
    when: "5 days later, only if no click",
    what: "A single, gentle nudge. It tells the customer it is the only reminder they will receive \u2014 and it is.",
  },
  {
    name: "Thank You - Review Received",
    channel: "EMAIL",
    type: "Review Request",
    when: "After a review is detected",
    what: "Closes the loop with genuine thanks. Small touch, big retention effect.",
  },
  {
    name: "Service Recovery Follow-Up",
    channel: "EMAIL",
    type: "Recovery",
    when: "After you resolve a reported issue",
    what: "Confirms the fix, invites a reply if anything is still wrong, and mentions \u2014 without pressure \u2014 that a public review is welcome.",
  },
  {
    name: "Initial Review Request (SMS)",
    channel: "SMS",
    type: "Review Request",
    when: "~72h after the visit",
    what: "Short-form version of the main ask. One line, one link, STOP opt-out.",
  },
  {
    name: "Reminder (SMS)",
    channel: "SMS",
    type: "Review Request",
    when: "5 days later, only if no click",
    what: "One-time nudge, clearly labelled as the only reminder.",
  },
  {
    name: "Thank You (SMS)",
    channel: "SMS",
    type: "Review Request",
    when: "After a review is detected",
    what: "Two-sentence thank-you to the customer.",
  },
];

export function TemplatesHelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="How templates work" className="max-w-2xl">
      <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1 text-sm text-gray-700">
        <p>
          Templates are reusable messages sent to your customers through
          campaigns. Your account includes ready-made defaults covering the
          full review journey &mdash; edit them freely or create your own.
        </p>

        {/* Included templates */}
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <FileText className="h-4 w-4 text-blue-600" />
            Your included templates
          </h3>
          <div className="space-y-2">
            {INCLUDED_TEMPLATES.map((t) => (
              <div key={t.name} className="rounded-lg border border-gray-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{t.name}</span>
                  <Badge variant={t.channel === "SMS" ? "success" : "info"}>
                    {t.channel === "SMS" ? (
                      <MessageSquare className="mr-1 inline h-3 w-3" />
                    ) : (
                      <Mail className="mr-1 inline h-3 w-3" />
                    )}
                    {t.channel}
                  </Badge>
                  <Badge variant="default">{t.type}</Badge>
                </div>
                <p className="mt-1 text-xs font-medium text-gray-500">Sent: {t.when}</p>
                <p className="mt-1 text-xs text-gray-600">{t.what}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Placeholders */}
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <Wand2 className="h-4 w-4 text-blue-600" />
            Variables
          </h3>
          <p className="mb-2 text-gray-600">
            Variables are replaced with real values when each message is sent.
            Type them anywhere in a subject or body:
          </p>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <div className="grid grid-cols-[auto_1fr_auto] gap-x-4 bg-gray-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <span>Variable</span>
              <span>What it becomes</span>
              <span>Example</span>
            </div>
            {PLACEHOLDERS.map((p, i) => (
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
            Best practices
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-xs text-green-900">
            <li>
              Give every customer the same public review link &mdash; never
              filter who gets asked based on how happy they seem.
            </li>
            <li>Offer the private feedback link as an extra option, not a replacement.</li>
            <li>Send one reminder at most, and say so in the message.</li>
            <li>Never offer incentives in exchange for reviews.</li>
            <li>SMS: stay under ~160 characters before the link and always include &ldquo;Reply STOP to opt out&rdquo;.</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
