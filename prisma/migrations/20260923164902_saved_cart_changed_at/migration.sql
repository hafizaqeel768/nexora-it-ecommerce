/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `SavedCart` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SavedCart" DROP COLUMN "updatedAt",
ADD COLUMN     "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
