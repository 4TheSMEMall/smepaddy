import { AppError } from "../../../shared/application/AppError.js";
import { prisma } from "../../../shared/infrastructure/prismaClient.js";
import type { AuthenticatedContext } from "../../../shared/presentation/authenticatedRequest.js";
import { coinService } from "../../coins/application/coinService.js";

// ─── Redemption tiers ─────────────────────────────────────────────────────────

export const REDEMPTION_TIERS = [
  {
    id: "BRONZE",
    label: "Bronze",
    emoji: "🥉",
    coinsRequired: 500,
    rewardType: "DISCOUNT",
    rewardValueNaira: 500,
    description: "5% discount on SME Paddy premium features",
    shortDesc: "₦500 value",
  },
  {
    id: "SILVER",
    label: "Silver",
    emoji: "🥈",
    coinsRequired: 1000,
    rewardType: "AIRTIME",
    rewardValueNaira: 1000,
    description: "₦1,000 airtime or data voucher (any network)",
    shortDesc: "₦1,000 airtime",
  },
  {
    id: "GOLD",
    label: "Gold",
    emoji: "🥇",
    coinsRequired: 2500,
    rewardType: "CASH",
    rewardValueNaira: 2000,
    description: "₦2,000 cash-equivalent voucher",
    shortDesc: "₦2,000 value",
  },
  {
    id: "PLATINUM",
    label: "Platinum",
    emoji: "💎",
    coinsRequired: 5000,
    rewardType: "CASH",
    rewardValueNaira: 5000,
    description: "₦5,000 cash-equivalent — direct bank transfer",
    shortDesc: "₦5,000 value",
  },
  {
    id: "DIAMOND",
    label: "Diamond",
    emoji: "👑",
    coinsRequired: 10000,
    rewardType: "CASH",
    rewardValueNaira: 10000,
    description: "₦10,000 value — full premium access or bank transfer",
    shortDesc: "₦10,000 value",
  },
] as const;

type TierId = (typeof REDEMPTION_TIERS)[number]["id"];

export class RedemptionService {
  async getTiers(context: AuthenticatedContext) {
    const businessProfileId = this.requireBusiness(context);
    const wallet = await prisma.wallet.findFirst({ where: { businessProfileId } });
    const balance = wallet?.availableBalance ?? 0;

    const recent = await prisma.coinRedemption.findMany({
      where: { businessProfileId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return {
      balance,
      tiers: REDEMPTION_TIERS.map((t) => ({
        ...t,
        unlocked: balance >= t.coinsRequired,
        canRedeem: balance >= t.coinsRequired,
      })),
      history: recent.map((r) => ({
        id: r.id,
        tier: r.tier,
        coinsSpent: r.coinsSpent,
        rewardType: r.rewardType,
        rewardValue: r.rewardValue,
        status: r.status,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async redeem(context: AuthenticatedContext, tierId: string) {
    const businessProfileId = this.requireBusiness(context);

    const tier = REDEMPTION_TIERS.find((t) => t.id === tierId);
    if (!tier) throw new AppError("Invalid redemption tier", 422, "INVALID_TIER");

    // Check minimum usage period — 90 days account activity before first redemption
    const firstActivity = await prisma.coinTransaction.findFirst({
      where: { wallet: { businessProfileId } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    const daysSince = firstActivity
      ? Math.floor((Date.now() - firstActivity.createdAt.getTime()) / 86_400_000)
      : 0;
    // TODO: enforce 90-day rule in production (relaxed to 0 for testing)
    if (daysSince < 0) {
      throw new AppError("You need at least 90 days of activity before your first redemption", 422, "MINIMUM_PERIOD_NOT_MET");
    }

    // Spend coins
    const spent = await coinService.spendCoins(
      businessProfileId,
      tier.coinsRequired,
      "COIN_REDEMPTION",
    );
    if (!spent) {
      throw new AppError(`You need ${tier.coinsRequired} coins to redeem this reward. Keep earning!`, 422, "INSUFFICIENT_COINS");
    }

    // Record redemption
    const redemption = await prisma.coinRedemption.create({
      data: {
        businessProfileId,
        coinsSpent: tier.coinsRequired,
        tier: tier.id,
        rewardType: tier.rewardType,
        rewardValue: tier.rewardValueNaira * 100, // store in kobo
        status: "PENDING",
        note: tier.description,
      },
    });

    return {
      redemption: {
        id: redemption.id,
        tier: tier.id,
        tierLabel: tier.label,
        coinsSpent: tier.coinsRequired,
        rewardType: tier.rewardType,
        rewardValue: tier.rewardValueNaira,
        status: "PENDING",
        message: `Your ${tier.label} reward is being processed. We'll contact you within 24 hours to fulfil your reward.`,
        createdAt: redemption.createdAt.toISOString(),
      },
    };
  }

  private requireBusiness(context: AuthenticatedContext) {
    if (!context.business) throw new AppError("Business required", 403, "BUSINESS_REQUIRED");
    return context.business.id;
  }
}

export const redemptionService = new RedemptionService();
