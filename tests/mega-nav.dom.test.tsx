/**
 * @vitest-environment jsdom
 */
// Mega-menu INTERACTION, in a real DOM.
//
// The companion suite (mega-nav.test.ts) covers the state machine and the
// server markup. This one covers what only a document can: that the listeners
// are actually wired, that Esc hands focus back, that a click outside closes,
// and that the mobile sheet locks body scroll. Those were implemented but
// unverified until jsdom and @testing-library were added for exactly this.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PublicNav } from "@/app/[locale]/PublicNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en",
  useRouter: () => ({ push: () => {} }),
}));

afterEach(() => {
  cleanup();
  // A leaked lock would silently pass the next scroll assertion.
  document.body.style.overflow = "";
});

const trigger = (name: RegExp) => screen.getByRole("button", { name });

describe("opening and closing", () => {
  it("toggles aria-expanded on click", () => {
    render(<PublicNav locale="en" />);
    const product = trigger(/^Product/);
    expect(product).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(product);
    expect(product).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(product);
    expect(product).toHaveAttribute("aria-expanded", "false");
  });

  it("opens on hover, and closes when the pointer leaves", () => {
    render(<PublicNav locale="en" />);
    const wrap = trigger(/^Solutions/).parentElement!;
    fireEvent.mouseEnter(wrap);
    expect(trigger(/^Solutions/)).toHaveAttribute("aria-expanded", "true");
    fireEvent.mouseLeave(wrap);
    expect(trigger(/^Solutions/)).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps exactly one panel open when a second trigger is used", () => {
    render(<PublicNav locale="en" />);
    fireEvent.click(trigger(/^Product/));
    fireEvent.click(trigger(/^Resources/));
    expect(trigger(/^Product/)).toHaveAttribute("aria-expanded", "false");
    expect(trigger(/^Resources/)).toHaveAttribute("aria-expanded", "true");
    // The invariant stated over the whole header, not just the two involved.
    expect(screen.getAllByRole("button", { expanded: true })).toHaveLength(1);
  });

  it("closes on Esc and returns focus to the trigger", () => {
    render(<PublicNav locale="en" />);
    const product = trigger(/^Product/);
    fireEvent.click(product);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(product).toHaveAttribute("aria-expanded", "false");
    // Returning focus is the part a keyboard user notices; without it they are
    // dropped at the top of the document.
    expect(document.activeElement).toBe(product);
  });

  it("closes on a click outside the header", () => {
    render(<PublicNav locale="en" />);
    fireEvent.click(trigger(/^Product/));
    fireEvent.mouseDown(document.body);
    expect(trigger(/^Product/)).toHaveAttribute("aria-expanded", "false");
  });

  it("stays open for a click inside its own panel", () => {
    // A link click must not be read as an outside click, or the panel would
    // close out from under the navigation it just started.
    render(<PublicNav locale="en" />);
    fireEvent.click(trigger(/^Product/));
    const panel = screen.getByRole("region", { name: "Product" });
    fireEvent.mouseDown(within(panel).getByRole("link", { name: /Free tools/ }));
    expect(trigger(/^Product/)).toHaveAttribute("aria-expanded", "true");
  });
});

describe("keyboard", () => {
  it("moves through panel links with the arrow keys, and wraps", () => {
    render(<PublicNav locale="en" />);
    fireEvent.click(trigger(/^Solutions/));
    const panel = screen.getByRole("region", { name: "Solutions" });
    const links = within(panel).getAllByRole("link");

    fireEvent.keyDown(panel, { key: "ArrowDown" });
    expect(document.activeElement).toBe(links[0]);
    fireEvent.keyDown(panel, { key: "ArrowDown" });
    expect(document.activeElement).toBe(links[1]);
    fireEvent.keyDown(panel, { key: "ArrowUp" });
    expect(document.activeElement).toBe(links[0]);
    // Wrapping backwards from the first lands on the last.
    fireEvent.keyDown(panel, { key: "ArrowUp" });
    expect(document.activeElement).toBe(links[links.length - 1]);
  });

  it("closes from inside the panel with Esc", () => {
    render(<PublicNav locale="en" />);
    const solutions = trigger(/^Solutions/);
    fireEvent.click(solutions);
    fireEvent.keyDown(screen.getByRole("region", { name: "Solutions" }), { key: "Escape" });
    expect(solutions).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(solutions);
  });
});

describe("mobile sheet", () => {
  it("opens, locks body scroll, and closes on Esc releasing the lock", () => {
    render(<PublicNav locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull();
    // Releasing matters as much as locking: a stuck lock leaves the whole site
    // unscrollable after one menu open.
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("closes with the close button", () => {
    render(<PublicNav locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("expands a section to reveal its links, one at a time", () => {
    render(<PublicNav locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const sheet = screen.getByRole("dialog", { name: "Menu" });
    const product = within(sheet).getByRole("button", { name: /^Product/ });
    const resources = within(sheet).getByRole("button", { name: /^Resources/ });

    fireEvent.click(product);
    expect(product).toHaveAttribute("aria-expanded", "true");
    expect(within(sheet).getByRole("link", { name: "Free tools" })).toBeInTheDocument();

    fireEvent.click(resources);
    expect(product).toHaveAttribute("aria-expanded", "false");
    expect(resources).toHaveAttribute("aria-expanded", "true");
  });

  it("closes the sheet when a link inside it is followed", () => {
    render(<PublicNav locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const sheet = screen.getByRole("dialog", { name: "Menu" });
    fireEvent.click(within(sheet).getByRole("button", { name: /^Product/ }));
    fireEvent.click(within(sheet).getByRole("link", { name: "Free tools" }));
    expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull();
  });
});
