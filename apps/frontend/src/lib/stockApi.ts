import { getJson, patchJson, postJson } from "@/lib/api";

export type StockItem = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  itemType: "PRODUCT" | "SERVICE";
  ownershipType: "OWNED" | "CONSIGNMENT";
  unitType: string;
  buyingPrice: number;
  sellingPrice: number;
  wholesalePrice: number;
  ownerCostPerUnit: number | null;
  quantity: number;
  lowStockAlertQuantity: number | null;
  preferredReorderAmount: number | null;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  supplier: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    bankName: string | null;
    accountName: string | null;
    accountNumber: string | null;
    address: string | null;
    notes: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  address: string | null;
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type StockMovement = {
  id: string;
  stockItemId: string;
  type: "OPENING_STOCK" | "MANUAL_ADJUSTMENT" | "SALE" | "RESTOCK" | "RETURN" | "DAMAGE";
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  note: string | null;
  createdAt: string;
};

export type StockItemSale = {
  id: string;
  saleTransactionId: string;
  customerName: string | null;
  paymentStatus: "PAID" | "PART_PAYMENT" | "WILL_PAY_LATER";
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
};

export type StockItemSalesSummary = {
  unitsSold: number;
  revenue: number;
  ownerPayable: number;
  totalSettled: number;
  outstandingBalance: number;
};

export type CreateStockItemPayload = {
  name: string;
  description?: string;
  category: string;
  itemType: "PRODUCT" | "SERVICE";
  ownershipType: "OWNED" | "CONSIGNMENT";
  unitType: string;
  buyingPrice: number;
  sellingPrice: number;
  wholesalePrice: number;
  quantity: number;
  supplierId?: string;
  supplierName?: string;
  supplierPhone?: string;
  ownerCostPerUnit?: number;
  lowStockAlertQuantity?: number;
  preferredReorderAmount?: number;
};

export type CreateSupplierPayload = {
  name: string;
  phone?: string;
  email?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  address?: string;
  notes?: string;
};

export function listStockItems(
  token: string,
  filters: {
    search?: string;
    ownershipType?: "OWNED" | "CONSIGNMENT";
    category?: string;
    restockOnly?: boolean;
    limit?: number;
    cursor?: string;
  } = {},
) {
  const params = new URLSearchParams();

  if (filters.search) params.set("search", filters.search);
  if (filters.ownershipType) params.set("ownershipType", filters.ownershipType);
  if (filters.category) params.set("category", filters.category);
  if (filters.restockOnly) params.set("filter", "restock");
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.cursor) params.set("cursor", filters.cursor);

  const query = params.toString();
  return getJson<{ items: StockItem[]; nextCursor: string | null }>(
    `/stock/items${query ? `?${query}` : ""}`,
    token,
  );
}

export function createStockItem(token: string, payload: CreateStockItemPayload) {
  return postJson<{ item: StockItem }>("/stock/items", payload, token);
}

export function getStockItem(token: string, itemId: string) {
  return getJson<{ item: StockItem }>(`/stock/items/${itemId}`, token);
}

export function updateStockItem(
  token: string,
  itemId: string,
  payload: Partial<CreateStockItemPayload>,
) {
  return patchJson<{ item: StockItem }>(`/stock/items/${itemId}`, payload, token);
}

export function listStockMovements(token: string, itemId: string) {
  return getJson<{ movements: StockMovement[] }>(
    `/stock/items/${itemId}/movements`,
    token,
  );
}

export function listStockItemSales(token: string, itemId: string) {
  return getJson<{ summary: StockItemSalesSummary; sales: StockItemSale[] }>(
    `/stock/items/${itemId}/sales`,
    token,
  );
}

export function listSuppliers(token: string) {
  return getJson<{ suppliers: Supplier[] }>("/stock/suppliers", token);
}

export function createSupplier(token: string, payload: CreateSupplierPayload) {
  return postJson<{ supplier: Supplier }>("/stock/suppliers", payload, token);
}
