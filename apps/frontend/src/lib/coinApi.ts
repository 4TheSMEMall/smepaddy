import { getJson, postJson } from "@/lib/api";

export type WalletInfo = {
  balance: number;
  totalEarned: number;
  streak: number;
  level: number;
  levelTitle: string;
  nextLevelAt: number | null;
};

export function getWallet(token: string) {
  return getJson<{ wallet: WalletInfo }>("/wallet", token);
}

export function claimDailyLogin(token: string) {
  return postJson<{ awarded: number; wallet: WalletInfo }>("/wallet/login", {}, token);
}
