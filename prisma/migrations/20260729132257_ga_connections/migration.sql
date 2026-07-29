-- CreateEnum
CREATE TYPE "GaConnectionStatus" AS ENUM ('ACTIVE', 'NEEDS_REAUTH');

-- CreateTable
CREATE TABLE "ga_connections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "propertyId" TEXT,
    "propertyName" TEXT,
    "status" "GaConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ga_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ga_connections_tenantId_key" ON "ga_connections"("tenantId");

-- AddForeignKey
ALTER TABLE "ga_connections" ADD CONSTRAINT "ga_connections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
