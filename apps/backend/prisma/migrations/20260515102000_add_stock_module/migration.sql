CREATE TYPE "StockItemType" AS ENUM ('PRODUCT', 'SERVICE');
CREATE TYPE "StockOwnershipType" AS ENUM ('OWNED', 'CONSIGNMENT');
CREATE TYPE "StockMovementType" AS ENUM (
  'OPENING_STOCK',
  'MANUAL_ADJUSTMENT',
  'SALE',
  'RESTOCK',
  'RETURN',
  'DAMAGE'
);

CREATE TABLE "Supplier" (
  "id" TEXT NOT NULL,
  "businessProfileId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockItem" (
  "id" TEXT NOT NULL,
  "businessProfileId" TEXT NOT NULL,
  "supplierId" TEXT,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "itemType" "StockItemType" NOT NULL DEFAULT 'PRODUCT',
  "ownershipType" "StockOwnershipType" NOT NULL DEFAULT 'OWNED',
  "unitType" TEXT NOT NULL DEFAULT 'Pieces',
  "buyingPriceKobo" INTEGER NOT NULL DEFAULT 0,
  "sellingPriceKobo" INTEGER NOT NULL DEFAULT 0,
  "wholesalePriceKobo" INTEGER NOT NULL DEFAULT 0,
  "ownerCostPerUnitKobo" INTEGER,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "lowStockAlertQuantity" INTEGER,
  "preferredReorderAmount" INTEGER,
  "version" INTEGER NOT NULL DEFAULT 1,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL,
  "stockItemId" TEXT NOT NULL,
  "businessProfileId" TEXT NOT NULL,
  "type" "StockMovementType" NOT NULL,
  "quantityChange" INTEGER NOT NULL,
  "quantityBefore" INTEGER NOT NULL,
  "quantityAfter" INTEGER NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Supplier_businessProfileId_name_key"
ON "Supplier"("businessProfileId", "name");
CREATE INDEX "Supplier_businessProfileId_idx" ON "Supplier"("businessProfileId");

CREATE UNIQUE INDEX "StockItem_businessProfileId_sku_key"
ON "StockItem"("businessProfileId", "sku");
CREATE INDEX "StockItem_businessProfileId_archivedAt_idx"
ON "StockItem"("businessProfileId", "archivedAt");
CREATE INDEX "StockItem_businessProfileId_category_idx"
ON "StockItem"("businessProfileId", "category");
CREATE INDEX "StockItem_businessProfileId_ownershipType_idx"
ON "StockItem"("businessProfileId", "ownershipType");
CREATE INDEX "StockItem_businessProfileId_itemType_idx"
ON "StockItem"("businessProfileId", "itemType");
CREATE INDEX "StockItem_businessProfileId_quantity_idx"
ON "StockItem"("businessProfileId", "quantity");

CREATE INDEX "StockMovement_businessProfileId_createdAt_idx"
ON "StockMovement"("businessProfileId", "createdAt");
CREATE INDEX "StockMovement_stockItemId_createdAt_idx"
ON "StockMovement"("stockItemId", "createdAt");
CREATE INDEX "StockMovement_type_idx" ON "StockMovement"("type");

ALTER TABLE "Supplier"
ADD CONSTRAINT "Supplier_businessProfileId_fkey"
FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockItem"
ADD CONSTRAINT "StockItem_businessProfileId_fkey"
FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockItem"
ADD CONSTRAINT "StockItem_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StockMovement"
ADD CONSTRAINT "StockMovement_stockItemId_fkey"
FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
