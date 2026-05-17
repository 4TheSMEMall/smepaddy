export type PaymentMethod = "CASH" | "TRANSFER" | "CARD";
export type RecurringFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

export type CreateRecurringExpenseData = {
  businessProfileId: string;
  category: string;
  amountKobo: number;
  description?: string;
  paymentMethod: PaymentMethod;
  frequency: RecurringFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  hourOfDay: number;
  startDate: Date;
  endDate?: Date;
  nextRunAt: Date;
};

export type UpdateRecurringExpenseData = {
  isActive?: boolean;
  amountKobo?: number;
  description?: string;
  hourOfDay?: number;
  nextRunAt?: Date;
};

export type RecurringExpenseRecord = {
  id: string;
  businessProfileId: string;
  category: string;
  amountKobo: number;
  description: string | null;
  paymentMethod: PaymentMethod;
  frequency: RecurringFrequency;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  hourOfDay: number;
  isActive: boolean;
  startDate: Date;
  endDate: Date | null;
  lastRunAt: Date | null;
  nextRunAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type DueRecurringExpense = RecurringExpenseRecord & {
  businessProfile: {
    id: string;
    businessName: string;
    user: { email: string | null; fullName: string | null };
  };
};

export interface RecurringExpenseRepository {
  create(data: CreateRecurringExpenseData): Promise<RecurringExpenseRecord>;
  list(businessProfileId: string): Promise<RecurringExpenseRecord[]>;
  findById(id: string, businessProfileId: string): Promise<RecurringExpenseRecord | null>;
  update(id: string, data: UpdateRecurringExpenseData): Promise<RecurringExpenseRecord>;
  remove(id: string, businessProfileId: string): Promise<void>;
  findDue(now: Date): Promise<DueRecurringExpense[]>;
  markRan(id: string, lastRunAt: Date, nextRunAt: Date): Promise<void>;
}
