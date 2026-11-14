-- CreateEnum
CREATE TYPE "FundingSource" AS ENUM ('MADDYNESS', 'EU_STARTUPS');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'TO_CONTACT', 'CONTACTED', 'IGNORED');

-- AlterTable
ALTER TABLE "WatchRun" ADD COLUMN     "fundingInserted" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "FundingRound" (
    "id" TEXT NOT NULL,
    "source" "FundingSource" NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "amountLabel" TEXT,
    "stage" TEXT,
    "country" TEXT,
    "summary" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[],
    "publishedAt" TIMESTAMP(3),
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundingRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FundingRound_url_key" ON "FundingRound"("url");

-- CreateIndex
CREATE INDEX "FundingRound_status_publishedAt_idx" ON "FundingRound"("status", "publishedAt");
