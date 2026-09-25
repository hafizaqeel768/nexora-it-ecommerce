-- CreateEnum
CREATE TYPE "AttributeType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'BOOLEAN', 'SELECT', 'MULTISELECT', 'DATE', 'PRICE');

-- CreateTable
CREATE TABLE "Attribute" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AttributeType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,
    "unit" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "showOnProduct" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeOption" (
    "id" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AttributeOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attribute_code_key" ON "Attribute"("code");

-- CreateIndex
CREATE INDEX "Attribute_active_sortOrder_idx" ON "Attribute"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "AttributeOption_attributeId_sortOrder_idx" ON "AttributeOption"("attributeId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeOption_attributeId_label_key" ON "AttributeOption"("attributeId", "label");

-- AddForeignKey
ALTER TABLE "AttributeOption" ADD CONSTRAINT "AttributeOption_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Codes are stored lowercase (checked in the app too).
ALTER TABLE "Attribute" ADD CONSTRAINT "Attribute_code_format_check" CHECK ("code" ~ '^[a-z][a-z0-9_]{1,39}$');

-- Starter role Catalog Manager (Phase 14) manages attributes too; Content Manager may view them.
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['attributes.view','attributes.create','attributes.edit','attributes.delete']::TEXT[])), "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = 'role_catalog_manager';
UPDATE "AdminRole" SET "permissions" = ARRAY(SELECT DISTINCT unnest("permissions" || ARRAY['attributes.view']::TEXT[])), "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = 'role_content_manager';
