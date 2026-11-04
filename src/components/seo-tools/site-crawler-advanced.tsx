"use client";

// One collapsed sub-section of the start card's "Advanced options" (the UX
// restructure): a <details> whose summary line says what is set, so the card
// stays short and nothing needs opening to see the state.

export function AdvancedSection({
  id,
  title,
  summary,
  children,
}: {
  id: string;
  title: string;
  /** What is set, in one line ("3 extractors · PSI on 10 pages"); the not-set text otherwise. */
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details id={`adv-${id}`} className="group rounded-lg border border-gray-200 bg-white">
      <summary className="flex cursor-pointer select-none flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        <span className="text-sm font-medium text-gray-900">{title}</span>
        <span className="text-xs text-gray-600" data-summary={id}>
          {summary}
        </span>
      </summary>
      <div className="border-t border-gray-100 px-4 py-4">{children}</div>
    </details>
  );
}

/** "a · b · c" from the parts that are set; `none` when nothing is. */
export const summaryLine = (parts: (string | null | false | undefined)[], none: string) => {
  const set = parts.filter((p): p is string => Boolean(p));
  return set.length ? set.join(" · ") : none;
};
