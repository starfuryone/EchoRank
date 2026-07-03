-- CreateTable
CREATE TABLE "tracked_prompts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracked_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "engine" TEXT NOT NULL DEFAULT 'claude',
    "model" TEXT NOT NULL,
    "brandMentioned" BOOLEAN NOT NULL,
    "brandRank" INTEGER,
    "competitors" JSONB NOT NULL,
    "excerpt" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tracked_prompts_active_nextRunAt_idx" ON "tracked_prompts"("active", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "tracked_prompts_tenantId_text_key" ON "tracked_prompts"("tenantId", "text");

-- CreateIndex
CREATE INDEX "prompt_runs_tenantId_createdAt_idx" ON "prompt_runs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "prompt_runs_promptId_createdAt_idx" ON "prompt_runs"("promptId", "createdAt");

-- AddForeignKey
ALTER TABLE "tracked_prompts" ADD CONSTRAINT "tracked_prompts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_runs" ADD CONSTRAINT "prompt_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_runs" ADD CONSTRAINT "prompt_runs_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "tracked_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

