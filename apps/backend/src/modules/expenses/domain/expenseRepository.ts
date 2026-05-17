export type PaymentMethod = "CASH" | "TRANSFER" | "CARD";

export type CreateExpenseData = {
  businessProfileId: string;
  category: string;
  amountKobo: number;
  description?: string;
  paymentMethod: PaymentMethod;
};

export type ExpenseRecord = {
  id: string;
  businessProfileId: string;
  category: string;
  amountKobo: number;
  description: string | null;
  paymentMethod: PaymentMethod;
  createdAt: Date;
  updatedAt: Date;
};

export type ListExpensesResult = {
  expenses: ExpenseRecord[];
  nextCursor: string | null;
};

export interface ExpenseRepository {
  createExpense(data: CreateExpenseData): Promise<ExpenseRecord>;
  listExpenses(options: {
    businessProfileId: string;
    limit: number;
    cursor?: string;
  }): Promise<ListExpensesResult>;
  removeExpense(id: string, businessProfileId: string): Promise<void>;
}
