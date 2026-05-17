import { logger } from "../../../shared/infrastructure/logger.js";
import { prisma } from "../../../shared/infrastructure/prismaClient.js";
import { notificationService } from "../../notifications/application/notificationService.js";

// ─── Coin values per event ───────────────────────────────────────────────────

// TODO: revert to production values before deploying to production
// Production values: SALE=5, EXPENSE=3, INVOICE_CREATED=5, INVOICE_PAID=4, STOCK=4, LOGIN=2, BOOKKEEPING=15
const COIN_VALUES: Record<string, number> = {
  SALE_RECORDED: 50,
  EXPENSE_RECORDED: 50,
  INVOICE_CREATED: 50,
  INVOICE_PAID: 50,
  STOCK_CREATED: 50,
  DAILY_LOGIN: 50,
  DAILY_BOOKKEEPING_COMPLETE: 50,
  FIRST_LOAN_APP: 50,
  LOAN_REPAY_ONTIME: 50,
  LOAN_FULLY_REPAID: 50,
  WEEKLY_ACTIVE: 40,
  MONTHLY_ACTIVE: 100,
};

// These count toward the daily entry limit and bookkeeping bonus.
const FINANCIAL_EVENTS = new Set([
  "SALE_RECORDED",
  "EXPENSE_RECORDED",
  "INVOICE_CREATED",
  "INVOICE_PAID",
  "STOCK_CREATED",
]);

// These three types together trigger the bookkeeping bonus.
const BOOKKEEPING_EVENTS = new Set([
  "SALE_RECORDED",
  "EXPENSE_RECORDED",
  "STOCK_CREATED",
]);

// TODO: revert to MAX_DAILY_ENTRIES=20, MAX_DAILY_COINS=250 before production
const MAX_DAILY_ENTRIES = 200;
const MAX_DAILY_COINS = 10000;
const COIN_EXPIRY_MONTHS = 12;

// ─── Level thresholds ────────────────────────────────────────────────────────

const LEVELS = [
  { level: 5, title: "Mogul",    minCoins: 10000, nextAt: null },
  { level: 4, title: "Big Boss", minCoins: 5000,  nextAt: 10000 },
  { level: 3, title: "Boss",     minCoins: 2000,  nextAt: 5000 },
  { level: 2, title: "Hustler",  minCoins: 500,   nextAt: 2000 },
  { level: 1, title: "Starter",  minCoins: 0,     nextAt: 500 },
] as const;

export function computeLevel(totalEarned: number) {
  return LEVELS.find((l) => totalEarned >= l.minCoins) ?? LEVELS[LEVELS.length - 1];
}

// ─── CoinService ─────────────────────────────────────────────────────────────

export class CoinService {
  /**
   * Award coins for a financial action. Returns awarded amount and new balance,
   * or null if blocked (daily limit, duplicate, unknown event).
   *
   * Safe to call with try/catch — never throws to the caller.
   */
  async awardCoins(
    businessProfileId: string,
    eventKey: string,
    referenceId?: string,
  ): Promise<{ awarded: number; balance: number } | null> {
    const coins = COIN_VALUES[eventKey];
    if (!coins) return null;

    const now = new Date();
    const startOfDay = dayStart(now);

    const wallet = await this.getOrCreateWallet(businessProfileId);

    // Duplicate guard: same event + referenceId within 2 minutes
    if (referenceId) {
      const twoMinsAgo = new Date(now.getTime() - 2 * 60 * 1000);
      const dup = await prisma.coinTransaction.findFirst({
        where: {
          walletId: wallet.id,
          eventKey,
          referenceId,
          createdAt: { gte: twoMinsAgo },
        },
      });
      if (dup) return null;
    }

    // Daily limits (financial events only)
    if (FINANCIAL_EVENTS.has(eventKey)) {
      const todayStats = await prisma.coinTransaction.aggregate({
        where: {
          walletId: wallet.id,
          eventKey: { in: [...FINANCIAL_EVENTS] },
          createdAt: { gte: startOfDay },
        },
        _count: true,
        _sum: { amount: true },
      });

      if (todayStats._count >= MAX_DAILY_ENTRIES) return null;
      const earnedToday = todayStats._sum.amount ?? 0;
      if (earnedToday >= MAX_DAILY_COINS) return null;

      // Don't exceed the daily cap
      const toAward = Math.min(coins, MAX_DAILY_COINS - earnedToday);
      const oldLevel = computeLevel(wallet.totalEarned).level;
      const result = await this.writeCoins(wallet.id, toAward, eventKey, referenceId, now);

      // Detect level-up and notify
      const newLevel = computeLevel(wallet.totalEarned + toAward);
      if (newLevel.level > oldLevel) {
        notificationService.send(businessProfileId, {
          title: "You levelled up! 🎉",
          body: `You're now ${newLevel.title} (Level ${newLevel.level}). Keep going!`,
          data: { type: "LEVEL_UP" },
        }).catch(() => {});
      }

      // Update streak, check bonuses
      await this.updateStreak(businessProfileId, now);
      await this.checkActivityBonuses(wallet.id, businessProfileId, now);
      if (BOOKKEEPING_EVENTS.has(eventKey)) {
        await this.checkBookkeepingBonus(wallet.id, businessProfileId, startOfDay, now);
      }

      return result;
    }

    // Non-financial events (login bonus, etc.) — no entry count limit
    const dailyTotal = await prisma.coinTransaction.aggregate({
      where: { walletId: wallet.id, createdAt: { gte: startOfDay } },
      _sum: { amount: true },
    });
    const earnedToday = dailyTotal._sum.amount ?? 0;
    if (earnedToday >= MAX_DAILY_COINS) return null;

    const toAward = Math.min(coins, MAX_DAILY_COINS - earnedToday);
    const result = await this.writeCoins(wallet.id, toAward, eventKey, referenceId, now);
    await this.updateStreak(businessProfileId, now);
    return result;
  }

  /** Award the 2-coin daily login bonus. Idempotent — max once per calendar day. */
  async awardDailyLogin(businessProfileId: string): Promise<{ awarded: number; balance: number } | null> {
    const now = new Date();
    const startOfDay = dayStart(now);
    const wallet = await this.getOrCreateWallet(businessProfileId);

    const already = await prisma.coinTransaction.findFirst({
      where: { walletId: wallet.id, eventKey: "DAILY_LOGIN", createdAt: { gte: startOfDay } },
    });
    if (already) return null;

    const dailyTotal = await prisma.coinTransaction.aggregate({
      where: { walletId: wallet.id, createdAt: { gte: startOfDay } },
      _sum: { amount: true },
    });
    if ((dailyTotal._sum.amount ?? 0) >= MAX_DAILY_COINS) return null;

    const result = await this.writeCoins(wallet.id, COIN_VALUES.DAILY_LOGIN!, "DAILY_LOGIN", undefined, now);
    await this.updateStreak(businessProfileId, now);
    return result;
  }

  /** Get wallet info for the API response. Creates wallet/streak if first time. */
  async getWalletInfo(businessProfileId: string) {
    const [wallet, streak] = await Promise.all([
      this.getOrCreateWallet(businessProfileId),
      this.getOrCreateStreak(businessProfileId),
    ]);

    const level = computeLevel(wallet.totalEarned);

    return {
      balance: wallet.availableBalance,
      totalEarned: wallet.totalEarned,
      streak: streak.currentStreak,
      level: level.level,
      levelTitle: level.title,
      nextLevelAt: level.nextAt,
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async writeCoins(
    walletId: string,
    amount: number,
    eventKey: string,
    referenceId: string | undefined,
    now: Date,
  ): Promise<{ awarded: number; balance: number }> {
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + COIN_EXPIRY_MONTHS);

    const [updatedWallet] = await prisma.$transaction([
      prisma.wallet.update({
        where: { id: walletId },
        data: {
          totalEarned: { increment: amount },
          availableBalance: { increment: amount },
        },
      }),
      prisma.coinTransaction.create({
        data: { walletId, amount, eventKey, referenceId, expiresAt },
      }),
    ]);

    return { awarded: amount, balance: updatedWallet.availableBalance };
  }

  private async checkActivityBonuses(
    walletId: string,
    businessProfileId: string,
    now: Date,
  ): Promise<void> {
    const weekStart = getWeekStart(now);
    const monthStart = getMonthStart(now);

    // Run both checks in parallel
    await Promise.all([
      this.checkWeeklyBonus(walletId, businessProfileId, weekStart, now),
      this.checkMonthlyBonus(walletId, businessProfileId, monthStart, now),
    ]);
  }

  private async checkWeeklyBonus(
    walletId: string,
    businessProfileId: string,
    weekStart: Date,
    now: Date,
  ): Promise<void> {
    const alreadyGiven = await prisma.coinTransaction.findFirst({
      where: { walletId, eventKey: "WEEKLY_ACTIVE", createdAt: { gte: weekStart } },
    });
    if (alreadyGiven) return;

    const rows = await prisma.coinTransaction.findMany({
      where: { walletId, eventKey: { in: [...FINANCIAL_EVENTS] }, createdAt: { gte: weekStart } },
      select: { createdAt: true },
    });
    const activeDays = new Set(rows.map((r) => r.createdAt.toISOString().slice(0, 10))).size;

    if (activeDays >= 5) {
      const bonus = COIN_VALUES.WEEKLY_ACTIVE!;
      await this.writeCoins(walletId, bonus, "WEEKLY_ACTIVE", undefined, now);
      logger.info("Weekly active bonus awarded", { businessProfileId, activeDays });
      notificationService.send(businessProfileId, {
        title: "Weekly streak bonus! 🔥",
        body: `${activeDays} active days this week — +${bonus} bonus coins!`,
        data: { type: "WEEKLY_BONUS" },
      }).catch(() => {});
    }
  }

  private async checkMonthlyBonus(
    walletId: string,
    businessProfileId: string,
    monthStart: Date,
    now: Date,
  ): Promise<void> {
    const alreadyGiven = await prisma.coinTransaction.findFirst({
      where: { walletId, eventKey: "MONTHLY_ACTIVE", createdAt: { gte: monthStart } },
    });
    if (alreadyGiven) return;

    const rows = await prisma.coinTransaction.findMany({
      where: { walletId, eventKey: { in: [...FINANCIAL_EVENTS] }, createdAt: { gte: monthStart } },
      select: { createdAt: true },
    });
    const activeDays = new Set(rows.map((r) => r.createdAt.toISOString().slice(0, 10))).size;

    if (activeDays >= 15) {
      const bonus = COIN_VALUES.MONTHLY_ACTIVE!;
      await this.writeCoins(walletId, bonus, "MONTHLY_ACTIVE", undefined, now);
      logger.info("Monthly active bonus awarded", { businessProfileId, activeDays });
      notificationService.send(businessProfileId, {
        title: "Monthly champion! 🏆",
        body: `${activeDays} active days this month — +${bonus} bonus coins!`,
        data: { type: "MONTHLY_BONUS" },
      }).catch(() => {});
    }
  }

  private async checkBookkeepingBonus(
    walletId: string,
    businessProfileId: string,
    startOfDay: Date,
    now: Date,
  ): Promise<void> {
    // Only once per day
    const alreadyGiven = await prisma.coinTransaction.findFirst({
      where: { walletId, eventKey: "DAILY_BOOKKEEPING_COMPLETE", createdAt: { gte: startOfDay } },
    });
    if (alreadyGiven) return;

    const todayBookkeeping = await prisma.coinTransaction.findMany({
      where: { walletId, eventKey: { in: [...BOOKKEEPING_EVENTS] }, createdAt: { gte: startOfDay } },
      select: { eventKey: true },
    });

    const distinctTypes = new Set(todayBookkeeping.map((t) => t.eventKey));
    // Award if user has entries from at least 2 different bookkeeping categories
    if (todayBookkeeping.length >= 2 && distinctTypes.size >= 2) {
      const bonusCoins = COIN_VALUES.DAILY_BOOKKEEPING_COMPLETE!;
      await this.writeCoins(walletId, bonusCoins, "DAILY_BOOKKEEPING_COMPLETE", undefined, now);
      logger.info("Daily bookkeeping bonus awarded", { businessProfileId });
      notificationService.send(businessProfileId, {
        title: "Daily bookkeeping complete! 📚",
        body: `+${bonusCoins} bonus coins for recording different types of transactions today.`,
        data: { type: "BOOKKEEPING_BONUS" },
      }).catch(() => {});
    }
  }

  private async updateStreak(businessProfileId: string, now: Date): Promise<void> {
    const streak = await this.getOrCreateStreak(businessProfileId);
    const todayStr = dateStr(now);
    const yesterdayStr = dateStr(new Date(now.getTime() - 86_400_000));
    const lastStr = streak.lastActiveDate ? dateStr(streak.lastActiveDate) : null;

    if (lastStr === todayStr) return; // Already active today

    const newStreak =
      lastStr === yesterdayStr ? streak.currentStreak + 1 : 1;

    await prisma.userStreak.update({
      where: { businessProfileId },
      data: {
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, streak.longestStreak),
        lastActiveDate: now,
      },
    });
  }

  private async getOrCreateWallet(businessProfileId: string) {
    return prisma.wallet.upsert({
      where: { businessProfileId },
      create: { businessProfileId },
      update: {},
    });
  }

  private async getOrCreateStreak(businessProfileId: string) {
    return prisma.userStreak.upsert({
      where: { businessProfileId },
      create: { businessProfileId },
      update: {},
    });
  }

  /**
   * Spend coins for a redemption (e.g. coin-assisted loan repayment).
   * Returns false if the wallet has insufficient balance.
   * 1 coin = ₦1 = 100 kobo.
   */
  async spendCoins(
    businessProfileId: string,
    amount: number,
    eventKey: string,
    referenceId?: string,
  ): Promise<boolean> {
    const wallet = await this.getOrCreateWallet(businessProfileId);
    if (wallet.availableBalance < amount) return false;

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    await prisma.$transaction([
      prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { decrement: amount },
          redeemedTotal: { increment: amount },
        },
      }),
      prisma.coinTransaction.create({
        data: {
          walletId: wallet.id,
          amount: -amount,
          eventKey,
          referenceId,
          expiresAt,
        },
      }),
    ]);

    return true;
  }
}

// Singleton — imported by every service that awards coins
export const coinService = new CoinService();

// ─── Util ────────────────────────────────────────────────────────────────────

function dayStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateStr(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
