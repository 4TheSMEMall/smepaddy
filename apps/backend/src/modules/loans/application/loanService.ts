import { AppError } from "../../../shared/application/AppError.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import { prisma } from "../../../shared/infrastructure/prismaClient.js";
import type { AuthenticatedContext } from "../../../shared/presentation/authenticatedRequest.js";
import { coinService } from "../../coins/application/coinService.js";
import { notificationService } from "../../notifications/application/notificationService.js";

// ─── Loan tiers ──────────────────────────────────────────────────────────────

export const LOAN_TIERS = {
  NANO: {
    minKobo: 100_000,      // ₦1,000
    maxKobo: 1_000_000,    // ₦10,000
    interestRate: 0.05,    // 5% flat
    tenureOptions: [7, 10, 14],
    requiredDays: 30,
    requiredCoins: 200,
    label: "Nano Loan",
  },
  MICRO: {
    minKobo: 1_000_000,    // ₦10,000
    maxKobo: 5_000_000,    // ₦50,000
    interestRate: 0.04,    // 4% flat
    tenureOptions: [30, 60, 90],
    requiredDays: 90,
    requiredCoins: 1000,
    label: "Micro Loan",
  },
} as const;

type LoanTierKey = keyof typeof LOAN_TIERS;
type PaymentMethod = "CASH" | "TRANSFER" | "CARD";

// ─── PCS Computation ─────────────────────────────────────────────────────────

export type PCSBreakdown = {
  total: number;
  components: {
    consistency:  { score: number; max: 225; label: string; detail: string };
    quality:      { score: number; max: 180; label: string; detail: string };
    repayment:    { score: number; max: 180; label: string; detail: string };
    discipline:   { score: number; max: 135; label: string; detail: string };
    tenure:       { score: number; max: 90;  label: string; detail: string };
    trust:        { score: number; max: 90;  label: string; detail: string };
  };
};

export async function computePCSBreakdown(businessProfileId: string): Promise<PCSBreakdown> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000);

  const [
    activeDayResults,
    distinctTypeResults,
    repayments,
    invoiceCount,
    stockCount,
    firstActivity,
    wallet,
  ] = await Promise.all([
    // Days active in last 90 days (distinct dates with financial coin events)
    prisma.coinTransaction.findMany({
      where: {
        wallet: { businessProfileId },
        eventKey: { in: ["SALE_RECORDED", "EXPENSE_RECORDED", "INVOICE_CREATED", "STOCK_CREATED"] },
        createdAt: { gte: ninetyDaysAgo },
      },
      select: { createdAt: true },
    }),
    // Distinct financial event types ever used (record quality)
    prisma.coinTransaction.findMany({
      where: {
        wallet: { businessProfileId },
        eventKey: { in: ["SALE_RECORDED", "EXPENSE_RECORDED", "INVOICE_CREATED", "STOCK_CREATED"] },
      },
      select: { eventKey: true },
      distinct: ["eventKey"],
    }),
    // Repayment history
    prisma.loanRepayment.findMany({
      where: { loan: { businessProfileId } },
      select: { paidOnTime: true },
    }),
    // Financial discipline: invoice usage
    prisma.invoice.count({ where: { businessProfileId } }),
    // Financial discipline: stock items
    prisma.stockItem.count({ where: { businessProfileId, archivedAt: null } }),
    // Account tenure: first ever coin-earning activity
    prisma.coinTransaction.findFirst({
      where: { wallet: { businessProfileId } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    // Community trust: total coins earned
    prisma.wallet.findFirst({ where: { businessProfileId } }),
  ]);

  // 1. Transaction Consistency (25% = max 225)
  const activeDays = new Set(
    activeDayResults.map((r) => r.createdAt.toISOString().slice(0, 10)),
  ).size;
  const consistencyScore = Math.round((Math.min(activeDays, 90) / 90) * 225);

  // 2. Record Quality (20% = max 180)
  const qualityScore = Math.round((distinctTypeResults.length / 4) * 180);

  // 3. Repayment History (20% = max 180) — 0 if no loans yet
  const repaymentScore =
    repayments.length === 0
      ? 0
      : Math.round(
          (repayments.filter((r) => r.paidOnTime).length / repayments.length) * 180,
        );

  // 4. Financial Discipline (15% = max 135)
  const disciplineScore = Math.round(
    (Math.min(invoiceCount, 10) / 10) * 68 +
    (Math.min(stockCount, 5) / 5) * 67,
  );

  // 5. Account Tenure (10% = max 90)
  const daysSince = firstActivity
    ? Math.floor((now.getTime() - firstActivity.createdAt.getTime()) / 86_400_000)
    : 0;
  const tenureScore = Math.round((Math.min(daysSince, 365) / 365) * 90);

  // 6. Community Trust (10% = max 90) — proxy: total coins earned
  const totalEarned = wallet?.totalEarned ?? 0;
  const trustScore = Math.round((Math.min(totalEarned, 1000) / 1000) * 90);

  const total = Math.max(100, Math.min(900,
    consistencyScore + qualityScore + repaymentScore +
    disciplineScore + tenureScore + trustScore,
  ));

  return {
    total,
    components: {
      consistency: {
        score: consistencyScore, max: 225,
        label: "Transaction Consistency",
        detail: `${activeDays} active day${activeDays === 1 ? "" : "s"} in the last 90 days`,
      },
      quality: {
        score: qualityScore, max: 180,
        label: "Record Quality",
        detail: `${distinctTypeResults.length} of 4 transaction types used`,
      },
      repayment: {
        score: repaymentScore, max: 180,
        label: "Repayment History",
        detail: repayments.length === 0
          ? "No loans yet — score improves when you repay on time"
          : `${repayments.filter((r) => r.paidOnTime).length} of ${repayments.length} repayments on time`,
      },
      discipline: {
        score: disciplineScore, max: 135,
        label: "Financial Discipline",
        detail: `${invoiceCount} invoice${invoiceCount === 1 ? "" : "s"} · ${stockCount} stock item${stockCount === 1 ? "" : "s"}`,
      },
      tenure: {
        score: tenureScore, max: 90,
        label: "Account Tenure",
        detail: daysSince === 0 ? "Just getting started" : `${daysSince} day${daysSince === 1 ? "" : "s"} on SME Paddy`,
      },
      trust: {
        score: trustScore, max: 90,
        label: "Community Trust",
        detail: `${totalEarned} coin${totalEarned === 1 ? "" : "s"} earned total`,
      },
    },
  };
}

export async function computePCS(businessProfileId: string): Promise<number> {
  const breakdown = await computePCSBreakdown(businessProfileId);
  return breakdown.total;
}

function pcsLabel(pcs: number): string {
  if (pcs >= 800) return "Elite";
  if (pcs >= 650) return "Trusted";
  if (pcs >= 500) return "Established";
  if (pcs >= 300) return "Growing";
  return "Building";
}

// ─── LoanService ─────────────────────────────────────────────────────────────

export class LoanService {
  async getEligibility(context: AuthenticatedContext) {
    const businessProfileId = this.requireBusiness(context);
    const [breakdown, wallet, firstActivity, activeLoan, nanoRepaid] = await Promise.all([
      computePCSBreakdown(businessProfileId),
      prisma.wallet.findFirst({ where: { businessProfileId } }),
      prisma.coinTransaction.findFirst({
        where: { wallet: { businessProfileId } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      prisma.loan.findFirst({
        where: { businessProfileId, status: "ACTIVE" },
        include: { repayments: { orderBy: { createdAt: "desc" } } },
      }),
      prisma.loan.findFirst({ where: { businessProfileId, loanType: "NANO", status: "COMPLETED" } }),
    ]);

    const totalEarned = wallet?.totalEarned ?? 0;
    const coinBalance = wallet?.availableBalance ?? 0;
    const daysActive = firstActivity
      ? Math.floor((Date.now() - firstActivity.createdAt.getTime()) / 86_400_000)
      : 0;

    return {
      pcs: breakdown.total,
      pcsLabel: pcsLabel(breakdown.total),
      pcsBreakdown: breakdown.components,
      daysActive,
      totalEarned,
      coinBalance,
      activeLoan: activeLoan ? loanToDto(activeLoan) : null,
      eligibility: computeEligibility(daysActive, totalEarned, !!nanoRepaid),
    };
  }

  async apply(context: AuthenticatedContext, input: { amount?: number; tenureDays?: number }) {
    const businessProfileId = this.requireBusiness(context);

    const amount = input.amount;
    const tenureDays = input.tenureDays;
    if (!amount || !Number.isFinite(amount) || amount <= 0) {
      throw new AppError("Valid amount is required", 422, "INVALID_AMOUNT");
    }
    if (!tenureDays || !Number.isInteger(tenureDays)) {
      throw new AppError("Valid tenure is required", 422, "INVALID_TENURE");
    }

    // Check no active loan
    const activeLoan = await prisma.loan.findFirst({ where: { businessProfileId, status: "ACTIVE" } });
    if (activeLoan) {
      throw new AppError("You already have an active loan. Repay it before applying again.", 422, "ACTIVE_LOAN_EXISTS");
    }

    // Check eligibility
    const wallet = await prisma.wallet.findFirst({ where: { businessProfileId } });
    const firstActivity = await prisma.coinTransaction.findFirst({
      where: { wallet: { businessProfileId } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    const daysActive = firstActivity
      ? Math.floor((Date.now() - firstActivity.createdAt.getTime()) / 86_400_000)
      : 0;
    const totalEarned = wallet?.totalEarned ?? 0;
    const nanoRepaid = await prisma.loan.findFirst({ where: { businessProfileId, loanType: "NANO", status: "COMPLETED" } });
    const eligibility = computeEligibility(daysActive, totalEarned, !!nanoRepaid);

    if (!eligibility.eligible) {
      throw new AppError(eligibility.reason ?? "Not eligible for a loan yet", 422, "NOT_ELIGIBLE");
    }

    const tier = LOAN_TIERS[eligibility.tier!];
    const principalKobo = Math.round(amount * 100);

    if (principalKobo < tier.minKobo || principalKobo > tier.maxKobo) {
      throw new AppError(
        `Amount must be between ₦${tier.minKobo / 100} and ₦${tier.maxKobo / 100}`,
        422,
        "AMOUNT_OUT_OF_RANGE",
      );
    }
    if (!(tier.tenureOptions as readonly number[]).includes(tenureDays)) {
      throw new AppError(
        `Tenure must be one of: ${tier.tenureOptions.join(", ")} days`,
        422,
        "INVALID_TENURE",
      );
    }

    const interestKobo = Math.round(principalKobo * tier.interestRate);
    const totalKobo = principalKobo + interestKobo;
    const dueDate = new Date(Date.now() + tenureDays * 86_400_000);
    const pcs = await computePCS(businessProfileId);

    const loan = await prisma.loan.create({
      data: {
        businessProfileId,
        loanType: eligibility.tier!,
        status: "ACTIVE",
        principalKobo,
        interestKobo,
        totalKobo,
        balanceKobo: totalKobo,
        tenureDays,
        dueDate,
        pcsAtApplication: pcs,
      },
    });

    // First-ever loan bonus
    const isFirstLoan = !(await prisma.loan.findFirst({
      where: { businessProfileId, id: { not: loan.id } },
    }));
    if (isFirstLoan) {
      try {
        await coinService.awardCoins(businessProfileId, "FIRST_LOAN_APP", loan.id);
      } catch (err) {
        logger.warn("Failed to award FIRST_LOAN_APP coins", { err });
      }
    }

    notificationService.send(businessProfileId, {
      title: "Loan approved! 🎉",
      body: `Your ${tier.label} of ${formatMoney(amount)} has been approved. Due ${formatDate(dueDate)}.`,
      data: { type: "LOAN_APPROVED", loanId: loan.id },
    }).catch(() => {});

    return { loan: loanToDto(loan) };
  }

  async listLoans(context: AuthenticatedContext) {
    const businessProfileId = this.requireBusiness(context);
    const loans = await prisma.loan.findMany({
      where: { businessProfileId },
      orderBy: { createdAt: "desc" },
      include: { repayments: { orderBy: { createdAt: "desc" } } },
    });
    return { loans: loans.map(loanToDto) };
  }

  async getLoan(context: AuthenticatedContext, loanId: string) {
    const businessProfileId = this.requireBusiness(context);
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, businessProfileId },
      include: { repayments: { orderBy: { createdAt: "desc" } } },
    });
    if (!loan) throw new AppError("Loan not found", 404, "LOAN_NOT_FOUND");
    return { loan: loanToDto(loan) };
  }

  async repay(
    context: AuthenticatedContext,
    loanId: string,
    input: { amount?: number; paymentMethod?: string; note?: string; coinsToUse?: number },
  ) {
    const businessProfileId = this.requireBusiness(context);
    const loan = await prisma.loan.findFirst({ where: { id: loanId, businessProfileId } });
    if (!loan) throw new AppError("Loan not found", 404, "LOAN_NOT_FOUND");
    if (loan.status !== "ACTIVE") throw new AppError("This loan is not active", 422, "LOAN_NOT_ACTIVE");

    const amount = input.amount;
    if (!amount || !Number.isFinite(amount) || amount <= 0) {
      throw new AppError("Valid repayment amount is required", 422, "INVALID_AMOUNT");
    }

    // Coin-assisted repayment: 1 coin = ₦1 = 100 kobo, max = interest portion
    const coinsToUse = Math.max(0, Math.floor(input.coinsToUse ?? 0));
    const maxCoinsAllowed = Math.floor(loan.interestKobo / 100); // can only reduce interest
    const clampedCoins = Math.min(coinsToUse, maxCoinsAllowed);
    const coinDiscountKobo = clampedCoins * 100; // 1 coin = 100 kobo = ₦1

    // Spend coins first (fail-fast if insufficient balance)
    if (clampedCoins > 0) {
      const spent = await coinService.spendCoins(
        businessProfileId,
        clampedCoins,
        "LOAN_COIN_REDEMPTION",
        loanId,
      );
      if (!spent) throw new AppError("Not enough coins to apply this discount", 422, "INSUFFICIENT_COINS");
    }

    const amountKobo = Math.round(amount * 100);
    const effectiveAmountKobo = amountKobo + coinDiscountKobo; // coins cover part of it
    if (effectiveAmountKobo > loan.balanceKobo) {
      throw new AppError("Amount exceeds remaining balance", 422, "EXCEEDS_BALANCE");
    }

    const paymentMethod = parsePaymentMethod(input.paymentMethod);
    const paidOnTime = new Date() <= loan.dueDate;
    const newAmountRepaid = loan.amountRepaidKobo + effectiveAmountKobo;
    const newBalance = loan.balanceKobo - effectiveAmountKobo;
    const isFullyPaid = newBalance <= 0;

    const [updatedLoan] = await prisma.$transaction([
      prisma.loan.update({
        where: { id: loanId },
        data: {
          amountRepaidKobo: newAmountRepaid,
          balanceKobo: newBalance,
          status: isFullyPaid ? "COMPLETED" : "ACTIVE",
          completedAt: isFullyPaid ? new Date() : undefined,
        },
      }),
      prisma.loanRepayment.create({
        data: {
          loanId,
          amountKobo: effectiveAmountKobo,
          paymentMethod,
          paidOnTime,
          note: clampedCoins > 0
            ? `${input.note?.trim() ? input.note.trim() + " · " : ""}${clampedCoins} coins used (₦${clampedCoins} discount)`
            : input.note?.trim() || undefined,
        },
      }),
    ]);

    // Return the updated loan with coin discount info
    const coinDiscount = clampedCoins > 0 ? clampedCoins : undefined;

    // Award coins
    if (paidOnTime) {
      coinService.awardCoins(businessProfileId, "LOAN_REPAY_ONTIME", loanId).catch(() => {});
    }
    if (isFullyPaid) {
      coinService.awardCoins(businessProfileId, "LOAN_FULLY_REPAID", loanId).catch(() => {});
      notificationService.send(businessProfileId, {
        title: "Loan fully repaid! 🏆",
        body: "Congratulations! Your loan is cleared. Your credit score has improved.",
        data: { type: "LOAN_REPAID" },
      }).catch(() => {});
    }

    return { loan: loanToDto(updatedLoan), coinDiscount };
  }

  private requireBusiness(context: AuthenticatedContext) {
    if (!context.business) {
      throw new AppError("Complete business onboarding before accessing loans", 403, "BUSINESS_REQUIRED");
    }
    return context.business.id;
  }
}

export const loanService = new LoanService();

// ─── Eligibility helper ───────────────────────────────────────────────────────

function computeEligibility(
  daysActive: number,
  totalEarned: number,
  nanoRepaid: boolean,
): { eligible: true; tier: LoanTierKey; maxAmount: number; minAmount: number } |
  { eligible: false; reason: string; daysNeeded: number; coinsNeeded: number } {

  // TODO: revert to daysActive >= 90 and daysActive >= 30 before production
  // Micro requires Nano repaid + 90 days + 1000 coins
  if (nanoRepaid && daysActive >= 0 && totalEarned >= 1000) {
    return {
      eligible: true,
      tier: "MICRO",
      maxAmount: LOAN_TIERS.MICRO.maxKobo / 100,
      minAmount: LOAN_TIERS.MICRO.minKobo / 100,
    };
  }

  // Nano requires 30 days + 200 coins (0 days for testing)
  if (daysActive >= 0 && totalEarned >= 200) {
    return {
      eligible: true,
      tier: "NANO",
      maxAmount: LOAN_TIERS.NANO.maxKobo / 100,
      minAmount: LOAN_TIERS.NANO.minKobo / 100,
    };
  }

  const daysNeeded = Math.max(0, 30 - daysActive);
  const coinsNeeded = Math.max(0, 200 - totalEarned);
  const parts: string[] = [];
  if (daysNeeded > 0) parts.push(`${daysNeeded} more day${daysNeeded === 1 ? "" : "s"} active`);
  if (coinsNeeded > 0) parts.push(`earn ${coinsNeeded} more coins`);

  return {
    eligible: false,
    reason: parts.length > 0 ? `Keep going! ${parts.join(" and ")}.` : "Almost there!",
    daysNeeded,
    coinsNeeded,
  };
}

// ─── DTO ──────────────────────────────────────────────────────────────────────

type LoanRow = {
  id: string; businessProfileId: string; loanType: string; status: string;
  principalKobo: number; interestKobo: number; totalKobo: number;
  amountRepaidKobo: number; balanceKobo: number; tenureDays: number;
  dueDate: Date; pcsAtApplication: number; disbursedAt: Date;
  completedAt: Date | null; createdAt: Date;
  repayments?: {
    id: string; amountKobo: number; paymentMethod: string;
    paidOnTime: boolean; note: string | null; createdAt: Date;
  }[];
};

function loanToDto(loan: LoanRow) {
  return {
    id: loan.id,
    loanType: loan.loanType,
    status: loan.status,
    principal: loan.principalKobo / 100,
    interest: loan.interestKobo / 100,
    total: loan.totalKobo / 100,
    amountRepaid: loan.amountRepaidKobo / 100,
    balance: loan.balanceKobo / 100,
    tenureDays: loan.tenureDays,
    dueDate: loan.dueDate.toISOString(),
    pcsAtApplication: loan.pcsAtApplication,
    disbursedAt: loan.disbursedAt.toISOString(),
    completedAt: loan.completedAt?.toISOString() ?? null,
    createdAt: loan.createdAt.toISOString(),
    repayments: loan.repayments?.map((r) => ({
      id: r.id,
      amount: r.amountKobo / 100,
      paymentMethod: r.paymentMethod,
      paidOnTime: r.paidOnTime,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

function parsePaymentMethod(value: string | undefined): PaymentMethod {
  if (value === "CASH" || value === "TRANSFER" || value === "CARD") return value;
  throw new AppError("Invalid payment method", 422, "INVALID_PAYMENT_METHOD");
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" }).format(date);
}
