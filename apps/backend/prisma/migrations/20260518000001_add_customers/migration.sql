-- Customer module: create Customer table and link to Invoice + SaleTransaction.

CREATE TABLE "Customer" (
    "id"                TEXT         NOT NULL,
    "businessProfileId" TEXT         NOT NULL,
    "name"              TEXT         NOT NULL,
    "phone"             TEXT,
    "email"             TEXT,
    "address"           TEXT,
    "notes"             TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Customer_businessProfileId_name_idx"  ON "Customer"("businessProfileId", "name");
CREATE INDEX "Customer_businessProfileId_phone_idx" ON "Customer"("businessProfileId", "phone");

ALTER TABLE "Customer"
    ADD CONSTRAINT "Customer_businessProfileId_fkey"
    FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Add customerId to Invoice (optional link)
ALTER TABLE "Invoice" ADD COLUMN "customerId" TEXT;

ALTER TABLE "Invoice"
    ADD CONSTRAINT "Invoice_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Add customerId to SaleTransaction (optional link)
ALTER TABLE "SaleTransaction" ADD COLUMN "customerId" TEXT;

ALTER TABLE "SaleTransaction"
    ADD CONSTRAINT "SaleTransaction_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
