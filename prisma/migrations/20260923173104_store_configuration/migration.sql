-- Phase 11: store configuration. The Phase 9 StoreSettings values (or their defaults) are carried over
-- into a default shipping zone/method, a default tax rate and the inventory config before the table is dropped.
-- CreateEnum
CREATE TYPE "ShippingKind" AS ENUM ('FLAT', 'PICKUP');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "taxExempt" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "shippingMethod" TEXT,
ADD COLUMN     "taxRate" DECIMAL(6,3);

-- CreateTable
CREATE TABLE "StoreConfig" (
    "section" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreConfig_pkey" PRIMARY KEY ("section")
);

-- CreateTable
CREATE TABLE "ShippingZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "states" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingMethod" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ShippingKind" NOT NULL DEFAULT 'FLAT',
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "freeFrom" DECIMAL(10,2),
    "minSubtotal" DECIMAL(10,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ShippingMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT '',
    "rate" DECIMAL(6,3) NOT NULL,
    "shipping" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShippingMethod_zoneId_idx" ON "ShippingMethod"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRate_country_state_key" ON "TaxRate"("country", "state");

-- AddForeignKey
ALTER TABLE "ShippingMethod" ADD CONSTRAINT "ShippingMethod_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "ShippingZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry over Phase 9 settings
INSERT INTO "ShippingZone" ("id", "name", "countries", "states", "sortOrder")
VALUES ('zone_default', 'Everywhere', ARRAY[]::TEXT[], ARRAY[]::TEXT[], 0);

INSERT INTO "ShippingMethod" ("id", "zoneId", "name", "kind", "price", "freeFrom", "sortOrder")
SELECT 'method_default', 'zone_default', 'Standard shipping', 'FLAT',
       COALESCE((SELECT "shippingFee" FROM "StoreSettings" WHERE "id" = 1), 25),
       COALESCE((SELECT "freeShippingFrom" FROM "StoreSettings" WHERE "id" = 1), 500),
       0;

INSERT INTO "TaxRate" ("id", "name", "country", "state", "rate", "shipping")
SELECT 'tax_default', 'Sales tax', '*', '', COALESCE((SELECT "taxPercent" FROM "StoreSettings" WHERE "id" = 1), 8), false;

INSERT INTO "StoreConfig" ("section", "value", "updatedAt")
SELECT 'inventory', jsonb_build_object('lowStockAt', COALESCE((SELECT "lowStockAt" FROM "StoreSettings" WHERE "id" = 1), 10)), now();

-- DropTable
DROP TABLE "StoreSettings";
