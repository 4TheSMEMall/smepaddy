export type StockItemType = "PRODUCT" | "SERVICE";
export type StockOwnershipType = "OWNED" | "CONSIGNMENT";
export type StockMovementType =
  | "OPENING_STOCK"
  | "MANUAL_ADJUSTMENT"
  | "SALE"
  | "RESTOCK"
  | "RETURN"
  | "DAMAGE";

export type SupplierRecord = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  address: string | null;
  notes: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type StockItemRecord = {
  id: string;
  businessProfileId: string;
  supplier: SupplierRecord | null;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  itemType: StockItemType;
  ownershipType: StockOwnershipType;
  unitType: string;
  buyingPriceKobo: number;
  sellingPriceKobo: number;
  wholesalePriceKobo: number;
  ownerCostPerUnitKobo: number | null;
  quantity: number;
  lowStockAlertQuantity: number | null;
  preferredReorderAmount: number | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type StockMovementRecord = {
  id: string;
  stockItemId: string;
  businessProfileId: string;
  type: StockMovementType;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  note: string | null;
  createdAt: Date;
};

export type StockItemSaleRecord = {
  id: string;
  saleTransactionId: string;
  customerName: string | null;
  paymentStatus: "PAID" | "PART_PAYMENT" | "WILL_PAY_LATER";
  quantity: number;
  unitPriceKobo: number;
  totalKobo: number;
  createdAt: Date;
};

export type StockItemSettlementRecord = {
  id: string;
  amountKobo: number;
  createdAt: Date;
};

export type CreateStockItemData = {
  businessProfileId: string;
  supplierId?: string;
  supplierName?: string;
  supplierPhone?: string;
  name: string;
  description?: string;
  category: string;
  itemType: StockItemType;
  ownershipType: StockOwnershipType;
  unitType: string;
  buyingPriceKobo: number;
  sellingPriceKobo: number;
  wholesalePriceKobo: number;
  ownerCostPerUnitKobo?: number;
  quantity: number;
  lowStockAlertQuantity?: number;
  preferredReorderAmount?: number;
};

export type UpdateStockItemData = Partial<Omit<CreateStockItemData, "businessProfileId">> & {
  id: string;
  businessProfileId: string;
};

export type CreateSupplierData = {
  businessProfileId: string;
  name: string;
  phone?: string;
  email?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  address?: string;
  notes?: string;
};

export type StockItemFilters = {
  businessProfileId: string;
  search?: string;
  category?: string;
  ownershipType?: StockOwnershipType;
  itemType?: StockItemType;
  restockOnly?: boolean;
  limit: number;
  cursor?: string;
};

export interface StockRepository {
  createSupplier(input: CreateSupplierData): Promise<SupplierRecord>;
  listSuppliers(input: { businessProfileId: string }): Promise<SupplierRecord[]>;
  createItem(input: CreateStockItemData): Promise<StockItemRecord>;
  listItems(filters: StockItemFilters): Promise<{
    items: StockItemRecord[];
    nextCursor: string | null;
  }>;
  findItemById(input: {
    businessProfileId: string;
    id: string;
  }): Promise<StockItemRecord | null>;
  listMovements(input: {
    businessProfileId: string;
    stockItemId: string;
  }): Promise<StockMovementRecord[]>;
  listItemSales(input: {
    businessProfileId: string;
    stockItemId: string;
  }): Promise<StockItemSaleRecord[]>;
  listItemSettlements(input: {
    businessProfileId: string;
    stockItemId: string;
  }): Promise<StockItemSettlementRecord[]>;
  updateItem(input: UpdateStockItemData): Promise<StockItemRecord>;
  archiveItem(input: { businessProfileId: string; id: string }): Promise<void>;
}
