import { prisma } from "../../../shared/infrastructure/prismaClient.js";
import { AppError } from "../../../shared/application/AppError.js";
import { businessCacheKey, getCached } from "../../../shared/infrastructure/cache.js";
import type { AuthenticatedContext } from "../../../shared/presentation/authenticatedRequest.js";

export class DashboardService {
  async getSummary(context: AuthenticatedContext) {
    const businessProfileId = this.requireBusiness(context);
    return getCached(
      businessCacheKey(businessProfileId, "dashboard-summary"),
      30_000,
      () => this.loadSummary(businessProfileId),
    );
  }

  private async loadSummary(businessProfileId: string) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const [moneyIn, moneyOut, creditBalance, lowStockCount, recentSales] = await Promise.all([
      prisma.saleTransaction.aggregate({
        where: {
          businessProfileId,
          createdAt: { gte: weekStart },
        },
        _sum: { amountPaidKobo: true },
      }),
      prisma.expenseTransaction.aggregate({
        where: {
          businessProfileId,
          createdAt: { gte: weekStart },
        },
        _sum: { amountKobo: true },
      }),
      prisma.invoice.aggregate({
        where: {
          businessProfileId,
          balanceKobo: { gt: 0 },
        },
        _sum: { balanceKobo: true },
      }),
      prisma.stockItem.count({
        where: {
          businessProfileId,
          archivedAt: null,
          lowStockAlertQuantity: { not: null },
        },
      }),
      prisma.saleTransaction.findMany({
        where: { businessProfileId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          amountPaidKobo: true,
          subtotalKobo: true,
          balanceKobo: true,
          createdAt: true,
          lineItems: {
            select: {
              stockItem: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const totalMoneyIn = fromKobo(moneyIn._sum.amountPaidKobo ?? 0);
    const totalMoneyOut = fromKobo(moneyOut._sum.amountKobo ?? 0);

    return {
      moneyIn: totalMoneyIn,
      moneyOut: totalMoneyOut,
      cashAtHand: totalMoneyIn - totalMoneyOut,
      outstandingInvoices: fromKobo(creditBalance._sum.balanceKobo ?? 0),
      lowStockCount,
      recentSales: recentSales.map((sale) => ({
        id: sale.id,
        title: sale.lineItems.map((line: { stockItem: { name: string } }) => line.stockItem.name).join(", ") || "Sale",
        amount: fromKobo(sale.amountPaidKobo || sale.subtotalKobo),
        balance: fromKobo(sale.balanceKobo),
        createdAt: sale.createdAt.toISOString(),
      })),
    };
  }

  private requireBusiness(context: AuthenticatedContext) {
    if (!context.business) {
      throw new AppError(
        "Complete business onboarding before viewing dashboard",
        403,
        "BUSINESS_REQUIRED",
      );
    }

    return context.business.id;
  }
}

function fromKobo(value: number) {
  return value / 100;
}
