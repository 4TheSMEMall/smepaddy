"use client";

import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Package,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api";
import { getAnalytics, type AnalyticsPeriod, type AnalyticsSummary } from "@/lib/analyticsApi";
import { getStoredAccessToken } from "@/lib/session";
import { cn } from "@/lib/utils";

const PERIODS: { key: AnalyticsPeriod; label: string }[] = [
  { key: "THIS_WEEK",    label: "Week" },
  { key: "THIS_MONTH",   label: "Month" },
  { key: "THIS_QUARTER", label: "Quarter" },
  { key: "THIS_YEAR",    label: "Year" },
];

export function AnalyticsScreen({ onBack }: { onBack: () => void }) {
  const [period, setPeriod] = useState<AnalyticsPeriod>("THIS_MONTH");
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = getStoredAccessToken();
    if (!token) { setError("Session expired."); setLoading(false); return; }

    setLoading(true);
    getAnalytics(token, period)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : "Unable to load analytics."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [period]);

  const maxChart = data ? Math.max(...data.chart.map((c) => Math.max(c.revenue, c.expenses)), 1) : 1;

  return (
    <div className="mx-4 pb-10 sm:mx-0">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button className="grid size-9 place-items-center" onClick={onBack}>
          <ArrowLeft className="size-7" />
        </button>
        <div>
          <h2 className="text-[31px] font-extrabold leading-none text-[#071122]">Analytics</h2>
          <p className="mt-0.5 text-[16px] text-[#8b99b3]">Business performance</p>
        </div>
      </div>

      {/* Period pills */}
      <div className="mb-6 flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={cn(
              "flex-1 rounded-full py-2 text-[15px] font-bold transition-colors",
              period === p.key
                ? "bg-[#071122] text-white"
                : "bg-[#f1f5f9] text-[#64748b]",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="size-8 animate-spin rounded-full border-4 border-[#f1f5f9] border-t-[#1557df]" />
        </div>
      )}
      {error && <p className="rounded-[14px] bg-[#fff0f0] px-4 py-3 text-[17px] font-semibold text-[#ef3b42]">{error}</p>}

      {data && !loading && (
        <div className="space-y-5">

          {/* ── Key metrics row ── */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              label="Revenue"
              value={data.revenue}
              growth={data.growth.revenue}
              color="#059669"
              icon={<TrendingUp className="size-5" />}
            />
            <MetricCard
              label="Expenses"
              value={data.expenses}
              growth={data.growth.expenses}
              color="#ef3b42"
              icon={<TrendingDown className="size-5" />}
              invertGrowth
            />
            <MetricCard
              label="Profit"
              value={data.profit}
              growth={data.growth.profit}
              color={data.profit >= 0 ? "#1557df" : "#ef3b42"}
              icon={<Wallet className="size-5" />}
            />
          </div>

          {/* ── Revenue vs Expenses chart ── */}
          <div className="rounded-[24px] bg-white p-6 shadow-[0_10px_26px_rgba(15,23,42,0.07)]">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[18px] font-extrabold text-[#071122]">Revenue vs Expenses</p>
              <div className="flex items-center gap-4 text-[13px] font-semibold text-[#64748b]">
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#059669]" />In</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#ef3b42]" />Out</span>
              </div>
            </div>

            {data.chart.length === 0 ? (
              <p className="py-8 text-center text-[16px] text-[#94a3b8]">No data for this period</p>
            ) : (
              <div className="flex h-[140px] items-end gap-1.5 overflow-x-auto pb-1">
                {data.chart.map((point) => (
                  <div key={point.label} className="flex min-w-[28px] flex-1 flex-col items-center gap-1">
                    <div className="flex w-full items-end justify-center gap-0.5" style={{ height: 110 }}>
                      <div
                        className="w-[45%] rounded-t-md bg-[#059669]"
                        style={{ height: Math.max(4, (point.revenue / maxChart) * 110) }}
                      />
                      <div
                        className="w-[45%] rounded-t-md bg-[#ef3b42]"
                        style={{ height: Math.max(point.expenses > 0 ? 4 : 0, (point.expenses / maxChart) * 110) }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-[#94a3b8]">{point.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Counts row ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[20px] bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.07)]">
              <div className="mb-2 flex items-center gap-2 text-[#059669]">
                <TrendingUp className="size-4" />
                <p className="text-[13px] font-bold uppercase tracking-wide">Sales</p>
              </div>
              <p className="text-[28px] font-extrabold text-[#071122]">{data.salesCount}</p>
              <p className="text-[14px] text-[#64748b]">transactions</p>
            </div>
            <div className="rounded-[20px] bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.07)]">
              <div className="mb-2 flex items-center gap-2 text-[#ef3b42]">
                <ReceiptText className="size-4" />
                <p className="text-[13px] font-bold uppercase tracking-wide">Unpaid Invoices</p>
              </div>
              <p className="text-[28px] font-extrabold text-[#071122]">{data.invoices.unpaidCount}</p>
              <p className="text-[14px] text-[#64748b]">{formatMoney(data.invoices.unpaidAmount)} owed</p>
            </div>
          </div>

          {/* ── Top Products ── */}
          {data.topProducts.length > 0 && (
            <div className="rounded-[24px] bg-white p-6 shadow-[0_10px_26px_rgba(15,23,42,0.07)]">
              <div className="mb-4 flex items-center gap-2">
                <Package className="size-5 text-[#1557df]" />
                <p className="text-[18px] font-extrabold text-[#071122]">Top Products</p>
              </div>
              <div className="space-y-3">
                {data.topProducts.map((product, i) => (
                  <div key={product.name} className="flex items-center gap-3">
                    <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#eef4ff] text-[13px] font-bold text-[#1557df]">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] font-bold text-[#071122]">{product.name}</p>
                      <p className="text-[13px] text-[#94a3b8]">{product.units} unit{product.units !== 1 ? "s" : ""} sold</p>
                    </div>
                    <p className="shrink-0 text-[16px] font-extrabold text-[#059669]">
                      {formatMoney(product.revenue)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Expenses by Category ── */}
          {data.expensesByCategory.length > 0 && (
            <div className="rounded-[24px] bg-white p-6 shadow-[0_10px_26px_rgba(15,23,42,0.07)]">
              <div className="mb-4 flex items-center gap-2">
                <TrendingDown className="size-5 text-[#ef3b42]" />
                <p className="text-[18px] font-extrabold text-[#071122]">Expenses Breakdown</p>
              </div>
              <div className="space-y-3">
                {data.expensesByCategory.map((cat) => {
                  const pct = data.expenses > 0 ? Math.round((cat.amount / data.expenses) * 100) : 0;
                  return (
                    <div key={cat.category}>
                      <div className="mb-1 flex justify-between text-[14px]">
                        <span className="font-semibold text-[#334155]">{cat.category}</span>
                        <span className="font-bold text-[#071122]">{formatMoney(cat.amount)} <span className="font-normal text-[#94a3b8]">({pct}%)</span></span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#f1f5f9]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#ef3b42] to-[#f87171]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Empty state ── */}
          {data.salesCount === 0 && data.expensesCount === 0 && (
            <div className="rounded-[24px] bg-white px-6 py-12 text-center shadow-[0_10px_26px_rgba(15,23,42,0.07)]">
              <p className="text-[20px] font-extrabold text-[#071122]">No data yet</p>
              <p className="mt-2 text-[16px] text-[#64748b]">
                Record sales and expenses to see your analytics here.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({
  label, value, growth, color, icon, invertGrowth,
}: {
  label: string; value: number; growth: number;
  color: string; icon: React.ReactNode; invertGrowth?: boolean;
}) {
  const positive = invertGrowth ? growth <= 0 : growth >= 0;
  return (
    <div className="rounded-[20px] bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.07)]">
      <div className="mb-2 flex items-center justify-between">
        <div className="grid size-8 place-items-center rounded-[10px]" style={{ background: `${color}18`, color }}>
          {icon}
        </div>
        {growth !== 0 && (
          <span className={cn("flex items-center gap-0.5 text-[12px] font-bold", positive ? "text-[#059669]" : "text-[#ef3b42]")}>
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(growth)}%
          </span>
        )}
        {growth === 0 && <Minus className="size-3 text-[#94a3b8]" />}
      </div>
      <p className="text-[18px] font-extrabold leading-tight" style={{ color }}>
        {formatCompact(value)}
      </p>
      <p className="mt-0.5 text-[12px] font-semibold text-[#94a3b8]">{label}</p>
    </div>
  );
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function formatMoney(v: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(v);
}

function formatCompact(v: number) {
  if (Math.abs(v) >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `₦${(v / 1_000).toFixed(1)}K`;
  return formatMoney(v);
}
