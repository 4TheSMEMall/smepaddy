import { getJson, postJson } from "@/lib/api";

export type PaymentStatus = "PAID" | "PART_PAYMENT" | "WILL_PAY_LATER";
export type PaymentMethod = "CASH" | "TRANSFER" | "CARD";

export type CreateSalePayload = {
  stockItemId: string;
  quantity: number;
  unitPrice: number;
  customerId?: string;
  customerName?: string;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  amountPaid?: number;
  invoiceId?: string;
  createInvoice?: {
    customerId?: string;
    customerName: string;
    customerPhone?: string;
    dueDate: string;
    notes?: string;
  };
};

export type SaleResponse = {
  sale: {
    id: string;
    invoiceId: string | null;
    customerName: string | null;
    paymentStatus: PaymentStatus;
    paymentMethod: PaymentMethod | null;
    subtotal: number;
    amountPaid: number;
    balance: number;
    createdAt: string;
  };
};

export type SaleListItem = SaleResponse["sale"] & {
  itemNames: string[];
};

export function listSales(token: string, options: { limit?: number; cursor?: string } = {}) {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.cursor) params.set("cursor", options.cursor);
  const query = params.toString();
  return getJson<{ sales: SaleListItem[]; nextCursor: string | null }>(
    `/sales${query ? `?${query}` : ""}`,
    token,
  );
}

export function createSale(token: string, payload: CreateSalePayload) {
  return postJson<SaleResponse>("/sales", payload, token);
}
