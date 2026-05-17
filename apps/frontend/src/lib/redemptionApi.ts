import { getJson, postJson } from "@/lib/api";

export type RedemptionTier = {
  id: string;
  label: string;
  emoji: string;
  coinsRequired: number;
  rewardType: string;
  rewardValueNaira: number;
  description: string;
  shortDesc: string;
  unlocked: boolean;
  canRedeem: boolean;
};

export type RedemptionHistory = {
  id: string;
  tier: string;
  coinsSpent: number;
  rewardType: string;
  rewardValue: number;
  status: string;
  note: string | null;
  createdAt: string;
};

export type RedemptionOverview = {
  balance: number;
  tiers: RedemptionTier[];
  history: RedemptionHistory[];
};

export function getRedemptions(token: string) {
  return getJson<RedemptionOverview>("/redemptions", token);
}

export function redeemTier(token: string, tierId: string) {
  return postJson<{
    redemption: {
      id: string; tier: string; tierLabel: string; coinsSpent: number;
      rewardType: string; rewardValue: number; status: string;
      message: string; createdAt: string;
    };
  }>("/redemptions", { tierId }, token);
}
