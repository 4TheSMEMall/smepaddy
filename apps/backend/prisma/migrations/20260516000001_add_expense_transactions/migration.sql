-- Create ExpenseTransaction table for recording business expenses.

CREATE TABLE "ExpenseTransaction" (
    "id"                TEXT NOT NULL,
    "businessProfileId" TEXT NOT NULL,
    "category"          TEXT NOT NULL,
    "amountKobo"        INTEGER NOT NULL,
    "description"       TEXT,
    "paymentMethod"     "PaymentMethod" NOT NULL,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExpenseTransaction_businessProfileId_createdAt_idx"
    ON "ExpenseTransaction"("businessProfileId", "createdAt");

CREATE INDEX "ExpenseTransaction_businessProfileId_category_idx"
    ON "ExpenseTransaction"("businessProfileId", "category");

ALTER TABLE "ExpenseTransaction"
    ADD CONSTRAINT "ExpenseTransaction_businessProfileId_fkey"
    FOREIGN KEY ("businessProfileId")
    REFERENCES "BusinessProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
