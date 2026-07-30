// src/app/api/ai/visibility/bots/upload/route.ts
//
// Accepts an access log and queues it for parsing. GROWTH and above.
//
// The web process writes the upload to a spool directory and the worker reads and
// deletes it. That means the two processes must share a filesystem — true on this
// box (both are pm2 apps on the same host) and the reason the path is a plain
// local path rather than object storage. If the workers ever move to another
// host, this is the thing that breaks, so it is stated here rather than
// discovered.
//
// The file never reaches the database. The worker turns it into counts and
// unlinks it; see the note at the top of bot-log-analysis.worker.ts.

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { prisma } from "@/lib/prisma";
import { getQueue } from "@/infrastructure/queue/registry";
import {
  MAX_UPLOAD_BYTES,
  UploadQuotaUnavailableError,
  canUploadLogs,
  hasAllowedExtension,
  isGzip,
  releaseUpload,
  reserveUpload,
} from "@/lib/bot-analytics/upload";

/** Spool directory. Overridable so a future split host has a knob to turn. */
const SPOOL_DIR =
  process.env.BOT_LOG_SPOOL_DIR || path.join(os.tmpdir(), "echorank-bot-logs");

export async function POST(request: Request) {
  let tenantId: string | null = null;
  let reserved = false;
  try {
    const membership = await requirePaidPlan();
    tenantId = membership.tenantId;
    const plan = membership.tenant.planType;

    // Section B is a plan feature; section A stays available to every paid plan.
    if (!canUploadLogs(plan)) {
      return NextResponse.json(
        {
          error: "Log analysis is available on Growth and Agency.",
          code: "PlanRequiredError",
        },
        { status: 403 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Attach a log file." }, { status: 400 });
    }
    if (!hasAllowedExtension(file.name)) {
      return NextResponse.json(
        { error: "Upload a .log, .txt or .gz access log.", code: "BadType" },
        { status: 400 },
      );
    }
    // Checked before reading the body into memory.
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "That file is over the 50 MB limit.", code: "TooLarge" },
        { status: 413 },
      );
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "That file is empty." }, { status: 400 });
    }

    const quota = await reserveUpload(tenantId, plan);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `Monthly upload limit reached (${quota.limit}).`,
          code: "UploadQuotaExceededError",
          logs: { used: quota.used, limit: quota.limit },
        },
        { status: 429 },
      );
    }
    reserved = true;

    // Filename comes from the client, so it is never used to build the path. The
    // path is a UUID we generate; the original name is stored as a label only.
    const gzipped = isGzip(file.name);
    await mkdir(SPOOL_DIR, { recursive: true });
    const spoolPath = path.join(SPOOL_DIR, `${randomUUID()}${gzipped ? ".gz" : ".log"}`);
    await writeFile(spoolPath, Buffer.from(await file.arrayBuffer()), { mode: 0o600 });

    const analysis = await prisma.botLogAnalysis.create({
      data: {
        tenantId,
        // Label only. Truncated so a hostile 4KB filename cannot bloat the row.
        filename: file.name.slice(0, 200),
        sizeBytes: file.size,
        status: "PENDING",
      },
    });

    await getQueue("bot-log-analysis").add("parse", {
      analysisId: analysis.id,
      tenantId,
      path: spoolPath,
      gzipped,
    });
    reserved = false; // queued; the reservation is earned

    return NextResponse.json({
      analysis: {
        id: analysis.id,
        filename: analysis.filename,
        sizeBytes: analysis.sizeBytes,
        status: analysis.status,
        createdAt: analysis.createdAt.toISOString(),
      },
      logs: { used: quota.used, limit: quota.limit },
    });
  } catch (error) {
    const resp = enforcementErrorResponse(error);
    if (resp) return resp;
    if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof UploadQuotaUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("[visibility/bots/upload POST]", error);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  } finally {
    if (reserved && tenantId) await releaseUpload(tenantId);
  }
}
