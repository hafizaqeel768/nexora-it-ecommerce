-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "registeredAt" TIMESTAMP(3);
