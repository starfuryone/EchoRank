-- What a subscription is for: a plan, or the standalone watcher.
--
-- Additive, defaulting to PLAN. Every row that exists today is a plan, and a
-- default of WATCHER would strip existing paying customers of every gated tool
-- on their next request.

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('PLAN', 'WATCHER');

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "productKind" "ProductKind" NOT NULL DEFAULT 'PLAN';
