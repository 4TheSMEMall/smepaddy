CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'PART_PAYMENT', 'WILL_PAY_LATER');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD');
CREATE TYPE "InvoiceStatus" AS ENUM ('PAID', 'PENDING', 'OVERDUE');

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "businessProfileId" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
  "subtotalKobo" INTEGER NOT NULL,
  "amountPaidKobo" INTEGER NOT NULL DEFAULT 0,
  "balanceKobo" INTEGER NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceItem" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "stockItemId" TEXT,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPriceKobo" INTEGER NOT NULL,
  "totalKobo" INTEGER NOT NULL,
  CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaleTransaction" (
  "id" TEXT NOT NULL,
  "businessProfileId" TEXT NOT NULL,
  "invoiceId" TEXT,
  "customerName" TEXT,
  "paymentStatus" "PaymentStatus" NOT NULL,
  "paymentMethod" "PaymentMethod",
  "subtotalKobo" INTEGER NOT NULL,
  "amountPaidKobo" INTEGER NOT NULL,
  "balanceKobo" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SaleTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaleLineItem" (
  "id" TEXT NOT NULL,
  "saleTransactionId" TEXT NOT NULL,
  "stockItemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPriceKobo" INTEGER NOT NULL,
  "totalKobo" INTEGER NOT NULL,
  CONSTRAINT "SaleLineItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Invoice_businessProfileId_status_idx" ON "Invoice"("businessProfileId", "status");
CREATE INDEX "Invoice_businessProfileId_dueDate_idx" ON "Invoice"("businessProfileId", "dueDate");
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE INDEX "InvoiceItem_stockItemId_idx" ON "InvoiceItem"("stockItemId");
CREATE INDEX "SaleTransaction_businessProfileId_createdAt_idx" ON "SaleTransaction"("businessProfileId", "createdAt");
CREATE INDEX "SaleTransaction_businessProfileId_paymentStatus_idx" ON "SaleTransaction"("businessProfileId", "paymentStatus");
CREATE INDEX "SaleTransaction_invoiceId_idx" ON "SaleTransaction"("invoiceId");
CREATE INDEX "SaleLineItem_saleTransactionId_idx" ON "SaleLineItem"("saleTransactionId");
CREATE INDEX "SaleLineItem_stockItemId_idx" ON "SaleLineItem"("stockItemId");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaleTransaction" ADD CONSTRAINT "SaleTransaction_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleTransaction" ADD CONSTRAINT "SaleTransaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaleLineItem" ADD CONSTRAINT "SaleLineItem_saleTransactionId_fkey" FOREIGN KEY ("saleTransactionId") REFERENCES "SaleTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleLineItem" ADD CONSTRAINT "SaleLineItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
