-- CreateTable
CREATE TABLE "ConsignmentSettlement" (
    "id" TEXT NOT NULL,
    "businessProfileId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "stockItemId" TEXT,
    "amountKobo" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsignmentSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsignmentSettlement_businessProfileId_createdAt_idx" ON "ConsignmentSettlement"("businessProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsignmentSettlement_supplierId_createdAt_idx" ON "ConsignmentSettlement"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsignmentSettlement_stockItemId_createdAt_idx" ON "ConsignmentSettlement"("stockItemId", "createdAt");

-- AddForeignKey
ALTER TABLE "ConsignmentSettlement" ADD CONSTRAINT "ConsignmentSettlement_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsignmentSettlement" ADD CONSTRAINT "ConsignmentSettlement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsignmentSettlement" ADD CONSTRAINT "ConsignmentSettlement_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
