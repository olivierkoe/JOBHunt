-- CreateEnum
CREATE TYPE "OfferSource" AS ENUM ('MANUAL', 'REDDIT', 'HACKER_NEWS', 'REMOTEOK', 'REMOTIVE');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('OPEN', 'UNVERIFIED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('TO_APPLY', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CREATED', 'STATUS_CHANGE', 'NOTE', 'FOLLOW_UP_SENT');

-- CreateTable
CREATE TABLE "Cv" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "yearsExperience" DOUBLE PRECISION NOT NULL,
    "skills" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "source" "OfferSource" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "url" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "skills" TEXT[],
    "minYears" INTEGER,
    "senior" BOOLEAN NOT NULL DEFAULT false,
    "eligibleFromFrance" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'en',
    "otherLanguage" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'OPEN',
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "cvId" TEXT NOT NULL,
    "stackPct" INTEGER NOT NULL,
    "globalPct" INTEGER NOT NULL,
    "covered" TEXT[],
    "missing" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "cvId" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'TO_APPLY',
    "position" INTEGER NOT NULL DEFAULT 0,
    "appliedAt" TIMESTAMP(3),
    "lastContactAt" TIMESTAMP(3),
    "followUpAfterDays" INTEGER NOT NULL DEFAULT 7,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationEvent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus",
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "scanned" INTEGER NOT NULL DEFAULT 0,
    "inserted" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT[],

    CONSTRAINT "WatchRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cv_slug_key" ON "Cv"("slug");

-- CreateIndex
CREATE INDEX "Offer_createdAt_idx" ON "Offer"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_source_externalId_key" ON "Offer"("source", "externalId");

-- CreateIndex
CREATE INDEX "Match_cvId_globalPct_idx" ON "Match"("cvId", "globalPct");

-- CreateIndex
CREATE UNIQUE INDEX "Match_offerId_cvId_key" ON "Match"("offerId", "cvId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_offerId_key" ON "Application"("offerId");

-- CreateIndex
CREATE INDEX "Application_status_position_idx" ON "Application"("status", "position");

-- CreateIndex
CREATE INDEX "ApplicationEvent_applicationId_at_idx" ON "ApplicationEvent"("applicationId", "at");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "Cv"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "Cv"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
