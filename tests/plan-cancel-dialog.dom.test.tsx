// @vitest-environment jsdom
//
// /plan's "Cancel subscription" dialog (PlanBillingActions): opens with the
// plan and "Access until <date>", posts the optional reason to our own
// /api/billing/cancel (never the Stripe portal), refreshes the server-rendered
// card on success, and shows the server's refusal instead of swallowing it.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

import { PlanBillingActions } from "@/components/plan-hub/plan-billing-actions";

const fetchMock = vi.fn();

function show(over: Partial<Parameters<typeof PlanBillingActions>[0]> = {}) {
  return render(
    <PlanBillingActions
      locale="en"
      state="renewing"
      canManage
      canCancel
      ownerName={null}
      hasPortal
      hasSubscription
      planName="Growth"
      periodEndLabel="December 14, 2026"
      {...over}
    />,
  );
}

beforeEach(() => {
  refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the cancel dialog", () => {
  it("shows the plan and the access date before anything is sent", () => {
    show();
    fireEvent.click(screen.getByTestId("plan-cancel"));
    expect(screen.getByRole("dialog", { name: "Cancel your Growth subscription" })).toBeTruthy();
    expect(screen.getByTestId("plan-cancel-plan").textContent).toBe("Growth plan");
    expect(screen.getByTestId("plan-cancel-until").textContent).toBe("Access until December 14, 2026");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the reason and note to /api/billing/cancel, closes and refreshes on success", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, changed: true }), { status: 200 }));
    show();
    fireEvent.click(screen.getByTestId("plan-cancel"));
    fireEvent.change(screen.getByLabelText("Why are you cancelling? (optional)"), { target: { value: "too_expensive" } });
    fireEvent.change(screen.getByLabelText("Anything else? (optional)"), { target: { value: " budget cut " } });
    fireEvent.click(screen.getByTestId("plan-cancel-confirm"));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/billing/cancel", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ reason: "too_expensive", note: "budget cut" });
    expect(screen.queryByTestId("plan-cancel-dialog")).toBeNull();
  });

  it("shows the server's refusal in the dialog, and does not refresh", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ reason: "role", ownerName: "Ada Owner", error: "x" }), { status: 403 }));
    show();
    fireEvent.click(screen.getByTestId("plan-cancel"));
    fireEvent.click(screen.getByTestId("plan-cancel-confirm"));
    await waitFor(() => expect(screen.getByTestId("plan-cancel-error").textContent).toBe("Only Ada Owner can cancel or resume this subscription."));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("says so on a 429 and on a network failure", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ reason: "rate_limited" }), { status: 429 }));
    show();
    fireEvent.click(screen.getByTestId("plan-cancel"));
    fireEvent.click(screen.getByTestId("plan-cancel-confirm"));
    await waitFor(() => expect(screen.getByTestId("plan-cancel-error").textContent).toMatch(/Too many attempts/));
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByTestId("plan-cancel-confirm"));
    await waitFor(() => expect(screen.getByTestId("plan-cancel-error").textContent).toBe("Could not cancel your subscription. Please try again."));
  });

  it("Keep my plan closes it with nothing sent", () => {
    show();
    fireEvent.click(screen.getByTestId("plan-cancel"));
    fireEvent.click(screen.getByTestId("plan-cancel-keep"));
    expect(screen.queryByTestId("plan-cancel-dialog")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Resume posts /api/billing/resume and refreshes; a refusal is shown", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    show({ state: "cancelling" });
    fireEvent.click(screen.getByTestId("plan-resume"));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/billing/resume", { method: "POST" });

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ reason: "period_ended" }), { status: 409 }));
    fireEvent.click(screen.getByTestId("plan-resume"));
    await waitFor(() => expect(screen.getByTestId("plan-resume-error").textContent).toBe("Could not resume the subscription. Please try again."));
  });

  it("is French in fr", () => {
    show({ locale: "fr" });
    fireEvent.click(screen.getByTestId("plan-cancel"));
    expect(screen.getByTestId("plan-cancel-until").textContent).toBe("Accès jusqu'au December 14, 2026");
  });
});
