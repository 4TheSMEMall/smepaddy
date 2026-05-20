import { getJson } from "@/lib/api";

export type DashboardSummary = {
  moneyIn: number;
  moneyOut: number;
  cashAtHand: number;
  outstandingInvoices: number;
  lowStockCount: number;
  onboarding: {
    stockAdded: boolean;
    saleRecorded: boolean;
    invoiceCreated: boolean;
    completed: boolean;
  };
  recentSales: {
    id: string;
    title: string;
    amount: number;
    balance: number;
    createdAt: string;
  }[];
};

export function getDashboardSummary(token: string) {
  return getJson<DashboardSummary>("/dashboard/summary", token);
}
