import { getJson, postJson } from "@/lib/api";

export type InvoiceStatus = "PAID" | "PENDING" | "OVERDUE";

export type Invoice = {
  id: string;
  customerName: string;
  customerPhone: string | null;
  status: InvoiceStatus;
  subtotal: number;
  amountPaid: number;
  balance: number;
  dueDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: {
    id: string;
    stockItemId: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  payments: {
    id: string;
    amount: number;
    paymentMethod: "CASH" | "TRANSFER" | "CARD";
    note: string | null;
    createdAt: string;
  }[];
};

export type InvoiceSummary = {
  paid: number;
  pending: number;
  overdue: number;
};

export type CreateInvoicePayload = {
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  dueDate: string;
  notes?: string;
  items: {
    stockItemId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
};

export function listInvoices(
  token: string,
  options: { limit?: number; cursor?: string } = {},
) {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.cursor) params.set("cursor", options.cursor);
  const query = params.toString();
  return getJson<{
    invoices: Invoice[];
    summary: InvoiceSummary;
    nextCursor: string | null;
  }>(`/invoices${query ? `?${query}` : ""}`, token);
}

export function createInvoice(token: string, payload: CreateInvoicePayload) {
  return postJson<{ invoice: Invoice }>("/invoices", payload, token);
}

export function getInvoice(token: string, invoiceId: string) {
  return getJson<{ invoice: Invoice }>(`/invoices/${invoiceId}`, token);
}

export function recordInvoicePayment(
  token: string,
  invoiceId: string,
  payload: {
    amount: number;
    paymentMethod: "CASH" | "TRANSFER" | "CARD";
    note?: string;
  },
) {
  return postJson<{ invoice: Invoice }>(
    `/invoices/${invoiceId}/payments`,
    payload,
    token,
  );
}
