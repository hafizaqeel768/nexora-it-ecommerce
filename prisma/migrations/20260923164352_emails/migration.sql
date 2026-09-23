-- CreateEnum
CREATE TYPE "OrderEmailKind" AS ENUM ('CONFIRMATION', 'STATUS');

-- CreateEnum
CREATE TYPE "AuthTokenPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrderEmail" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "kind" "OrderEmailKind" NOT NULL DEFAULT 'STATUS';

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "AuthTokenPurpose" NOT NULL,
    "customerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedCart" (
    "customerId" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "remindedAt" TIMESTAMP(3),

    CONSTRAINT "SavedCart_pkey" PRIMARY KEY ("customerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_customerId_purpose_idx" ON "AuthToken"("customerId", "purpose");

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCart" ADD CONSTRAINT "SavedCart_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
