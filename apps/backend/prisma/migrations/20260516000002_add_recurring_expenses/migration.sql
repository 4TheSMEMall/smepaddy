-- Create RecurringFrequency enum and RecurringExpense table.

CREATE TYPE "RecurringFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

CREATE TABLE "RecurringExpense" (
    "id"                TEXT NOT NULL,
    "businessProfileId" TEXT NOT NULL,
    "category"          TEXT NOT NULL,
    "amountKobo"        INTEGER NOT NULL,
    "description"       TEXT,
    "paymentMethod"     "PaymentMethod" NOT NULL,
    "frequency"         "RecurringFrequency" NOT NULL,
    "dayOfWeek"         INTEGER,
    "dayOfMonth"        INTEGER,
    "hourOfDay"         INTEGER NOT NULL DEFAULT 8,
    "isActive"          BOOLEAN NOT NULL DEFAULT true,
    "startDate"         TIMESTAMP(3) NOT NULL,
    "endDate"           TIMESTAMP(3),
    "lastRunAt"         TIMESTAMP(3),
    "nextRunAt"         TIMESTAMP(3) NOT NULL,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecurringExpense_nextRunAt_isActive_idx"
    ON "RecurringExpense"("nextRunAt", "isActive");

CREATE INDEX "RecurringExpense_businessProfileId_idx"
    ON "RecurringExpense"("businessProfileId");

ALTER TABLE "RecurringExpense"
    ADD CONSTRAINT "RecurringExpense_businessProfileId_fkey"
    FOREIGN KEY ("businessProfileId")
    REFERENCES "BusinessProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
