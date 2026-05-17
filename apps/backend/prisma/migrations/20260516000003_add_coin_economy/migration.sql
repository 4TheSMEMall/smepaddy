-- Wallet, CoinTransaction, and UserStreak tables for the Paddy Coin economy.

CREATE TABLE "Wallet" (
    "id"                TEXT    NOT NULL,
    "businessProfileId" TEXT    NOT NULL,
    "totalEarned"       INTEGER NOT NULL DEFAULT 0,
    "availableBalance"  INTEGER NOT NULL DEFAULT 0,
    "redeemedTotal"     INTEGER NOT NULL DEFAULT 0,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Wallet_businessProfileId_key" ON "Wallet"("businessProfileId");

ALTER TABLE "Wallet"
    ADD CONSTRAINT "Wallet_businessProfileId_fkey"
    FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CoinTransaction" (
    "id"          TEXT    NOT NULL,
    "walletId"    TEXT    NOT NULL,
    "amount"      INTEGER NOT NULL,
    "eventKey"    TEXT    NOT NULL,
    "referenceId" TEXT,
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CoinTransaction_walletId_createdAt_idx"    ON "CoinTransaction"("walletId", "createdAt");
CREATE INDEX "CoinTransaction_walletId_eventKey_createdAt_idx" ON "CoinTransaction"("walletId", "eventKey", "createdAt");

ALTER TABLE "CoinTransaction"
    ADD CONSTRAINT "CoinTransaction_walletId_fkey"
    FOREIGN KEY ("walletId") REFERENCES "Wallet"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UserStreak" (
    "id"                TEXT    NOT NULL,
    "businessProfileId" TEXT    NOT NULL,
    "currentStreak"     INTEGER NOT NULL DEFAULT 0,
    "longestStreak"     INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate"    TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStreak_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserStreak_businessProfileId_key" ON "UserStreak"("businessProfileId");

ALTER TABLE "UserStreak"
    ADD CONSTRAINT "UserStreak_businessProfileId_fkey"
    FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
