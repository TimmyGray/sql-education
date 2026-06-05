-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE');

-- CreateEnum
CREATE TYPE "Level" AS ENUM ('NOVICE', 'JUNIOR', 'MIDDLE');

-- CreateEnum
CREATE TYPE "ComparisonMode" AS ENUM ('ORDERED', 'UNORDERED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "BlockStatus" AS ENUM ('LOCKED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLevelXp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "Level" NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserLevelXp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandboxDataset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "setupSql" TEXT NOT NULL,

    CONSTRAINT "SandboxDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "level" "Level" NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "theoryMarkdown" TEXT NOT NULL,
    "theoryExamples" JSONB,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "referenceQuery" TEXT NOT NULL,
    "expectedResultJson" JSONB NOT NULL,
    "comparisonMode" "ComparisonMode" NOT NULL DEFAULT 'UNORDERED',
    "hint" TEXT NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBlockProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "status" "BlockStatus" NOT NULL DEFAULT 'LOCKED',
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "UserBlockProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTaskProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastSubmittedSql" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTaskProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBlockAiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "questionsUsed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserBlockAiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserLevelXp_userId_level_key" ON "UserLevelXp"("userId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxDataset_name_key" ON "SandboxDataset"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Block_level_order_key" ON "Block"("level", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Task_blockId_order_key" ON "Task"("blockId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "UserBlockProgress_userId_blockId_key" ON "UserBlockProgress"("userId", "blockId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTaskProgress_userId_taskId_key" ON "UserTaskProgress"("userId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBlockAiUsage_userId_blockId_key" ON "UserBlockAiUsage"("userId", "blockId");

-- AddForeignKey
ALTER TABLE "UserLevelXp" ADD CONSTRAINT "UserLevelXp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "SandboxDataset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlockProgress" ADD CONSTRAINT "UserBlockProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlockProgress" ADD CONSTRAINT "UserBlockProgress_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTaskProgress" ADD CONSTRAINT "UserTaskProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTaskProgress" ADD CONSTRAINT "UserTaskProgress_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlockAiUsage" ADD CONSTRAINT "UserBlockAiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlockAiUsage" ADD CONSTRAINT "UserBlockAiUsage_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;
