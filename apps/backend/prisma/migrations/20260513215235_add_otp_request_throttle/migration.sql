-- CreateTable
CREATE TABLE "OtpRequestThrottle" (
    "phone" TEXT NOT NULL,
    "lastRequestedAt" TIMESTAMP(3) NOT NULL,
    "hourlyWindowStartedAt" TIMESTAMP(3) NOT NULL,
    "hourlyCount" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtpRequestThrottle_pkey" PRIMARY KEY ("phone")
);

-- CreateIndex
CREATE INDEX "OtpRequestThrottle_updatedAt_idx" ON "OtpRequestThrottle"("updatedAt");
