-- Browser-extension import support.
-- 1) New ImportSourceFormat enum value for extension-sourced imports.
-- 2) extension_tokens table backing revocable bearer auth.

-- AlterEnum: ADD VALUE must run outside a transaction block in Postgres.
ALTER TYPE "ImportSourceFormat" ADD VALUE IF NOT EXISTS 'EXTENSION';

-- CreateTable
CREATE TABLE "extension_tokens" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extension_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "extension_tokens_tokenHash_key" ON "extension_tokens"("tokenHash");
CREATE INDEX "extension_tokens_tenantId_idx" ON "extension_tokens"("tenantId");
CREATE INDEX "extension_tokens_userId_idx" ON "extension_tokens"("userId");
CREATE INDEX "extension_tokens_tokenHash_idx" ON "extension_tokens"("tokenHash");

-- AddForeignKey
ALTER TABLE "extension_tokens" ADD CONSTRAINT "extension_tokens_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "extension_tokens" ADD CONSTRAINT "extension_tokens_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
