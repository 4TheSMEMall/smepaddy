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
    setSelectedPoint(0);
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
    <div className="mx-4 sm:mx-0">
      <div className="mb-[22px] flex items-center justify-between">
        <h2 className="text-[33px] font-extrabold leading-none tracking-normal">
          Transactions
        </h2>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" className="h-12 rounded-3xl px-4">
            <Download />
            Export
          </Button>
          <Button
            variant="success"
            size="sm"
            className="h-12 rounded-3xl px-5"
            onClick={onRecord}
          >
            <Plus />
            Record
          </Button>
        </div>
      </div>
      <PeriodPills activePeriod={activePeriod} onPeriodChange={onPeriodChange} />

      <Card className="mb-[22px] p-6">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-[23px] font-bold text-[#13223a]">{activePeriod}</p>
          <div className="flex items-center gap-4 text-[15px] font-semibold text-[#64748b]">
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

        <div className="flex h-[226px] items-end justify-around gap-3 px-2 pb-2">
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

        <div className="mt-5 rounded-[18px] bg-[#f6f8fb] px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[19px] font-extrabold text-[#13223a]">
              {selected.label}
            </p>
            <p className="text-[16px] font-semibold text-[#64748b]">
              Tap a bar to inspect
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SummaryTile label="Money In" value={selected.income} tone="income" />
            <SummaryTile label="Money Out" value={selected.expense} tone="expense" />
          </div>
        </div>
      </Card>

      <div className="mb-6 flex gap-3">
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

      <div className="space-y-4">
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
      className="group flex min-w-[44px] flex-1 flex-col items-center gap-3 outline-none"
      onClick={onSelect}
    >
      <div className="relative flex h-[150px] items-end gap-1">
        <div
          className={cn(
            "w-7 rounded-t-lg bg-[#08b879] transition-all",
            active && "ring-4 ring-[#c9f5e4]",
            point.income === 0 && "bg-[#d8e1ec]",
          )}
          style={{ height: point.income > 0 ? incomeHeight : 8 }}
        />
        {expenseHeight > 0 && (
          <div
            className="w-7 rounded-t-lg bg-[#ef3b42] transition-all"
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
          "text-[17px] font-semibold text-[#8a97ad]",
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
      <p className="text-[15px] font-bold uppercase text-[#64748b]">{label}</p>
      <p
        className={cn(
          "mt-1 text-[22px] font-extrabold",
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
    <div className="flex min-h-[104px] w-full items-center gap-5 px-5 py-5">
      {/* Left accent strip */}
      <div className="absolute left-0 top-0 h-full w-[5px] rounded-l-[20px] bg-[#08b879]" />

      <div className="grid size-[52px] shrink-0 place-items-center rounded-[18px] bg-[#eafaf4] text-[#05a970]">
        {isCredit ? <FileText className="size-[22px]" /> : <TrendingUp className="size-[22px]" />}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[22px] font-bold text-[#0f172a]">
          {sale.itemNames.join(", ") || "Sale"}
        </h3>
        <p className="mt-1 flex items-center gap-2 text-[17px] text-[#8b99b3]">
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

      <div className="flex shrink-0 items-center gap-2">
        <p className="text-[23px] font-extrabold text-[#009f6b]">
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
    <div className="flex min-h-[104px] w-full items-center gap-5 px-5 py-5">
      <div className="absolute left-0 top-0 h-full w-[5px] rounded-l-[20px] bg-[#ef3b42]" />
      <div className="grid size-[52px] shrink-0 place-items-center rounded-[18px] bg-[#fff0f0] text-[#ef3b42]">
        <TrendingDown className="size-[22px]" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[22px] font-bold text-[#0f172a]">{expense.category}</h3>
        <p className="mt-1 text-[17px] text-[#8b99b3]">
          {timeAgo(expense.createdAt)}
          {expense.description && (
            <>
              <span className="mx-2 inline-block size-1 rounded-full bg-[#c8d3e0]" />
              <span className="truncate">{expense.description}</span>
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <p className="text-[23px] font-extrabold text-[#ef3b42]">
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
