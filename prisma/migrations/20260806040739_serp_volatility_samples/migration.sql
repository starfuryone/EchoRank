-- CreateTable
CREATE TABLE "serp_volatility_samples" (
    "id" TEXT NOT NULL,
    "sampledOn" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "locationCode" INTEGER NOT NULL,
    "topDomains" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "serp_volatility_samples_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "serp_volatility_samples_category_sampledOn_idx" ON "serp_volatility_samples"("category", "sampledOn");

-- CreateIndex
CREATE UNIQUE INDEX "serp_volatility_samples_sampledOn_keyword_locationCode_key" ON "serp_volatility_samples"("sampledOn", "keyword", "locationCode");

