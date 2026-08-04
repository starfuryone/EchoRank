-- CreateTable
CREATE TABLE "matrix_accounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "mxid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "matrix_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "matrix_accounts_mxid_key" ON "matrix_accounts"("mxid");

-- CreateIndex
CREATE INDEX "matrix_accounts_tenantId_deactivatedAt_idx" ON "matrix_accounts"("tenantId", "deactivatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "matrix_accounts_tenantId_appUserId_key" ON "matrix_accounts"("tenantId", "appUserId");

