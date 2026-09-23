-- CreateTable
CREATE TABLE "OrderEmail" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderStatus" "OrderStatus" NOT NULL,
    "to" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 8,
    "freeShippingFrom" DECIMAL(10,2) NOT NULL DEFAULT 500,
    "shippingFee" DECIMAL(10,2) NOT NULL DEFAULT 25,
    "lowStockAt" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderEmail_orderId_idx" ON "OrderEmail"("orderId");

-- AddForeignKey
ALTER TABLE "OrderEmail" ADD CONSTRAINT "OrderEmail_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
