import { prisma } from "../../../shared/infrastructure/prismaClient.js";
import type {
  CreateRecurringExpenseData,
  DueRecurringExpense,
  RecurringExpenseRecord,
  RecurringExpenseRepository,
  UpdateRecurringExpenseData,
} from "../domain/recurringExpenseRepository.js";

export class PrismaRecurringExpenseRepository implements RecurringExpenseRepository {
  async create(data: CreateRecurringExpenseData): Promise<RecurringExpenseRecord> {
    return prisma.recurringExpense.create({ data }) as Promise<RecurringExpenseRecord>;
  }

  async list(businessProfileId: string): Promise<RecurringExpenseRecord[]> {
    return prisma.recurringExpense.findMany({
      where: { businessProfileId },
      orderBy: { createdAt: "desc" },
    }) as Promise<RecurringExpenseRecord[]>;
  }

  async findById(id: string, businessProfileId: string): Promise<RecurringExpenseRecord | null> {
    return prisma.recurringExpense.findFirst({
      where: { id, businessProfileId },
    }) as Promise<RecurringExpenseRecord | null>;
  }

  async update(id: string, data: UpdateRecurringExpenseData): Promise<RecurringExpenseRecord> {
    return prisma.recurringExpense.update({
      where: { id },
      data,
    }) as Promise<RecurringExpenseRecord>;
  }

  async remove(id: string, businessProfileId: string): Promise<void> {
    await prisma.recurringExpense.deleteMany({ where: { id, businessProfileId } });
  }

  async findDue(now: Date): Promise<DueRecurringExpense[]> {
    const rows = await prisma.recurringExpense.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: {
        businessProfile: {
          select: {
            id: true,
            businessName: true,
            user: { select: { email: true, fullName: true } },
          },
        },
      },
    });

    return rows as unknown as DueRecurringExpense[];
  }

  async markRan(id: string, lastRunAt: Date, nextRunAt: Date): Promise<void> {
    await prisma.recurringExpense.update({
      where: { id },
      data: { lastRunAt, nextRunAt },
    });
  }
}
