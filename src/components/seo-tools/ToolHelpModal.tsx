"use client";

// THE help modal for every SEO tool page. One implementation, one shape.
//
// Before this existed, Rank Tracker, Backlinks, Lighthouse and Site Audit each
// carried their own near-identical copy of the same button + Modal + section
// markup. They are all migrated onto this; new tools use it directly and no
// tool should grow a bespoke one again.
//
// Accessibility is inherited from src/components/ui/modal.tsx, which already
// provides role="dialog", aria-modal, aria-labelledby (via `title`), Escape and
// backdrop close, a Tab focus trap, focus restore to the trigger on close, body
// scroll lock, and max-h/overflow-y-auto. Re-implementing any of that here
// would be a second thing to keep correct.

import { useState, type ComponentType } from "react";
import Link from "next/link";
import { CircleQuestionMark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

/** One block of the modal body. */
export interface ToolHelpSection {
  title: string;
  /** Optional: a bullets-only or link-only section needs no prose. */
  body?: string;
  /** Rendered as a bulleted list beneath `body`. */
  bullets?: string[];
  /**
   * "note" renders the section as a highlighted callout instead of a numbered
   * step — for closing tips and caveats that are not part of the sequence.
   */
  tone?: "step" | "note";
  /**
   * Optional link rendered under the body (e.g. "Open AI Visibility →").
   *
   * `external` for anything the router does not own — a static /public asset,
   * a Caddy-served page. next/link would try to client-navigate it, and a PDF
   * belongs in a new tab anyway rather than replacing the page behind it.
   */
  link?: { href: string; label: string; external?: boolean };
}

/** The one link shape both section tones render, in their own type scale. */
function SectionLink({
  link,
  className,
  onNavigate,
}: {
  link: NonNullable<ToolHelpSection["link"]>;
  className: string;
  onNavigate?: () => void;
}) {
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
        {link.label}
      </a>
    );
  }
  return (
    <Link href={link.href} onClick={onNavigate} className={className}>
      {link.label}
    </Link>
  );
}

export interface ToolHelpModalProps {
  /** Dialog heading; also the modal's accessible name. */
  title: string;
  /** Accessible name for the close button. */
  closeLabel: string;
  /** Visible trigger label, normally "Help". */
  buttonLabel: string;
  /** Trigger's accessible name — more specific than "Help" alone. */
  buttonAria: string;
  /** One sentence above the illustration. */
  intro?: string;
  /** Decorative SVG. Must be aria-hidden and carry no translatable text. */
  illustration?: ComponentType;
  sections: ToolHelpSection[];
}

function StepSection({ index, section }: { index: number; section: ToolHelpSection }) {
  return (
    <section className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700"
      >
        {index}
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-gray-900">{section.title}</h3>
        {section.body && (
          <p className="mt-1 text-sm leading-relaxed text-gray-600">{section.body}</p>
        )}
        {section.bullets && section.bullets.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {section.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2 text-sm leading-relaxed text-gray-600">
                <span
                  aria-hidden="true"
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500"
                />
                {bullet}
              </li>
            ))}
          </ul>
        )}
        {section.link && (
          <SectionLink
            link={section.link}
            className="mt-1.5 inline-block text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
        )}
      </div>
    </section>
  );
}

function NoteSection({ section, onNavigate }: { section: ToolHelpSection; onNavigate: () => void }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
      <h3 className="text-xs font-semibold text-blue-900">{section.title}</h3>
      {section.body && (
        <p className="mt-1 text-xs leading-relaxed text-blue-800">{section.body}</p>
      )}
      {section.link && (
        // Closing the modal on navigate: leaving it mounted over the next page
        // traps focus in a dialog whose page has gone. An external link opens a
        // new tab and leaves this page standing, so it keeps the modal open.
        <SectionLink
          link={section.link}
          onNavigate={onNavigate}
          className="mt-1.5 inline-block text-xs font-medium text-blue-700 underline hover:text-blue-900"
        />
      )}
    </div>
  );
}

export function ToolHelpModal({
  title,
  closeLabel,
  buttonLabel,
  buttonAria,
  intro,
  illustration: Illustration,
  sections,
}: ToolHelpModalProps) {
  const [open, setOpen] = useState(false);

  // Steps are numbered by their position among STEPS only, so a note in the
  // middle does not consume a number. Derived rather than accumulated in a
  // mutable counter: reassigning during render is not allowed by the React
  // compiler, and n here is a handful of sections.
  const stepNumbers = sections.map((section, i) =>
    section.tone === "note"
      ? 0
      : sections.slice(0, i + 1).filter((s) => s.tone !== "note").length,
  );

  return (
    <>
      <Button variant="outline" aria-label={buttonAria} onClick={() => setOpen(true)}>
        <CircleQuestionMark className="mr-2 h-4 w-4 text-blue-600" aria-hidden="true" />
        {buttonLabel}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        closeLabel={closeLabel}
        className="max-w-2xl"
      >
        <div className="space-y-5 pb-1">
          {intro && <p className="text-sm leading-relaxed text-gray-600">{intro}</p>}
          {Illustration && <Illustration />}

          {sections.map((section, i) =>
            section.tone === "note" ? (
              <NoteSection
                key={section.title}
                section={section}
                onNavigate={() => setOpen(false)}
              />
            ) : (
              <StepSection key={section.title} index={stepNumbers[i]} section={section} />
            ),
          )}
        </div>
      </Modal>
    </>
  );
}
