-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('VALIDATED', 'IMPORTING', 'DONE', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "behavior" TEXT NOT NULL,
    "onError" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "content" TEXT,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'VALIDATED',
    "totals" JSONB NOT NULL,
    "rows" JSONB NOT NULL,
    "result" JSONB,
    "createdById" TEXT,
    "createdByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportJob_createdAt_idx" ON "ImportJob"("createdAt");

-- Starter roles (Phase 14) get the matching Data Transfer permissions. Only touches those roles by id,
-- only adds codes they don't have yet; roles renamed or edited since keep everything else.
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['import.access','export.access','categories.import','categories.export']::TEXT[])), "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = 'role_catalog_manager';
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['export.access']::TEXT[])), "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = 'role_sales_manager';
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['import.access','export.access','customers.import']::TEXT[])), "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = 'role_customer_manager';
