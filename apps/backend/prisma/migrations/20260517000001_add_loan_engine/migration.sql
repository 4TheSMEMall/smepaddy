-- Loan Engine: Loan and LoanRepayment tables.

CREATE TYPE "LoanType"   AS ENUM ('NANO', 'MICRO', 'SMALL', 'GROWTH');
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DEFAULTED');

CREATE TABLE "Loan" (
    "id"                TEXT           NOT NULL,
    "businessProfileId" TEXT           NOT NULL,
    "loanType"          "LoanType"     NOT NULL,
    "status"            "LoanStatus"   NOT NULL DEFAULT 'ACTIVE',
    "principalKobo"     INTEGER        NOT NULL,
    "interestKobo"      INTEGER        NOT NULL,
    "totalKobo"         INTEGER        NOT NULL,
    "amountRepaidKobo"  INTEGER        NOT NULL DEFAULT 0,
    "balanceKobo"       INTEGER        NOT NULL,
    "tenureDays"        INTEGER        NOT NULL,
    "dueDate"           TIMESTAMP(3)   NOT NULL,
    "pcsAtApplication"  INTEGER        NOT NULL,
    "disbursedAt"       TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"       TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)   NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Loan_businessProfileId_status_idx"    ON "Loan"("businessProfileId", "status");
CREATE INDEX "Loan_businessProfileId_createdAt_idx" ON "Loan"("businessProfileId", "createdAt");

ALTER TABLE "Loan"
    ADD CONSTRAINT "Loan_businessProfileId_fkey"
    FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LoanRepayment" (
    "id"            TEXT           NOT NULL,
    "loanId"        TEXT           NOT NULL,
    "amountKobo"    INTEGER        NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paidOnTime"    BOOLEAN        NOT NULL,
    "note"          TEXT,
    "createdAt"     TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanRepayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoanRepayment_loanId_createdAt_idx" ON "LoanRepayment"("loanId", "createdAt");

ALTER TABLE "LoanRepayment"
    ADD CONSTRAINT "LoanRepayment_loanId_fkey"
    FOREIGN KEY ("loanId") REFERENCES "Loan"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
