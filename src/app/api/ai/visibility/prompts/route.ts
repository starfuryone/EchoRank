import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { requireFeature, enforcementErrorResponse } from "@/lib/plan-enforcement";
import { prisma } from "@/lib/prisma";

/**
 * Answer tracking prompts (AGENCY+ via "answer_tracking"). Active-prompt
 * caps: AGENCY 25, ENTERPRISE 100. Runs happen daily via the worker sweep.
 */

const WINDOW_DAYS = 14;

function promptLimitFor(planType: string): number {
  if (planType === "ENTERPRISE") return 100;
  if (planType === "AGENCY") return 25;
  return 0;
}

export async function GET() {
  try {
    const membership = await requireTenant();
    await requireFeature("answer_tracking");
    const tenantId = membership.tenantId;
    const limit = promptLimitFor(membership.tenant.planType);

    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [prompts, runs] = await Promise.all([
      prisma.trackedPrompt.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } }),
      prisma.promptRun.findMany({
        where: { tenantId, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    ]);

    const latestByPrompt = new Map<string, (typeof runs)[number]>();
    for (const r of runs) {
      if (!latestByPrompt.has(r.promptId)) latestByPrompt.set(r.promptId, r);
    }
    const mentionRate =
      runs.length > 0
        ? Math.round((runs.filter((r) => r.brandMentioned).length / runs.length) * 100)
        : null;

    return NextResponse.json({
      limit,
      used: prompts.filter((p) => p.active).length,
      mentionRate,
      windowDays: WINDOW_DAYS,
      prompts: prompts.map((p) => {
        const latest = latestByPrompt.get(p.id);
        return {
          id: p.id,
          text: p.text,
          active: p.active,
          lastRunAt: p.lastRunAt,
          latest: latest
            ? {
                brandMentioned: latest.brandMentioned,
                brandRank: latest.brandRank,
                excerpt: latest.excerpt,
                createdAt: latest.createdAt,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    console.error("[visibility/prompts GET]", error);
    return NextResponse.json({ error: "Failed to load prompts." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const membership = await requireTenant();
    await requireFeature("answer_tracking");
    const tenantId = membership.tenantId;
    const limit = promptLimitFor(membership.tenant.planType);

    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim().replace(/\s+/g, " ") : "";
    if (text.length < 5 || text.length > 300) {
      return NextResponse.json({ error: "Prompt must be 5-300 characters." }, { status: 400 });
    }

    const active = await prisma.trackedPrompt.count({ where: { tenantId, active: true } });
    const existing = await prisma.trackedPrompt.findUnique({
      where: { tenantId_text: { tenantId, text } },
    });
    if (!existing?.active && active >= limit) {
      return NextResponse.json(
        { error: `Your plan includes ${limit} tracked prompts.`, code: "PromptLimit", used: active, limit },
        { status: 403 },
      );
    }

    const prompt = await prisma.trackedPrompt.upsert({
      where: { tenantId_text: { tenantId, text } },
      update: { active: true, nextRunAt: new Date() },
      create: { tenantId, text, nextRunAt: new Date() },
    });
    return NextResponse.json({ prompt }, { status: 201 });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    console.error("[visibility/prompts POST]", error);
    return NextResponse.json({ error: "Failed to save prompt." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const membership = await requireTenant();
    await requireFeature("answer_tracking");
    const tenantId = membership.tenantId;
    const limit = promptLimitFor(membership.tenant.planType);

    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    if (!id || typeof body.active !== "boolean") {
      return NextResponse.json({ error: "id and active are required." }, { status: 400 });
    }
    if (body.active) {
      const active = await prisma.trackedPrompt.count({ where: { tenantId, active: true } });
      if (active >= limit) {
        return NextResponse.json(
          { error: `Your plan includes ${limit} tracked prompts.`, code: "PromptLimit" },
          { status: 403 },
        );
      }
    }
    const result = await prisma.trackedPrompt.updateMany({
      where: { id, tenantId },
      data: { active: body.active, ...(body.active ? { nextRunAt: new Date() } : {}) },
    });
    if (result.count === 0) return NextResponse.json({ error: "Prompt not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    console.error("[visibility/prompts PATCH]", error);
    return NextResponse.json({ error: "Failed to update prompt." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const membership = await requireTenant();
    await requireFeature("answer_tracking");
    const tenantId = membership.tenantId;

    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const result = await prisma.trackedPrompt.deleteMany({ where: { id, tenantId } });
    if (result.count === 0) return NextResponse.json({ error: "Prompt not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    console.error("[visibility/prompts DELETE]", error);
    return NextResponse.json({ error: "Failed to delete prompt." }, { status: 500 });
  }
}
