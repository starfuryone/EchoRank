// Per-customer erase (/api/compliance/erase): besides the customer record and
// the email/SMS logs, it removes what the person wrote and what was written
// about them: feedback comments, recovery-ticket notes, AI analysis, alert text.
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const count = () => vi.fn(async () => 0);
  const many = (n: number) => vi.fn<(a: { where?: unknown }) => Promise<{ count: number }>>(async () => ({ count: n }));
  return {
    customer: { findFirst: vi.fn(), update: vi.fn() },
    feedback: { count: count(), findMany: vi.fn(), updateMany: many(2) },
    emailLog: { count: count(), updateMany: many(0) },
    smsLog: { count: count(), updateMany: many(0) },
    recoveryTicket: { updateMany: many(1) },
    aiAnalysis: { deleteMany: many(2) },
    escalationAlert: { updateMany: many(1) },
    deletionLog: { create: vi.fn() },
    createAuditLog: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => {
  const prisma = { ...m, $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma) };
  return { prisma };
});
vi.mock("@/lib/audit", () => ({ createAuditLog: m.createAuditLog }));

import { gdprService } from "@/infrastructure/compliance/gdpr";

beforeEach(() => {
  vi.clearAllMocks();
  m.customer.findFirst.mockResolvedValue({ id: "c1", email: "jo@example.test", phone: "+1", legalHold: false });
  m.feedback.findMany.mockResolvedValue([{ id: "f1" }, { id: "f2" }]);
});

describe("eraseCustomerData", () => {
  it("clears feedback comments and ticket notes, deletes AI analysis, blanks alert text", async () => {
    await gdprService.eraseCustomerData("t1", "c1", "u1");

    expect(m.feedback.updateMany).toHaveBeenCalledWith({ where: { customerId: "c1", tenantId: "t1" }, data: { comment: null } });
    expect(m.recoveryTicket.updateMany).toHaveBeenCalledWith({ where: { customerId: "c1", tenantId: "t1" }, data: { notes: null } });
    expect(m.aiAnalysis.deleteMany).toHaveBeenCalledWith({ where: { tenantId: "t1", feedbackId: { in: ["f1", "f2"] } } });
    expect(m.escalationAlert.updateMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", OR: [{ customerId: "c1" }, { feedbackId: { in: ["f1", "f2"] } }] },
      data: { title: "[Erased]", description: "[Erased per GDPR request]", suggestedAction: null },
    });
  });

  it("logs counts only", async () => {
    await gdprService.eraseCustomerData("t1", "c1", "u1");
    const snap = m.deletionLog.create.mock.calls[0][0].data.snapshotData;
    expect(snap).toMatchObject({ feedbackCommentsCleared: 2, ticketNotesCleared: 1, aiAnalysesDeleted: 2, alertsAnonymized: 1 });
    expect(JSON.stringify(m.deletionLog.create.mock.calls[0][0])).not.toContain("jo@example.test");
  });

  it("with no feedback, touches no analysis and matches alerts by customer only", async () => {
    m.feedback.findMany.mockResolvedValue([]);
    await gdprService.eraseCustomerData("t1", "c1", "u1");
    expect(m.aiAnalysis.deleteMany).not.toHaveBeenCalled();
    expect(m.escalationAlert.updateMany.mock.calls[0][0].where).toEqual({ tenantId: "t1", OR: [{ customerId: "c1" }] });
  });

  it("stays tenant-scoped and refuses a customer under legal hold", async () => {
    m.customer.findFirst.mockResolvedValue({ id: "c1", email: null, phone: null, legalHold: true });
    await expect(gdprService.eraseCustomerData("t1", "c1", "u1")).rejects.toThrow(/legal hold/);
    expect(m.customer.findFirst).toHaveBeenCalledWith({ where: { id: "c1", tenantId: "t1" } });
    expect(m.feedback.updateMany).not.toHaveBeenCalled();
  });
});
