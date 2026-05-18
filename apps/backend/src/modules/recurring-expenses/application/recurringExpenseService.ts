import { AppError } from "../../../shared/application/AppError.js";
import { invalidateBusinessCache } from "../../../shared/infrastructure/cache.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import { prisma } from "../../../shared/infrastructure/prismaClient.js";
import type { AuthenticatedContext } from "../../../shared/presentation/authenticatedRequest.js";
import { notificationService } from "../../notifications/application/notificationService.js";
import type {
  PaymentMethod,
  RecurringExpenseRepository,
  RecurringFrequency,
} from "../domain/recurringExpenseRepository.js";

type CreateInput = {
  category?: string;
  amount?: number;
  description?: string;
  paymentMethod?: string;
  frequency?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  hourOfDay?: number;
  startDate?: string;
  endDate?: string;
};

type UpdateInput = {
  isActive?: boolean;
  amount?: number;
  description?: string;
  hourOfDay?: number;
};

export class RecurringExpenseService {
  constructor(private readonly repository: RecurringExpenseRepository) {}

  async create(context: AuthenticatedContext, input: CreateInput) {
    const businessProfileId = this.requireBusiness(context);

    const category = requireText(input.category, "Category");
    const amountKobo = toMoneyKobo(input.amount, "Amount");
    const paymentMethod = parsePaymentMethod(input.paymentMethod);
    const frequency = parseFrequency(input.frequency);
    const hourOfDay = clampHour(input.hourOfDay ?? 8);
    const description = normalizeOptionalText(input.description);
    const startDate = new Date();

    if (frequency === "WEEKLY" && (input.dayOfWeek === undefined || input.dayOfWeek < 0 || input.dayOfWeek > 6)) {
      throw new AppError("Day of week (0–6) is required for weekly frequency", 422, "REQUIRED_FIELD");
    }
    if (frequency === "MONTHLY" && (input.dayOfMonth === undefined || input.dayOfMonth < 1 || input.dayOfMonth > 28)) {
      throw new AppError("Day of month (1–28) is required for monthly frequency", 422, "REQUIRED_FIELD");
    }

    const now = new Date();
    // The first run happens right now. nextRunAt is the *subsequent* occurrence.
    const nextRunAt = computeNextRunAt(frequency, hourOfDay, input.dayOfWeek, input.dayOfMonth, now);
    const endDate = input.endDate ? new Date(input.endDate) : undefined;

    // Create the recurring expense record AND the first expense transaction together.
    const [record] = await prisma.$transaction(async (tx) => {
      const created = await tx.recurringExpense.create({
        data: {
          businessProfileId,
          category,
          amountKobo,
          description,
          paymentMethod,
          frequency,
          dayOfWeek: frequency === "WEEKLY" ? input.dayOfWeek : undefined,
          dayOfMonth: frequency === "MONTHLY" ? input.dayOfMonth : undefined,
          hourOfDay,
          isActive: true,
          startDate,
          endDate,
          lastRunAt: now,
          nextRunAt,
        },
      });

      await tx.expenseTransaction.create({
        data: { businessProfileId, category, amountKobo, description, paymentMethod },
      });

      return [created];
    });

    invalidateBusinessCache(businessProfileId, ["expenses", "dashboard-summary"]);

    return { recurringExpense: toDto(record) };
  }

  async list(context: AuthenticatedContext) {
    const businessProfileId = this.requireBusiness(context);
    const records = await this.repository.list(businessProfileId);
    return { recurringExpenses: records.map(toDto) };
  }

  async update(context: AuthenticatedContext, id: string, input: UpdateInput) {
    const businessProfileId = this.requireBusiness(context);
    const existing = await this.repository.findById(id, businessProfileId);
    if (!existing) throw new AppError("Recurring expense not found", 404, "NOT_FOUND");

    const updateData: Parameters<RecurringExpenseRepository["update"]>[1] = {};

    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.description !== undefined) updateData.description = normalizeOptionalText(input.description);
    if (input.amount !== undefined) updateData.amountKobo = toMoneyKobo(input.amount, "Amount");
    if (input.hourOfDay !== undefined) {
      updateData.hourOfDay = clampHour(input.hourOfDay);
      updateData.nextRunAt = computeNextRunAt(
        existing.frequency,
        clampHour(input.hourOfDay),
        existing.dayOfWeek,
        existing.dayOfMonth,
        new Date(),
      );
    }

    const updated = await this.repository.update(id, updateData);
    return { recurringExpense: toDto(updated) };
  }

  async remove(context: AuthenticatedContext, id: string) {
    const businessProfileId = this.requireBusiness(context);
    const existing = await this.repository.findById(id, businessProfileId);
    if (!existing) throw new AppError("Recurring expense not found", 404, "NOT_FOUND");
    await this.repository.remove(id, businessProfileId);
    return { ok: true };
  }

  // Called by the cron job every minute.
  async processDue(): Promise<void> {
    const now = new Date();
    const due = await this.repository.findDue(now);
    if (due.length === 0) return;

    logger.info("Processing due recurring expenses", { count: due.length });

    for (const recurring of due) {
      try {
        const nextRunAt = computeNextRunAt(
          recurring.frequency,
          recurring.hourOfDay,
          recurring.dayOfWeek,
          recurring.dayOfMonth,
          now,
        );

        // Optimistic lock: atomically claim this entry by advancing nextRunAt.
        // If another cron tick already claimed it, updateMany returns count=0 → skip.
        const claimed = await prisma.recurringExpense.updateMany({
          where: { id: recurring.id, nextRunAt: { lte: now } },
          data: { lastRunAt: now, nextRunAt },
        });

        if (claimed.count === 0) {
          logger.info("Recurring expense already claimed, skipping", { id: recurring.id });
          continue;
        }

        await prisma.expenseTransaction.create({
          data: {
            businessProfileId: recurring.businessProfileId,
            category: recurring.category,
            amountKobo: recurring.amountKobo,
            description: recurring.description,
            paymentMethod: recurring.paymentMethod,
          },
        });

        invalidateBusinessCache(recurring.businessProfileId, ["expenses", "dashboard-summary"]);

        // Push notification handles the user alert — no email needed
        const amount = new Intl.NumberFormat("en-NG", {
          style: "currency",
          currency: "NGN",
          maximumFractionDigits: 0,
        }).format(recurring.amountKobo / 100);

        notificationService.send(recurring.businessProfileId, {
          title: `Auto-recorded: ${recurring.category}`,
          body: `${amount} has been automatically recorded as an expense.`,
          data: { type: "RECURRING_EXPENSE" },
        }).catch(() => {});

        logger.info("Recurring expense processed", {
          id: recurring.id,
          category: recurring.category,
          businessProfileId: recurring.businessProfileId,
        });
      } catch (err) {
        logger.error("Failed to process recurring expense", { id: recurring.id, err });
      }
    }
  }

  private requireBusiness(context: AuthenticatedContext) {
    if (!context.business) {
      throw new AppError(
        "Complete business onboarding before managing recurring expenses",
        403,
        "BUSINESS_REQUIRED",
      );
    }
    return context.business.id;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function computeNextRunAt(
  frequency: RecurringFrequency,
  hourOfDay: number,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null,
  from: Date = new Date(),
): Date {
  const next = new Date(from);

  if (frequency === "DAILY") {
    next.setHours(hourOfDay, 0, 0, 0);
    if (next <= from) {
      next.setDate(next.getDate() + 1);
      next.setHours(hourOfDay, 0, 0, 0);
    }
    return next;
  }

  if (frequency === "WEEKLY") {
    const target = dayOfWeek ?? 0;
    next.setHours(hourOfDay, 0, 0, 0);
    const daysUntil = (target - next.getDay() + 7) % 7;
    if (daysUntil === 0 && next <= from) {
      next.setDate(next.getDate() + 7);
    } else {
      next.setDate(next.getDate() + daysUntil);
    }
    next.setHours(hourOfDay, 0, 0, 0);
    return next;
  }

  // MONTHLY
  const target = dayOfMonth ?? 1;
  next.setDate(target);
  next.setHours(hourOfDay, 0, 0, 0);
  if (next <= from) {
    next.setMonth(next.getMonth() + 1);
    next.setDate(target);
    next.setHours(hourOfDay, 0, 0, 0);
  }
  return next;
}

// Email removed — push notifications handle recurring expense alerts.

function toDto(record: Awaited<ReturnType<RecurringExpenseRepository["list"]>>[number]) {
  return {
    id: record.id,
    category: record.category,
    amount: record.amountKobo / 100,
    description: record.description,
    paymentMethod: record.paymentMethod,
    frequency: record.frequency,
    dayOfWeek: record.dayOfWeek,
    dayOfMonth: record.dayOfMonth,
    hourOfDay: record.hourOfDay,
    isActive: record.isActive,
    startDate: record.startDate.toISOString(),
    endDate: record.endDate?.toISOString() ?? null,
    lastRunAt: record.lastRunAt?.toISOString() ?? null,
    nextRunAt: record.nextRunAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
  };
}

function parsePaymentMethod(value: string | undefined): PaymentMethod {
  if (value === "CASH" || value === "TRANSFER" || value === "CARD") return value;
  throw new AppError("Invalid payment method", 422, "INVALID_PAYMENT_METHOD");
}

function parseFrequency(value: string | undefined): RecurringFrequency {
  if (value === "DAILY" || value === "WEEKLY" || value === "MONTHLY") return value;
  throw new AppError("Frequency must be DAILY, WEEKLY, or MONTHLY", 422, "INVALID_FREQUENCY");
}

function requireText(value: string | undefined, label: string) {
  const text = normalizeOptionalText(value);
  if (!text) throw new AppError(`${label} is required`, 422, "REQUIRED_FIELD");
  return text;
}

function normalizeOptionalText(value: string | undefined) {
  return value?.trim() || undefined;
}

function toMoneyKobo(value: number | undefined, label: string) {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    throw new AppError(`${label} must be greater than zero`, 422, "INVALID_MONEY");
  }
  return Math.round(value * 100);
}

function clampHour(value: number) {
  return Math.min(23, Math.max(0, Math.floor(value)));
}
