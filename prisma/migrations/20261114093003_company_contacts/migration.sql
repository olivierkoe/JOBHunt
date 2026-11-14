-- CreateTable
CREATE TABLE "Company" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "companyKey" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "url" TEXT,
    "source" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_companyKey_idx" ON "Contact"("companyKey");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyKey_fkey" FOREIGN KEY ("companyKey") REFERENCES "Company"("key") ON DELETE CASCADE ON UPDATE CASCADE;
