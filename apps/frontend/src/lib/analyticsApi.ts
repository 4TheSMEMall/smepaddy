import { getJson } from "@/lib/api";

export type AnalyticsPeriod = "THIS_WEEK" | "THIS_MONTH" | "THIS_QUARTER" | "THIS_YEAR";

export type AnalyticsSummary = {
  period: AnalyticsPeriod;
  revenue: number;
  expenses: number;
  profit: number;
  salesCount: number;
  expensesCount: number;
  growth: { revenue: number; expenses: number; profit: number };
  topProducts: { name: string; revenue: number; units: number }[];
  expensesByCategory: { category: string; amount: number }[];
  chart: { label: string; revenue: number; expenses: number }[];
  invoices: { total: number; unpaidCount: number; unpaidAmount: number };
};

export function getAnalytics(token: string, period: AnalyticsPeriod) {
  return getJson<AnalyticsSummary>(`/analytics?period=${period}`, token);
}
