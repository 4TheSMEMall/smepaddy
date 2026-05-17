import { deleteJson, getJson, patchJson, postJson } from "@/lib/api";

export type RecurringFrequency = "DAILY" | "WEEKLY" | "MONTHLY";
export type RecurringPaymentMethod = "CASH" | "TRANSFER" | "CARD";

export type RecurringExpenseItem = {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  paymentMethod: RecurringPaymentMethod;
  frequency: RecurringFrequency;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  hourOfDay: number;
  isActive: boolean;
  startDate: string;
  endDate: string | null;
  lastRunAt: string | null;
  nextRunAt: string;
  createdAt: string;
};

export type CreateRecurringExpensePayload = {
  category: string;
  amount: number;
  description?: string;
  paymentMethod: RecurringPaymentMethod;
  frequency: RecurringFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  hourOfDay: number;
};

export type UpdateRecurringExpensePayload = {
  isActive?: boolean;
  amount?: number;
  description?: string;
  hourOfDay?: number;
};

export function listRecurringExpenses(token: string) {
  return getJson<{ recurringExpenses: RecurringExpenseItem[] }>("/recurring-expenses", token);
}

export function createRecurringExpense(token: string, payload: CreateRecurringExpensePayload) {
  return postJson<{ recurringExpense: RecurringExpenseItem }>("/recurring-expenses", payload, token);
}

export function updateRecurringExpense(token: string, id: string, payload: UpdateRecurringExpensePayload) {
  return patchJson<{ recurringExpense: RecurringExpenseItem }>(`/recurring-expenses/${id}`, payload, token);
}

export function deleteRecurringExpense(token: string, id: string) {
  return deleteJson<{ ok: boolean }>(`/recurring-expenses/${id}`, token);
}
