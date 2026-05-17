"use client";

import { useEffect, useState } from "react";
import {
  Banknote,
  ChevronRight,
  Gift,
  Package,
  Sparkles,
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  Users,
  Wrench,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PaddyCoinIcon } from "@/components/PaddyCoinIcon";
import { ApiError } from "@/lib/api";
import { makeCacheKey, readClientCache, writeClientCache } from "@/lib/clientCache";
import { getDashboardSummary, type DashboardSummary } from "@/lib/dashboardApi";
import { getStoredAccessToken } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { Period } from "@/types/dashboard";

import { IconBubble } from "../IconBubble";
import { PeriodPills } from "../PeriodPills";

export function HomeScreen({
  activePeriod,
  onPeriodChange,
  onExpense,
}: {
  activePeriod: Period;
  onPeriodChange: (period: Period) => void;
  onExpense: () => void;
}) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      const token = getStoredAccessToken();
      if (!token) return;

      const cacheKey = makeCacheKey(token, "dashboard-summary");
      const cached = readClientCache<DashboardSummary>(cacheKey);
      if (cached && !cancelled) setSummary(cached.value);

      try {
        const freshSummary = await getDashboardSummary(token);
        if (cancelled) return;
        setSummary(freshSummary);
        writeClientCache(cacheKey, freshSummary);
      } catch (error) {
        if (error instanceof ApiError) return;
        throw error;
      }
    }

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-5">
      <PeriodPills activePeriod={activePeriod} onPeriodChange={onPeriodChange} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <MoneySummaryCard
          tone="in"
          title="MONEY IN"
          period={activePeriod}
          value={summary?.moneyIn ?? 0}
        />
        <MoneySummaryCard
          tone="out"
          title="MONEY OUT"
          period={activePeriod}
          value={summary?.moneyOut ?? 0}
        />
      </div>
      <CashCard value={summary?.cashAtHand ?? 0} />
      <SetupCard />
      <QuickStartCard onExpense={onExpense} />
      <RewardCard
        tone="amber"
        title="Redeem Rewards"
        text={<CoinLine prefix="You have" amount="60" suffix="to spend" />}
      />
      <RewardCard
        tone="blue"
        title="TSM Services"
        text={<CoinLine prefix="Spend" amount="60" suffix="on business services" />}
      />
      <RewardCard
        tone="blue"
        title="Invite Friends"
        text={<CoinLine prefix="Earn" amount="50" suffix="for each friend who joins" />}
      />
      <RecentTransactionsCard sales={summary?.recentSales ?? []} />
    </div>
  );
}

function MoneySummaryCard({
  title,
  tone,
  period,
  value,
}: {
  title: string;
  tone: "in" | "out";
  period: Period;
  value: number;
}) {
  return (
    <Card
      className={cn(
        "relative h-[132px] overflow-hidden border-0 px-5 py-5 text-white shadow-[0_8px_16px_rgba(15,23,42,0.07)] sm:h-[138px]",
        tone === "in" ? "bg-[#05b878]" : "bg-[#f60051]",
      )}
    >
      <div className="absolute -right-7 -top-8 size-[96px] rounded-full bg-white/14" />
      <p className="flex items-center gap-1.5 text-[16px] font-semibold sm:text-[17px]">
        {tone === "in" ? (
          <ArrowUpRight className="size-4" />
        ) : (
          <ArrowDownRight className="size-4" />
        )}
        {title}
      </p>
      <p className="mt-4 text-[29px] font-bold leading-none sm:text-[31px]">
        {formatMoney(value)}
      </p>
      <p className="mt-3 text-[16px] sm:text-[17px]">{period}</p>
    </Card>
  );
}

function CashCard({ value }: { value: number }) {
  return (
    <Card className="relative h-[116px] overflow-hidden border-0 bg-[#142139] px-5 py-5 text-white shadow-[0_8px_16px_rgba(15,23,42,0.14)] sm:h-[120px]">
      <div className="absolute -right-7 -top-8 size-[108px] rounded-full bg-white/5" />
      <div className="absolute right-5 top-6 grid size-[64px] place-items-center rounded-[18px] bg-[#145e5a] text-[#13e7a7]">
        <TrendingUp className="size-7" />
      </div>
      <p className="text-[17px] font-medium text-[#9eb3cf]">CASH AT HAND</p>
      <p className="mt-3 text-[33px] font-bold leading-none sm:text-[35px]">
        {formatMoney(value)}
      </p>
    </Card>
  );
}

function SetupCard() {
  return (
    <Card className="px-5 py-5">
      <div className="mb-6 flex items-start gap-4">
        <div className="grid size-[76px] shrink-0 place-items-center rounded-full border-[5px] border-[#eef2f7] text-[21px] font-bold">
          0/3
        </div>
        <div className="flex-1 pt-1">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[20px] font-bold">Set up your business</h2>
              <p className="mt-1 text-[17px] text-[#6f7f9a]">3 steps remaining</p>
              <p className="mt-2 text-[16px] font-medium text-[#e67800]">
                <span className="inline-flex items-center gap-1.5">
                  <PaddyCoinIcon className="size-4" />
                  +50 coins on completion
                </span>
              </p>
            </div>
            <X className="size-5 text-[#91a0b7]" />
          </div>
        </div>
      </div>
      <div className="space-y-5">
        {[
          ["1", "Add your first product or service", "Stock your shop or list a service"],
          ["2", "Record your first sale", "Log a sale, service, or expense"],
          ["3", "Create your first invoice", "Send a professional invoice to a customer"],
        ].map(([step, title, text]) => (
          <button key={step} className="flex w-full items-center gap-4 text-left">
            <span className="grid size-10 shrink-0 place-items-center rounded-full border-[2px] border-[#dfe6f0] text-[16px] font-semibold text-[#91a0b7]">
              {step}
            </span>
            <span className="flex-1">
              <span className="block text-[19px] font-semibold">{title}</span>
              <span className="text-[16px] text-[#8b99b3]">{text}</span>
            </span>
            <ChevronRight className="size-5 text-[#c1cad8]" />
          </button>
        ))}
      </div>
    </Card>
  );
}

function QuickStartCard({ onExpense }: { onExpense: () => void }) {
  return (
    <div className="grid grid-cols-[1fr_104px] gap-3 sm:gap-4">
      <Card className="border-[#bdd4ff] bg-[#eaf3ff] px-5 py-5">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex gap-4">
            <IconBubble tone="blue">
              <Sparkles className="size-6" />
            </IconBubble>
            <h3 className="max-w-[430px] text-[18px] font-semibold leading-6 sm:text-[19px]">
              Add your products and services to start recording sales
            </h3>
          </div>
          <X className="size-5 text-[#91a0b7]" />
        </div>
        <div className="ml-[62px] flex gap-2.5">
          <Button size="sm" className="h-10 rounded-3xl px-4 text-[16px]">
            <Package className="size-4" />
            Add Product
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-10 rounded-3xl px-4 text-[16px] text-[#1557df]"
          >
            <Wrench className="size-4" />
            Add Service
          </Button>
        </div>
      </Card>
      <button
        className="flex flex-col items-center justify-center gap-3 rounded-[18px] border border-[#e4e9f0] bg-white shadow-[0_2px_5px_rgba(15,23,42,0.11)]"
        onClick={onExpense}
      >
        <span className="grid size-[56px] place-items-center rounded-[18px] bg-[#f40652] text-white shadow-[0_6px_14px_rgba(244,6,82,0.2)]">
          <Banknote className="size-7" />
        </span>
        <span className="text-[16px] font-semibold sm:text-[17px] text-[#17233a]">Expense</span>
      </button>
    </div>
  );
}

function RewardCard({
  tone,
  title,
  text,
}: {
  tone: "amber" | "blue";
  title: string;
  text: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "flex h-[150px] items-center gap-4 px-5",
        tone === "amber"
          ? "border-[#ffe5a7] bg-[#fffdf2]"
          : "border-[#c7dcff] bg-[#eef6ff]",
      )}
    >
      <IconBubble tone={tone}>
        {tone === "amber" ? <Gift className="size-7" /> : <Users className="size-7" />}
      </IconBubble>
      <div className="flex-1">
        <h3 className="text-[19px] font-semibold">{title}</h3>
        <div className="mt-1 text-[16px] text-[#52617a]">{text}</div>
      </div>
      <ChevronRight
        className={cn("size-6", tone === "amber" ? "text-[#e19424]" : "text-[#6d95ec]")}
      />
    </Card>
  );
}

function CoinLine({
  prefix,
  amount,
  suffix,
}: {
  prefix: string;
  amount: string;
  suffix: string;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {prefix}
      <span className="inline-flex items-center gap-1 font-semibold text-[#d98900]">
        <PaddyCoinIcon className="size-4" />
        {amount}
      </span>
      {suffix}
    </span>
  );
}

function RecentTransactionsCard({ sales }: { sales: DashboardSummary["recentSales"] }) {
  if (sales.length > 0) {
    return (
      <Card className="px-5 py-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[19px] font-semibold">Recent sales</h3>
          <span className="text-[14px] font-medium text-[#8b99b3]">Latest 5</span>
        </div>
        <div className="space-y-3">
          {sales.map((sale) => (
            <div
              key={sale.id}
              className="flex items-center gap-3 rounded-[14px] bg-[#f8fafc] px-3 py-3"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e7fff5] text-[#02b875]">
                <ArrowUpRight className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold text-[#17233a]">
                  {sale.title}
                </span>
                <span className="text-[14px] text-[#8b99b3]">
                  {new Date(sale.createdAt).toLocaleDateString("en-NG")}
                </span>
              </span>
              <span className="text-[16px] font-bold text-[#02b875]">
                +{formatMoney(sale.amount)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="grid h-[190px] place-items-center text-center">
      <div>
        <IconBubble tone="blue">
          <Banknote className="size-6" />
        </IconBubble>
        <h3 className="mt-6 text-[19px] font-semibold">No recent transactions</h3>
        <p className="mt-2 text-[16px] text-[#334155]">
          Record your first sale or expense to see
        </p>
      </div>
    </Card>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}


