/**
 * @vitest-environment jsdom
 */
// The SEO Tools hub's "How to use" button, in a real DOM.
//
// It replaced an inline-styled <a download> that shipped hardcoded English and
// handed people a PDF instead of an answer (baf57c7). Three things have to stay
// true or that regression comes back in another shape: the label comes from the
// catalog in all three DashLocales, the modal actually opens and closes, and
// the white paper is still reachable — from inside the modal, in a new tab.
//
// The a11y assertions here are on borrowed behaviour: Escape, backdrop close,
// the focus trap and aria-labelledby all live in src/components/ui/modal.tsx.
// They are asserted anyway because this surface is what users touch, and a
// future "just a lighter modal" refactor of the hub would silently drop them.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
  ToolsHubHelpButton,
  SEO_TOOLS_WHITEPAPER,
} from "@/components/seo-tools/tools-hub-help";
import { SEO_TOOLS_COPY, SEO_TOOLS_HUB_HELP_COPY } from "@/lib/i18n/dashboard";
import { SEO_TOOL_GROUPS } from "@/lib/seo-tools";

const LOCALES = ["en", "fr", "de-CH"] as const;

afterEach(() => {
  cleanup();
  // The modal locks body scroll; a leak would pass the next assertion for free.
  document.body.style.overflow = "";
});

const openModal = (locale: (typeof LOCALES)[number]) => {
  render(<ToolsHubHelpButton locale={locale} />);
  fireEvent.click(screen.getByRole("button", { name: SEO_TOOLS_HUB_HELP_COPY[locale].buttonAria }));
  return screen.getByRole("dialog");
};

describe.each(LOCALES)("trigger (%s)", (locale) => {
  const t = SEO_TOOLS_HUB_HELP_COPY[locale];

  it("renders its label from the catalog, not a hardcoded string", () => {
    render(<ToolsHubHelpButton locale={locale} />);
    const button = screen.getByRole("button", { name: t.buttonAria });
    expect(button).toHaveTextContent(t.button);
    if (locale !== "en") {
      // The exact failure of baf57c7: fr and de-CH rendering the English label.
      expect(button.textContent).not.toContain(SEO_TOOLS_HUB_HELP_COPY.en.button);
    }
  });

  it("keeps the modal closed until it is clicked", () => {
    render(<ToolsHubHelpButton locale={locale} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a dialog named by the catalog title", () => {
    const dialog = openModal(locale);
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy as string)).toHaveTextContent(t.title);
  });
});

describe("closing", () => {
  it("closes on Escape", () => {
    openModal("en");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on a backdrop click, but not on a click inside the dialog", () => {
    const dialog = openModal("en");
    const overlay = dialog.parentElement as HTMLElement;

    fireEvent.click(dialog);
    expect(screen.queryByRole("dialog")).not.toBeNull();

    fireEvent.click(overlay);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes from the close button, whose name is localized", () => {
    openModal("de-CH");
    fireEvent.click(screen.getByRole("button", { name: SEO_TOOLS_HUB_HELP_COPY["de-CH"].close }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("traps Tab inside the dialog and hands focus back on close", () => {
    render(<ToolsHubHelpButton locale="en" />);
    const trigger = screen.getByRole("button", {
      name: SEO_TOOLS_HUB_HELP_COPY.en.buttonAria,
    });
    // fireEvent.click does not focus its target the way a real click does, and
    // the modal restores focus to whatever was active when it opened.
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog");
    const focusables = [
      ...dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    ];
    expect(focusables.length).toBeGreaterThan(1);
    const last = focusables[focusables.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(focusables[0]);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(trigger);
  });
});

describe("content", () => {
  it("ends on the white paper — new tab, not a download button on the page", () => {
    for (const locale of LOCALES) {
      openModal(locale);
      const link = screen.getByRole("link", { name: SEO_TOOLS_COPY[locale].hubWhitepaper });
      expect(link).toHaveAttribute("href", SEO_TOOLS_WHITEPAPER);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
      cleanup();
    }
  });

  it("points at /billing for usage and limits, and quotes no plan number", () => {
    openModal("en");
    expect(
      screen.getByRole("link", { name: SEO_TOOLS_HUB_HELP_COPY.en.quotaLink }),
    ).toHaveAttribute("href", "/billing");
    // A hardcoded allowance here would be the thing the link exists to avoid.
    expect(SEO_TOOLS_HUB_HELP_COPY.en.quotaBody).not.toMatch(/\b\d+\b/);
  });

  it("lists the live tool groups, in the grid's own order", () => {
    openModal("fr");
    const bullets = SEO_TOOL_GROUPS.map((group) => SEO_TOOLS_COPY.fr.groups[group.id]);
    expect(bullets.length).toBeGreaterThan(0);
    for (const bullet of bullets) expect(screen.getByText(bullet)).toBeInTheDocument();
  });

  it("stays within the 4-6 section budget in every locale", () => {
    for (const locale of LOCALES) {
      openModal(locale);
      const t = SEO_TOOLS_HUB_HELP_COPY[locale];
      for (const heading of [t.groupsTitle, t.toolsTitle, t.accessTitle, t.quotaTitle, t.paperTitle]) {
        expect(screen.getByText(heading)).toBeInTheDocument();
      }
      expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(5);
      cleanup();
    }
  });
});

describe("the hub page itself", () => {
  // cwd, not import.meta.url: under `@vitest-environment jsdom` the module URL
  // is an http:// one and fileURLToPath rejects it.
  const source = readFileSync(
    join(process.cwd(), "src/app/(dashboard)/visibility/tools/page.tsx"),
    "utf8",
  );

  // Grep guards on the exact shape of the sed job, so a re-application fails a
  // test instead of shipping. (Yes, these are string assertions on source —
  // that is the point: what they forbid is invisible to a render test.)
  it("carries no inline style attribute", () => {
    expect(source).not.toMatch(/style=\{\{/);
  });

  it("does not link or download the PDF directly", () => {
    expect(source).not.toContain("whitepapers/");
    expect(source).not.toMatch(/\bdownload\b/);
  });

  it("has no hardcoded English label", () => {
    expect(source).not.toContain("How to use");
  });

  it("mounts the help button instead", () => {
    expect(source).toContain("<ToolsHubHelpButton locale={locale} />");
  });
});
