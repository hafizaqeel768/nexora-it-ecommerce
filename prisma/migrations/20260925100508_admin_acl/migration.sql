-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "adminDisabledAt" TIMESTAMP(3),
ADD COLUMN     "adminRoleId" TEXT,
ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AdminRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminRole_name_key" ON "AdminRole"("name");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Customer_role_idx" ON "Customer"("role");

-- CreateIndex
CREATE INDEX "Customer_adminRoleId_idx" ON "Customer"("adminRoleId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_adminRoleId_fkey" FOREIGN KEY ("adminRoleId") REFERENCES "AdminRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Staff-only columns may only be set on staff accounts (role ADMIN).
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_staff_fields_check"
  CHECK ("role" = 'ADMIN' OR ("isSuperAdmin" = false AND "adminRoleId" IS NULL AND "adminDisabledAt" IS NULL));

-- Existing admins keep full access: before Phase 14 every admin could do everything.
UPDATE "Customer" SET "isSuperAdmin" = true WHERE "role" = 'ADMIN';

-- Starter roles. Ordinary data: rename, change or delete them in Admin → System → Roles.
INSERT INTO "AdminRole" ("id", "name", "description", "permissions", "updatedAt") VALUES
  ('role_catalog_manager', 'Catalog Manager', 'Products, categories, brands and reviews',
   ARRAY['dashboard.view','products.view','products.create','products.edit','products.import','products.export',
         'categories.view','categories.create','categories.edit','categories.delete','reviews.view','reviews.moderate'], CURRENT_TIMESTAMP),
  ('role_sales_manager', 'Sales Manager', 'Orders, refunds, quotes and coupons',
   ARRAY['dashboard.view','orders.view','orders.edit','orders.refund','orders.export','quotes.view','quotes.edit',
         'customers.view','coupons.view','coupons.create','coupons.edit','coupons.delete'], CURRENT_TIMESTAMP),
  ('role_customer_manager', 'Customer Manager', 'Customer accounts and their orders (read-only)',
   ARRAY['dashboard.view','customers.view','customers.edit','customers.export','orders.view','quotes.view'], CURRENT_TIMESTAMP),
  ('role_content_manager', 'Content Manager', 'Category texts and review moderation',
   ARRAY['categories.view','categories.edit','products.view','reviews.view','reviews.moderate'], CURRENT_TIMESTAMP),
  ('role_support', 'Support', 'Look up and update orders; view customers and quotes',
   ARRAY['orders.view','orders.edit','customers.view','quotes.view'], CURRENT_TIMESTAMP);
