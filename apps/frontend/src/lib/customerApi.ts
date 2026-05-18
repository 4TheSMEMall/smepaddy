import { deleteJson, getJson, patchJson, postJson } from "@/lib/api";

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerDetail = {
  customer: Customer & {
    stats: {
      totalInvoices: number;
      totalSales: number;
      totalOutstanding: number;
      totalSpent: number;
    };
  };
  invoices: {
    id: string;
    status: string;
    subtotal: number;
    amountPaid: number;
    balance: number;
    dueDate: string;
    createdAt: string;
  }[];
  sales: {
    id: string;
    paymentStatus: string;
    subtotal: number;
    amountPaid: number;
    balance: number;
    itemNames: string[];
    createdAt: string;
  }[];
};

export type UnpaidInvoice = {
  id: string;
  status: string;
  subtotal: number;
  amountPaid: number;
  balance: number;
  dueDate: string;
  createdAt: string;
  description: string;
};

export function listCustomers(token: string, search?: string) {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  return getJson<{ customers: Customer[] }>(`/customers${q}`, token);
}

export function getCustomer(token: string, id: string) {
  return getJson<CustomerDetail>(`/customers/${id}`, token);
}

export function createCustomer(token: string, payload: { name: string; phone?: string; email?: string; address?: string; notes?: string }) {
  return postJson<{ customer: Customer }>("/customers", payload, token);
}

export function updateCustomer(token: string, id: string, payload: { name?: string; phone?: string; email?: string; address?: string; notes?: string }) {
  return patchJson<{ customer: Customer }>(`/customers/${id}`, payload, token);
}

export function deleteCustomer(token: string, id: string) {
  return deleteJson<{ deleted: boolean }>(`/customers/${id}`, token);
}

export function getCustomerUnpaidInvoices(token: string, customerId: string) {
  return getJson<{ invoices: UnpaidInvoice[] }>(`/customers/${customerId}/unpaid-invoices`, token);
}
