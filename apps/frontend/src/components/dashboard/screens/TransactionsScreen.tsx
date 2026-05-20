"use client";

import {
  ChevronRight,
  Download,
  FileText,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { makeCacheKey, readClientCache, writeClientCache } from "@/lib/clientCache";
import { listExpenses, type ExpenseItem } from "@/lib/expenseApi";
import { listSales, type SaleListItem } from "@/lib/salesApi";
import { getStoredAccessToken } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { Period } from "@/types/dashboard";

import { PeriodPills } from "../PeriodPills";
import { Pill } from "../Pill";

type TransactionFilter = "All" | "Money In" | "Money Out";

type ChartPoint = {
  label: string;
  income: number;
  expense: number;
};

export function TransactionsScreen({
  activePeriod,
  onPeriodChange,
  onRecord,
  onSelectSale,
  onSelectExpense,
  refreshKey = 0,
}: {
  activePeriod: Period;
  onPeriodChange: (period: Period) => void;
  onRecord: () => void;
  onSelectSale?: (sale: SaleListItem) => void;
  onSelectExpense?: (expense: ExpenseItem) => void;
  refreshKey?: number;
}) {
  const [activeFilter, setActiveFilter] = useState<TransactionFilter>("All");
  const [sales, setSales] = useState<SaleListItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [selectedPoint, setSelectedPoint] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTransactions() {
      const token = getStoredAccessToken();
      if (!token) {
        setError("Your login session has expired. Please log in again.");
        setLoading(false);
        return;
      }

      const salesCacheKey = makeCacheKey(token, "sales");
      const expensesCacheKey = makeCacheKey(token, "expenses");

      const cachedSales = readClientCache<{ sales: SaleListItem[] }>(salesCacheKey);
      const cachedExpenses = readClientCache<{ expenses: ExpenseItem[] }>(expensesCacheKey);

      if (cachedSales) setSales(cachedSales.value.sales);
      if (cachedExpenses) setExpenses(cachedExpenses.value.expenses);
      if (cachedSales || cachedExpenses) setLoading(false);
      else setLoading(true);

      setError(null);

      try {
        const [salesResponse, expensesResponse] = await Promise.all([
          listSales(token, { limit: 50 }),
          listExpenses(token, { limit: 50 }),
        ]);
        if (!cancelled) {
          setSales(salesResponse.sales);
          setExpenses(expensesResponse.expenses);
          writeClientCache(salesCacheKey, salesResponse);
          writeClientCache(expensesCacheKey, expensesResponse);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Unable to load transactions right now.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTransactions();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const visibleSales = useMemo(
    () => filterByPeriod(sales, activePeriod),
    [activePeriod, sales],
  );

  const visibleExpenses = useMemo(
    () => filterByPeriod(expenses, activePeriod),
    [activePeriod, expenses],
  );

  const chartPoints = useMemo(
    () => buildChartPoints(visibleSales, visibleExpenses, activePeriod),
    [activePeriod, visibleSales, visibleExpenses],
  );

  useEffect(() => {
    const timer = setTimeout(() => setSelectedPoint(0), 0);
    return () => clearTimeout(timer);
  }, [activePeriod]);

  // Merge sales + expenses into one chronological list, filtered by tab.
  const allTransactions = useMemo(() => {
    const saleItems = visibleSales.map((s) => ({ kind: "sale" as const, data: s, createdAt: s.createdAt }));
    const expenseItems = visibleExpenses.map((e) => ({ kind: "expense" as const, data: e, createdAt: e.createdAt }));
    return [...saleItems, ...expenseItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [visibleSales, visibleExpenses]);

  const filteredTransactions = allTransactions.filter((item) => {
    if (activeFilter === "Money In") return item.kind === "sale";
    if (activeFilter === "Money Out") return item.kind === "expense";
    return true;
  });

  const selected = chartPoints[selectedPoint] ?? chartPoints[0];

  return (
    <div className="space-y-5 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[28px] font-extrabold leading-tight tracking-normal text-[#071122] sm:text-[33px]">
          Transactions
        </h2>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none sm:gap-3">
          <Button variant="secondary" size="sm" className="h-10 rounded-2xl px-3 text-[14px] sm:h-12 sm:rounded-3xl sm:px-4 sm:text-[18px]" onClick={() => exportCSV(filteredTransactions, activePeriod)}>
            <Download />
            <span className="hidden min-[380px]:inline">Export</span>
          </Button>
          <Button
            variant="success"
            size="sm"
            className="h-10 rounded-2xl px-3 text-[14px] sm:h-12 sm:rounded-3xl sm:px-5 sm:text-[18px]"
            onClick={onRecord}
          >
            <Plus />
            Record
          </Button>
        </div>
      </div>
      <PeriodPills activePeriod={activePeriod} onPeriodChange={onPeriodChange} />

      <Card className="p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[18px] font-bold text-[#13223a] sm:text-[23px]">{activePeriod}</p>
          <div className="flex items-center gap-3 text-[12px] font-semibold text-[#64748b] sm:gap-4 sm:text-[15px]">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-[#08b879]" />
              Money In
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-[#ef3b42]" />
              Money Out
            </span>
          </div>
        </div>

        <div className="no-scrollbar -mx-1 flex h-[176px] items-end justify-around gap-2 overflow-x-auto px-1 pb-1 sm:h-[226px] sm:gap-3 sm:px-2 sm:pb-2">
          {chartPoints.map((point, index) => (
            <ChartBar
              key={point.label}
              point={point}
              active={selectedPoint === index}
              maxValue={Math.max(...chartPoints.map((item) => item.income + item.expense), 1)}
              onSelect={() => setSelectedPoint(index)}
            />
          ))}
        </div>

        <div className="mt-4 rounded-[18px] bg-[#f6f8fb] px-4 py-4 sm:mt-5 sm:px-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[16px] font-extrabold text-[#13223a] sm:text-[19px]">
              {selected.label}
            </p>
            <p className="text-[12px] font-semibold text-[#64748b] sm:text-[16px]">
              Tap a bar to inspect
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
            <SummaryTile label="Money In" value={selected.income} tone="income" />
            <SummaryTile label="Money Out" value={selected.expense} tone="expense" />
          </div>
        </div>
      </Card>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:gap-3">
        {(["All", "Money In", "Money Out"] as TransactionFilter[]).map((item) => (
          <Pill
            key={item}
            active={activeFilter === item}
            onClick={() => setActiveFilter(item)}
          >
            {item}
          </Pill>
        ))}
      </div>

      <div className="space-y-3 sm:space-y-4">
        {loading && <TransactionMessage title="Loading transactions..." />}
        {error && !loading && <TransactionMessage title={error} />}
        {!loading && !error && filteredTransactions.length === 0 && (
          <TransactionMessage
            title="No transactions yet"
            text={
              activeFilter === "Money Out"
                ? "Record an expense to start tracking money out."
                : "Record a sale to start seeing real transactions here."
            }
          />
        )}
        {!loading &&
          !error &&
          filteredTransactions.map((item) =>
            item.kind === "sale" ? (
              <TransactionCard
                key={item.data.id}
                sale={item.data}
                onClick={onSelectSale ? () => onSelectSale(item.data as SaleListItem) : undefined}
              />
            ) : (
              <ExpenseCard
                key={item.data.id}
                expense={item.data as ExpenseItem}
                onClick={onSelectExpense ? () => onSelectExpense(item.data as ExpenseItem) : undefined}
              />
            ),
          )}
      </div>
    </div>
  );
}

function ChartBar({
  point,
  active,
  maxValue,
  onSelect,
}: {
  point: ChartPoint;
  active: boolean;
  maxValue: number;
  onSelect: () => void;
}) {
  const incomeHeight = Math.max(8, Math.round((point.income / maxValue) * 132));
  const expenseHeight = Math.max(point.expense > 0 ? 8 : 0, Math.round((point.expense / maxValue) * 132));

  return (
    <button
      type="button"
      className="group flex min-w-[38px] flex-1 flex-col items-center gap-2 outline-none sm:min-w-[44px] sm:gap-3"
      onClick={onSelect}
    >
      <div className="relative flex h-[112px] items-end gap-1 sm:h-[150px]">
        <div
          className={cn(
            "w-4 rounded-t-md bg-[#08b879] transition-all sm:w-7 sm:rounded-t-lg",
            active && "ring-4 ring-[#c9f5e4]",
            point.income === 0 && "bg-[#d8e1ec]",
          )}
          style={{ height: point.income > 0 ? incomeHeight : 8 }}
        />
        {expenseHeight > 0 && (
          <div
            className="w-4 rounded-t-md bg-[#ef3b42] transition-all sm:w-7 sm:rounded-t-lg"
            style={{ height: expenseHeight }}
          />
        )}
        <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 hidden w-[172px] -translate-x-1/2 rounded-2xl bg-[#111827] px-4 py-3 text-left text-[15px] font-semibold text-white shadow-xl group-hover:block">
          <p className="mb-1 text-[#cbd5e1]">{point.label}</p>
          <p>In: {formatMoney(point.income)}</p>
          <p>Out: {formatMoney(point.expense)}</p>
        </div>
      </div>
      <span
        className={cn(
          "text-[12px] font-semibold text-[#8a97ad] sm:text-[17px]",
          active && "text-[#2563eb]",
        )}
      >
        {point.label}
      </span>
    </button>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "income" | "expense";
}) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3">
      <p className="text-[12px] font-bold uppercase text-[#64748b] sm:text-[15px]">{label}</p>
      <p
        className={cn(
          "mt-1 break-words text-[18px] font-extrabold sm:text-[22px]",
          tone === "income" ? "text-[#06a873]" : "text-[#ef3b42]",
        )}
      >
        {formatMoney(value)}
      </p>
    </div>
  );
}

function TransactionCard({
  sale,
  onClick,
}: {
  sale: SaleListItem;
  onClick?: () => void;
}) {
  const isCredit = sale.balance > 0;
  const displayAmount = sale.amountPaid > 0 ? sale.amountPaid : sale.subtotal;

  const content = (
    <div className="flex min-h-[92px] w-full items-center gap-3 px-4 py-4 sm:min-h-[104px] sm:gap-5 sm:px-5 sm:py-5">
      {/* Left accent strip */}
      <div className="absolute left-0 top-0 h-full w-[5px] rounded-l-[20px] bg-[#08b879]" />

      <div className="grid size-11 shrink-0 place-items-center rounded-[16px] bg-[#eafaf4] text-[#05a970] sm:size-[52px] sm:rounded-[18px]">
        {isCredit ? <FileText className="size-[22px]" /> : <TrendingUp className="size-[22px]" />}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[16px] font-bold text-[#0f172a] sm:text-[22px]">
          {sale.itemNames.join(", ") || "Sale"}
        </h3>
        <p className="mt-1 flex min-w-0 items-center gap-2 text-[13px] text-[#8b99b3] sm:text-[17px]">
          {timeAgo(sale.createdAt)}
          {sale.customerName && (
            <>
              <span className="size-1 rounded-full bg-[#c8d3e0]" />
              <span className="truncate">{sale.customerName}</span>
            </>
          )}
        </p>
        {isCredit && (
          <span className="mt-2 inline-block rounded-full bg-[#fff4e0] px-2.5 py-0.5 text-[14px] font-bold text-[#d98900]">
            Credit
          </span>
        )}
      </div>

      <div className="flex max-w-[42%] shrink-0 items-center gap-1.5 sm:gap-2">
        <p className="break-words text-right text-[15px] font-extrabold leading-tight text-[#009f6b] sm:text-[23px]">
          +{formatMoney(displayAmount)}
        </p>
        {onClick && <ChevronRight className="size-5 text-[#c3cdd8]" />}
      </div>
    </div>
  );

  const cardClass =
    "relative overflow-hidden rounded-[20px] bg-white shadow-[0_4px_20px_rgba(15,23,42,0.07)] transition-transform duration-100";

  if (onClick) {
    return (
      <button
        type="button"
        className={cn(cardClass, "w-full text-left active:scale-[0.98]")}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <div className={cardClass}>{content}</div>;
}

function ExpenseCard({ expense, onClick }: { expense: ExpenseItem; onClick?: () => void }) {
  const cardClass =
    "relative overflow-hidden rounded-[20px] bg-white shadow-[0_4px_20px_rgba(15,23,42,0.07)] transition-transform duration-100";

  const content = (
    <div className="flex min-h-[92px] w-full items-center gap-3 px-4 py-4 sm:min-h-[104px] sm:gap-5 sm:px-5 sm:py-5">
      <div className="absolute left-0 top-0 h-full w-[5px] rounded-l-[20px] bg-[#ef3b42]" />
      <div className="grid size-11 shrink-0 place-items-center rounded-[16px] bg-[#fff0f0] text-[#ef3b42] sm:size-[52px] sm:rounded-[18px]">
        <TrendingDown className="size-[22px]" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[16px] font-bold text-[#0f172a] sm:text-[22px]">{expense.category}</h3>
        <p className="mt-1 truncate text-[13px] text-[#8b99b3] sm:text-[17px]">
          {timeAgo(expense.createdAt)}
          {expense.description && (
            <>
              <span className="mx-2 inline-block size-1 rounded-full bg-[#c8d3e0]" />
              <span className="truncate">{expense.description}</span>
            </>
          )}
        </p>
      </div>
      <div className="flex max-w-[42%] shrink-0 items-center gap-1.5 sm:gap-2">
        <p className="break-words text-right text-[15px] font-extrabold leading-tight text-[#ef3b42] sm:text-[23px]">
          -{formatMoney(expense.amount)}
        </p>
        {onClick && <ChevronRight className="size-5 text-[#c3cdd8]" />}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={cn(cardClass, "w-full text-left active:scale-[0.98]")}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <div className={cardClass}>{content}</div>;
}

function TransactionMessage({ title, text }: { title: string; text?: string }) {
  return (
    <Card className="grid min-h-[220px] place-items-center px-6 text-center">
      <div>
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-3xl bg-[#f1f5fb] text-[#9fb3ce]">
          <TrendingDown className="size-8" />
        </div>
        <h3 className="text-[24px] font-extrabold text-[#0f172a]">{title}</h3>
        {text && <p className="mt-2 text-[18px] text-[#64748b]">{text}</p>}
      </div>
    </Card>
  );
}

function filterByPeriod<T extends { createdAt: string }>(items: T[], period: Period): T[] {
  const { start, end } = getPeriodBounds(period);
  return items.filter((item) => {
    const t = new Date(item.createdAt).getTime();
    return t >= start.getTime() && t <= end.getTime();
  });
}

function buildChartPoints(
  sales: SaleListItem[],
  expenses: ExpenseItem[],
  period: Period,
): ChartPoint[] {
  const labels = getChartLabels(period);
  const points = labels.map((label) => ({ label, income: 0, expense: 0 }));

  sales.forEach((sale) => {
    const index = getChartIndex(new Date(sale.createdAt), period);
    if (points[index]) points[index].income += sale.amountPaid;
  });

  expenses.forEach((expense) => {
    const index = getChartIndex(new Date(expense.createdAt), period);
    if (points[index]) points[index].expense += expense.amount;
  });

  return points;
}

function getChartLabels(period: Period) {
  if (period === "This Week") return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (period === "This Month") return ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Wk 5"];
  if (period === "This Quarter") return ["M1", "M2", "M3"];
  return ["Q1", "Q2", "Q3", "Q4"];
}

function getChartIndex(date: Date, period: Period) {
  if (period === "This Week") return date.getDay();
  if (period === "This Month") return Math.min(4, Math.floor((date.getDate() - 1) / 7));
  if (period === "This Quarter") return date.getMonth() % 3;
  return Math.floor(date.getMonth() / 3);
}

function getPeriodBounds(period: Period) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === "This Week") {
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (period === "This Month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(start.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (period === "This Quarter") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    start.setMonth(quarterStartMonth, 1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(quarterStartMonth + 3, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  start.setMonth(0, 1);
  start.setHours(0, 0, 0, 0);
  end.setMonth(11, 31);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

type TransactionItem =
  | { kind: "sale"; data: SaleListItem; createdAt: string }
  | { kind: "expense"; data: ExpenseItem; createdAt: string };

function exportCSV(transactions: TransactionItem[], period: string) {
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(v);
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  const header = "Date,Type,Description,Amount (NGN),Payment Method,Status";
  const rows = transactions.map((item) => {
    if (item.kind === "sale") {
      const s = item.data;
      return [
        fmtDate(s.createdAt),
        "Sale",
        `"${s.itemNames.join(", ") || "Sale"}"`,
        fmt(s.amountPaid > 0 ? s.amountPaid : s.subtotal),
        s.paymentMethod ?? "—",
        s.paymentStatus === "PAID" ? "Paid" : s.paymentStatus === "PART_PAYMENT" ? "Partial" : "Credit",
      ].join(",");
    } else {
      const e = item.data;
      return [
        fmtDate(e.createdAt),
        "Expense",
        `"${e.category}${e.description ? ` – ${e.description}` : ""}"`,
        fmt(e.amount),
        e.paymentMethod,
        "—",
      ].join(",");
    }
  });

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `SMEPaddy-Transactions-${period.replace(/\s/g, "-")}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
