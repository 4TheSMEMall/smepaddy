-- Savings module: entries, verification attempts, target, and account.

CREATE TYPE "SavingsEntryStatus"  AS ENUM ('DECLARED', 'RECONCILED', 'VERIFIED');
CREATE TYPE "SavingsTargetPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

CREATE TABLE "SavingsEntry" (
    "id"                     TEXT           NOT NULL,
    "businessProfileId"      TEXT           NOT NULL,
    "amount"                 DECIMAL(12,2)  NOT NULL,
    "note"                   TEXT,
    "savedAt"                TIMESTAMP(3)   NOT NULL,
    "status"                 "SavingsEntryStatus" NOT NULL DEFAULT 'DECLARED',
    "verificationReference"  TEXT,
    "verificationTransferId" TEXT,
    "verifiedAt"             TIMESTAMP(3),
    "payoutStatus"           TEXT,
    "payoutReference"        TEXT,
    "payoutTransferId"       TEXT,
    "payoutFailureReason"    TEXT,
    "payoutTransferredAt"    TIMESTAMP(3),
    "reconciledAt"           TIMESTAMP(3),
    "createdAt"              TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3)   NOT NULL,
    CONSTRAINT "SavingsEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavingsEntry_businessProfileId_savedAt_idx"  ON "SavingsEntry"("businessProfileId", "savedAt");
CREATE INDEX "SavingsEntry_businessProfileId_status_idx"   ON "SavingsEntry"("businessProfileId", "status");

ALTER TABLE "SavingsEntry"
    ADD CONSTRAINT "SavingsEntry_businessProfileId_fkey"
    FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SavingsVerificationAttempt" (
    "id"                TEXT          NOT NULL,
    "businessProfileId" TEXT          NOT NULL,
    "savingsEntryId"    TEXT          NOT NULL,
    "reference"         TEXT          NOT NULL,
    "expectedAmount"    DECIMAL(12,2) NOT NULL,
    "status"            TEXT          NOT NULL DEFAULT 'PENDING',
    "authorizationUrl"  TEXT          NOT NULL,
    "accessCode"        TEXT,
    "paystackEmail"     TEXT          NOT NULL,
    "flwTransactionId"  TEXT,
    "flwReference"      TEXT,
    "expiresAt"         TIMESTAMP(3),
    "verifiedAt"        TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)  NOT NULL,
    CONSTRAINT "SavingsVerificationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavingsVerificationAttempt_reference_key" ON "SavingsVerificationAttempt"("reference");
CREATE INDEX "SavingsVerificationAttempt_savingsEntryId_idx"          ON "SavingsVerificationAttempt"("savingsEntryId");
CREATE INDEX "SavingsVerificationAttempt_businessProfileId_reference_idx" ON "SavingsVerificationAttempt"("businessProfileId", "reference");

ALTER TABLE "SavingsVerificationAttempt"
    ADD CONSTRAINT "SavingsVerificationAttempt_savingsEntryId_fkey"
    FOREIGN KEY ("savingsEntryId") REFERENCES "SavingsEntry"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SavingsTarget" (
    "id"                TEXT                  NOT NULL,
    "businessProfileId" TEXT                  NOT NULL,
    "amount"            DECIMAL(12,2)         NOT NULL,
    "period"            "SavingsTargetPeriod" NOT NULL DEFAULT 'DAILY',
    "createdAt"         TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)          NOT NULL,
    CONSTRAINT "SavingsTarget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavingsTarget_businessProfileId_key" ON "SavingsTarget"("businessProfileId");

ALTER TABLE "SavingsTarget"
    ADD CONSTRAINT "SavingsTarget_businessProfileId_fkey"
    FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SavingsAccount" (
    "id"                TEXT         NOT NULL,
    "businessProfileId" TEXT         NOT NULL,
    "bankName"          TEXT         NOT NULL,
    "bankCode"          TEXT         NOT NULL,
    "accountNumber"     TEXT         NOT NULL,
    "accountName"       TEXT         NOT NULL,
    "setupAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SavingsAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavingsAccount_businessProfileId_key" ON "SavingsAccount"("businessProfileId");

ALTER TABLE "SavingsAccount"
    ADD CONSTRAINT "SavingsAccount_businessProfileId_fkey"
    FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
