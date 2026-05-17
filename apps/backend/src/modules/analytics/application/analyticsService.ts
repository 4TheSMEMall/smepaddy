import { prisma } from "../../../shared/infrastructure/prismaClient.js";
import { AppError } from "../../../shared/application/AppError.js";
import type { AuthenticatedContext } from "../../../shared/presentation/authenticatedRequest.js";

type Period = "THIS_WEEK" | "THIS_MONTH" | "THIS_QUARTER" | "THIS_YEAR";

export class AnalyticsService {
  async getSummary(context: AuthenticatedContext, period: Period = "THIS_MONTH") {
    const businessProfileId = this.requireBusiness(context);
    const { start, end } = getPeriodBounds(period);
    const { start: prevStart, end: prevEnd } = getPreviousPeriodBounds(period);

    const [
      currentRevenue,
      currentExpenses,
      previousRevenue,
      previousExpenses,
      topProducts,
      expensesByCategory,
      revenueByDay,
      expensesByDay,
      totalInvoices,
      unpaidInvoices,
    ] = await Promise.all([
      // Current period revenue
      prisma.saleTransaction.aggregate({
        where: { businessProfileId, createdAt: { gte: start, lte: end } },
        _sum: { amountPaidKobo: true },
        _count: true,
      }),
      // Current period expenses
      prisma.expenseTransaction.aggregate({
        where: { businessProfileId, createdAt: { gte: start, lte: end } },
        _sum: { amountKobo: true },
        _count: true,
      }),
      // Previous period revenue (for growth %)
      prisma.saleTransaction.aggregate({
        where: { businessProfileId, createdAt: { gte: prevStart, lte: prevEnd } },
        _sum: { amountPaidKobo: true },
      }),
      // Previous period expenses
      prisma.expenseTransaction.aggregate({
        where: { businessProfileId, createdAt: { gte: prevStart, lte: prevEnd } },
        _sum: { amountKobo: true },
      }),
      // Top products by revenue
      prisma.saleLineItem.groupBy({
        by: ["stockItemId"],
        where: {
          saleTransaction: {
            businessProfileId,
            createdAt: { gte: start, lte: end },
          },
        },
        _sum: { totalKobo: true, quantity: true },
        orderBy: { _sum: { totalKobo: "desc" } },
        take: 5,
      }),
      // Expenses by category
      prisma.expenseTransaction.groupBy({
        by: ["category"],
        where: { businessProfileId, createdAt: { gte: start, lte: end } },
        _sum: { amountKobo: true },
        orderBy: { _sum: { amountKobo: "desc" } },
      }),
      // Revenue by day (for chart)
      prisma.saleTransaction.findMany({
        where: { businessProfileId, createdAt: { gte: start, lte: end } },
        select: { amountPaidKobo: true, createdAt: true },
      }),
      // Expenses by day (for chart)
      prisma.expenseTransaction.findMany({
        where: { businessProfileId, createdAt: { gte: start, lte: end } },
        select: { amountKobo: true, createdAt: true },
      }),
      // Invoice counts
      prisma.invoice.count({ where: { businessProfileId } }),
      prisma.invoice.aggregate({
        where: { businessProfileId, balanceKobo: { gt: 0 } },
        _sum: { balanceKobo: true },
        _count: true,
      }),
    ]);

    // Resolve stock item names for top products
    const stockItemIds = topProducts.map((p) => p.stockItemId).filter((id): id is string => !!id);
    const stockItems = await prisma.stockItem.findMany({
      where: { id: { in: stockItemIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(stockItems.map((s) => [s.id, s.name]));

    const revenue = fromKobo(currentRevenue._sum.amountPaidKobo ?? 0);
    const expenses = fromKobo(currentExpenses._sum.amountKobo ?? 0);
    const prevRev = fromKobo(previousRevenue._sum.amountPaidKobo ?? 0);
    const prevExp = fromKobo(previousExpenses._sum.amountKobo ?? 0);

    // Build day-by-day chart data
    const chartDays = buildChartData(revenueByDay, expensesByDay, start, end, period);

    return {
      period,
      revenue,
      expenses,
      profit: revenue - expenses,
      salesCount: currentRevenue._count,
      expensesCount: currentExpenses._count,
      growth: {
        revenue: calcGrowth(revenue, prevRev),
        expenses: calcGrowth(expenses, prevExp),
        profit: calcGrowth(revenue - expenses, prevRev - prevExp),
      },
      topProducts: topProducts.map((p) => ({
        name: nameMap.get(p.stockItemId ?? "") ?? "Unknown",
        revenue: fromKobo(p._sum.totalKobo ?? 0),
        units: p._sum.quantity ?? 0,
      })),
      expensesByCategory: expensesByCategory.map((e) => ({
        category: e.category,
        amount: fromKobo(e._sum.amountKobo ?? 0),
      })),
      chart: chartDays,
      invoices: {
        total: totalInvoices,
        unpaidCount: unpaidInvoices._count,
        unpaidAmount: fromKobo(unpaidInvoices._sum.balanceKobo ?? 0),
      },
    };
  }

  private requireBusiness(context: AuthenticatedContext) {
    if (!context.business) throw new AppError("Business required", 403, "BUSINESS_REQUIRED");
    return context.business.id;
  }
}

export const analyticsService = new AnalyticsService();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fromKobo(v: number) { return v / 100; }

function calcGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function getPeriodBounds(period: Period): { start: Date; end: Date } {
  const now = new Date();
  if (period === "THIS_WEEK") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (period === "THIS_MONTH") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }
  if (period === "THIS_QUARTER") {
    const q = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), q * 3, 1);
    const end = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
    return { start, end };
  }
  // THIS_YEAR
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  return { start, end };
}

function getPreviousPeriodBounds(period: Period): { start: Date; end: Date } {
  const now = new Date();
  if (period === "THIS_WEEK") {
    const end = new Date(now);
    end.setDate(now.getDate() - now.getDay() - 1);
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }
  if (period === "THIS_MONTH") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end };
  }
  if (period === "THIS_QUARTER") {
    const q = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), (q - 1) * 3, 1);
    const end = new Date(now.getFullYear(), q * 3, 0, 23, 59, 59, 999);
    return { start, end };
  }
  const start = new Date(now.getFullYear() - 1, 0, 1);
  const end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
  return { start, end };
}

function buildChartData(
  sales: { amountPaidKobo: number; createdAt: Date }[],
  expenses: { amountKobo: number; createdAt: Date }[],
  start: Date,
  end: Date,
  period: Period,
): { label: string; revenue: number; expenses: number }[] {
  const buckets = new Map<string, { label: string; revenue: number; expenses: number }>();

  // Generate bucket keys based on period
  const current = new Date(start);
  while (current <= end) {
    const key = getBucketKey(current, period);
    if (!buckets.has(key)) {
      buckets.set(key, { label: getBucketLabel(current, period), revenue: 0, expenses: 0 });
    }
    if (period === "THIS_WEEK" || period === "THIS_MONTH") {
      current.setDate(current.getDate() + 1);
    } else if (period === "THIS_QUARTER") {
      current.setMonth(current.getMonth() + 1);
    } else {
      current.setMonth(current.getMonth() + 1);
    }
  }

  sales.forEach((s) => {
    const key = getBucketKey(s.createdAt, period);
    const bucket = buckets.get(key);
    if (bucket) bucket.revenue += fromKobo(s.amountPaidKobo);
  });

  expenses.forEach((e) => {
    const key = getBucketKey(e.createdAt, period);
    const bucket = buckets.get(key);
    if (bucket) bucket.expenses += fromKobo(e.amountKobo);
  });

  return Array.from(buckets.values());
}

function getBucketKey(date: Date, period: Period): string {
  if (period === "THIS_WEEK" || period === "THIS_MONTH") {
    return date.toISOString().slice(0, 10);
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getBucketLabel(date: Date, period: Period): string {
  if (period === "THIS_WEEK") {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()] ?? "";
  }
  if (period === "THIS_MONTH") {
    return String(date.getDate());
  }
  return new Intl.DateTimeFormat("en", { month: "short" }).format(date);
}
