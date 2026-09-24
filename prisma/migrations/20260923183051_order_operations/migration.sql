-- CreateEnum
CREATE TYPE "RefundMethod" AS ENUM ('STRIPE', 'MANUAL');

-- CreateEnum
CREATE TYPE "OrderNoteKind" AS ENUM ('NOTE', 'EVENT');

-- AlterEnum
ALTER TYPE "OrderEmailKind" ADD VALUE 'REFUND';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "adminNote" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "refundedTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "trackingCarrier" TEXT,
ADD COLUMN     "trackingNumber" TEXT;

-- AlterTable
ALTER TABLE "OrderEmail" ADD COLUMN     "refundId" TEXT;

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "method" "RefundMethod" NOT NULL,
    "stripeRefundId" TEXT,
    "restocked" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderNote" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "OrderNoteKind" NOT NULL DEFAULT 'NOTE',
    "body" TEXT NOT NULL,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Refund_stripeRefundId_key" ON "Refund"("stripeRefundId");

-- CreateIndex
CREATE INDEX "Refund_orderId_idx" ON "Refund"("orderId");

-- CreateIndex
CREATE INDEX "OrderNote_orderId_createdAt_idx" ON "OrderNote"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderEmail" ADD CONSTRAINT "OrderEmail_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderNote" ADD CONSTRAINT "OrderNote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

