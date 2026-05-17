import { prisma } from "../../../shared/infrastructure/prismaClient.js";
import type {
  CreateExpenseData,
  ExpenseRecord,
  ExpenseRepository,
  ListExpensesResult,
} from "../domain/expenseRepository.js";

export class PrismaExpenseRepository implements ExpenseRepository {
  async createExpense(data: CreateExpenseData): Promise<ExpenseRecord> {
    const record = await prisma.expenseTransaction.create({
      data: {
        businessProfileId: data.businessProfileId,
        category: data.category,
        amountKobo: data.amountKobo,
        description: data.description,
        paymentMethod: data.paymentMethod,
      },
    });

    return record as ExpenseRecord;
  }

  async removeExpense(id: string, businessProfileId: string): Promise<void> {
    await prisma.expenseTransaction.deleteMany({ where: { id, businessProfileId } });
  }

  async listExpenses(options: {
    businessProfileId: string;
    limit: number;
    cursor?: string;
  }): Promise<ListExpensesResult> {
    const { businessProfileId, limit, cursor } = options;

    const rows = await prisma.expenseTransaction.findMany({
      where: { businessProfileId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    let nextCursor: string | null = null;
    if (rows.length > limit) {
      rows.pop();
      nextCursor = rows[rows.length - 1]?.id ?? null;
    }

    return { expenses: rows as ExpenseRecord[], nextCursor };
  }
}
