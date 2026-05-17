import { AppError } from "../../../shared/application/AppError.js";
import {
  businessCacheKey,
  getCached,
  invalidateBusinessCache,
} from "../../../shared/infrastructure/cache.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import type { AuthenticatedContext } from "../../../shared/presentation/authenticatedRequest.js";
import { coinService } from "../../coins/application/coinService.js";
import type { ExpenseRepository, PaymentMethod } from "../domain/expenseRepository.js";

type CreateExpenseInput = {
  category?: string;
  amount?: number;
  description?: string;
  paymentMethod?: string;
};

export class ExpenseService {
  constructor(private readonly repository: ExpenseRepository) {}

  async createExpense(context: AuthenticatedContext, input: CreateExpenseInput) {
    const businessProfileId = this.requireBusiness(context);

    const category = requireText(input.category, "Category");
    const amountKobo = toMoneyKobo(input.amount, "Amount");
    const paymentMethod = parsePaymentMethod(input.paymentMethod);
    const description = normalizeOptionalText(input.description);

    if (amountKobo <= 0) {
      throw new AppError("Amount must be greater than zero", 422, "INVALID_AMOUNT");
    }

    const expense = await this.repository.createExpense({
      businessProfileId,
      category,
      amountKobo,
      description,
      paymentMethod,
    });

    invalidateBusinessCache(businessProfileId, ["dashboard-summary", "expenses"]);

    try {
      await coinService.awardCoins(businessProfileId, "EXPENSE_RECORDED", expense.id);
    } catch (err) {
      logger.warn("Failed to award coins for expense", { expenseId: expense.id, err });
    }

    return {
      expense: {
        id: expense.id,
        category: expense.category,
        amount: fromKobo(expense.amountKobo),
        description: expense.description,
        paymentMethod: expense.paymentMethod,
        createdAt: expense.createdAt.toISOString(),
      },
    };
  }

  async listExpenses(
    context: AuthenticatedContext,
    options: { limit?: number; cursor?: string } = {},
  ) {
    const businessProfileId = this.requireBusiness(context);
    const limit = clampLimit(options.limit);
    const cursor = normalizeOptionalText(options.cursor);

    return getCached(
      businessCacheKey(businessProfileId, "expenses", [limit, cursor]),
      30_000,
      async () => {
        const result = await this.repository.listExpenses({
          businessProfileId,
          limit,
          cursor,
        });

        return {
          nextCursor: result.nextCursor,
          expenses: result.expenses.map((expense) => ({
            id: expense.id,
            category: expense.category,
            amount: fromKobo(expense.amountKobo),
            description: expense.description,
            paymentMethod: expense.paymentMethod,
            createdAt: expense.createdAt.toISOString(),
          })),
        };
      },
    );
  }

  async deleteExpense(context: AuthenticatedContext, id: string) {
    const businessProfileId = this.requireBusiness(context);
    await this.repository.removeExpense(id, businessProfileId);
    invalidateBusinessCache(businessProfileId, ["expenses", "dashboard-summary"]);
    return { ok: true };
  }

  private requireBusiness(context: AuthenticatedContext) {
    if (!context.business) {
      throw new AppError(
        "Complete business onboarding before recording expenses",
        403,
        "BUSINESS_REQUIRED",
      );
    }
    return context.business.id;
  }
}

function parsePaymentMethod(value: string | undefined): PaymentMethod {
  if (value === "CASH" || value === "TRANSFER" || value === "CARD") return value;
  throw new AppError("Invalid payment method", 422, "INVALID_PAYMENT_METHOD");
}

function requireText(value: string | undefined, label: string) {
  const text = normalizeOptionalText(value);
  if (!text) throw new AppError(`${label} is required`, 422, "REQUIRED_FIELD");
  return text;
}

function normalizeOptionalText(value: string | undefined) {
  const text = value?.trim();
  return text || undefined;
}

function toMoneyKobo(value: number | undefined, label: string) {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    throw new AppError(`${label} is invalid`, 422, "INVALID_MONEY");
  }
  return Math.round(value * 100);
}

function fromKobo(value: number) {
  return value / 100;
}

function clampLimit(value: number | undefined) {
  if (value === undefined || !Number.isInteger(value)) return 50;
  return Math.min(Math.max(value, 1), 100);
}
