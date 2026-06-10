-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isTestAccount" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "testAccountExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_isTestAccount_testAccountExpiresAt_idx" ON "User"("isTestAccount", "testAccountExpiresAt");
