import { deleteJson, getJson, postJson } from "@/lib/api";

export type ExpensePaymentMethod = "CASH" | "TRANSFER" | "CARD";

export type CreateExpensePayload = {
  category: string;
  amount: number;
  description?: string;
  paymentMethod: ExpensePaymentMethod;
};

export type ExpenseItem = {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  paymentMethod: ExpensePaymentMethod;
  createdAt: string;
};

export function listExpenses(token: string, options: { limit?: number; cursor?: string } = {}) {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.cursor) params.set("cursor", options.cursor);
  const query = params.toString();
  return getJson<{ expenses: ExpenseItem[]; nextCursor: string | null }>(
    `/expenses${query ? `?${query}` : ""}`,
    token,
  );
}

export function createExpense(token: string, payload: CreateExpensePayload) {
  return postJson<{ expense: ExpenseItem }>("/expenses", payload, token);
}

export function deleteExpense(token: string, id: string) {
  return deleteJson<{ ok: boolean }>(`/expenses/${id}`, token);
}
