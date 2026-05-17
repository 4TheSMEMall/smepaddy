CREATE TABLE "CoinRedemption" (
    "id"                TEXT    NOT NULL,
    "businessProfileId" TEXT    NOT NULL,
    "coinsSpent"        INTEGER NOT NULL,
    "tier"              TEXT    NOT NULL,
    "rewardType"        TEXT    NOT NULL,
    "rewardValue"       INTEGER NOT NULL,
    "status"            TEXT    NOT NULL DEFAULT 'PENDING',
    "note"              TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoinRedemption_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CoinRedemption_businessProfileId_createdAt_idx" ON "CoinRedemption"("businessProfileId", "createdAt");
ALTER TABLE "CoinRedemption" ADD CONSTRAINT "CoinRedemption_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
