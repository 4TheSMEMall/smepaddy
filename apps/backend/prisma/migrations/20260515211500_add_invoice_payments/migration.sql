CREATE TABLE "InvoicePayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "businessProfileId" TEXT NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvoicePayment_invoiceId_createdAt_idx" ON "InvoicePayment"("invoiceId", "createdAt");
CREATE INDEX "InvoicePayment_businessProfileId_createdAt_idx" ON "InvoicePayment"("businessProfileId", "createdAt");

ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
