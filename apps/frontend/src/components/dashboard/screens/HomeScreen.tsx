"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  ChevronRight,
  Package,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";

import { PaddyCoinIcon } from "@/components/PaddyCoinIcon";
import { ApiError } from "@/lib/api";
import { makeCacheKey, readClientCache, writeClientCache } from "@/lib/clientCache";
import { getDashboardSummary, type DashboardSummary } from "@/lib/dashboardApi";
import { getStoredAccessToken } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { Period } from "@/types/dashboard";

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
  const [showSetup, setShowSetup] = useState(true);

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
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-5 pb-2">
      {/* Period filter */}
      <PeriodPills activePeriod={activePeriod} onPeriodChange={onPeriodChange} />

      {/* Money In / Money Out */}
      <div className="grid grid-cols-2 gap-3">
        <MoneyCard tone="in" value={summary?.moneyIn ?? 0} period={activePeriod} />
        <MoneyCard tone="out" value={summary?.moneyOut ?? 0} period={activePeriod} />
      </div>

      {/* Cash at Hand */}
      <CashCard value={summary?.cashAtHand ?? 0} />

      {/* Quick actions row */}
      <QuickActions onExpense={onExpense} />

      {/* Setup card */}
      {showSetup && <SetupCard onDismiss={() => setShowSetup(false)} />}

      {/* Recent transactions */}
      <RecentCard sales={summary?.recentSales ?? []} />
    </div>
  );
}

// ─── Money card ────────────────────────────────────────────────────────────────

function MoneyCard({ tone, value, period }: { tone: "in" | "out"; value: number; period: string }) {
  const isIn = tone === "in";
  return (
    <div className={cn(
      "relative min-w-0 overflow-hidden rounded-[20px] px-3.5 py-4 text-white sm:px-4",
      isIn
        ? "bg-gradient-to-br from-[#00c282] to-[#009669]"
        : "bg-gradient-to-br from-[#ff3d71] to-[#d4004c]",
      isIn
        ? "shadow-[0_8px_24px_rgba(0,194,130,0.35)]"
        : "shadow-[0_8px_24px_rgba(255,61,113,0.35)]",
    )}>
      {/* Decorative circle */}
      <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-8 -left-4 size-20 rounded-full bg-black/10" />

      <div className="relative">
        <div className={cn(
          "mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold sm:text-[12px]",
          isIn ? "bg-white/20" : "bg-white/20",
        )}>
          {isIn
            ? <ArrowUpRight className="size-3" />
            : <ArrowDownRight className="size-3" />}
          {isIn ? "MONEY IN" : "MONEY OUT"}
        </div>
        <p className="break-words text-[20px] font-extrabold leading-none tracking-tight sm:text-[22px]">
          {formatMoney(value)}
        </p>
        <p className="mt-1.5 text-[12px] font-medium text-white/70">{period}</p>
      </div>
    </div>
  );
}

// ─── Cash at hand ─────────────────────────────────────────────────────────────

function CashCard({ value }: { value: number }) {
  return (
    <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#0f172a] to-[#1e3a5f] px-5 py-5 text-white shadow-[0_12px_32px_rgba(15,23,42,0.25)]">
      <div className="pointer-events-none absolute -right-8 -top-8 size-36 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-10 left-1/3 size-28 rounded-full bg-[#1557df]/20" />

      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-widest text-white/50">
            Cash at Hand
          </p>
          <p className="mt-2 break-words text-[30px] font-extrabold leading-none tracking-tight sm:text-[32px]">
            {formatMoney(value)}
          </p>
          <p className="mt-2 text-[13px] text-white/50">Available balance</p>
        </div>
        <div className="grid size-12 shrink-0 place-items-center rounded-[18px] bg-gradient-to-br from-[#00c282] to-[#009669] shadow-[0_6px_16px_rgba(0,194,130,0.4)] sm:size-14">
          <Wallet className="size-7" />
        </div>
      </div>
    </div>
  );
}

// ─── Quick actions ────────────────────────────────────────────────────────────

function QuickActions({ onExpense }: { onExpense: () => void }) {
  const actions = [
    { label: "Add Product", icon: Package, color: "from-[#1557df] to-[#0d40b8]", shadow: "rgba(21,87,223,0.35)" },
    { label: "Add Service", icon: Sparkles, color: "from-[#7c3aed] to-[#6d28d9]", shadow: "rgba(124,58,237,0.35)" },
    { label: "Record Expense", icon: Banknote, color: "from-[#ef3b42] to-[#d4004c]", shadow: "rgba(239,59,66,0.35)", onPress: onExpense },
    { label: "View Reports", icon: TrendingUp, color: "from-[#d97706] to-[#b45309]", shadow: "rgba(217,119,6,0.35)" },
  ];

  return (
    <div>
      <p className="mb-3 text-[13px] font-bold uppercase tracking-wide text-[#94a3b8]">
        Quick Actions
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-2">
        {actions.map(({ label, icon: Icon, color, shadow, onPress }) => (
          <button
            key={label}
            onClick={onPress}
            className="flex flex-col items-center gap-2"
          >
            <div className={cn(
              "grid size-full aspect-square max-h-[72px] w-full place-items-center rounded-[18px] bg-gradient-to-br text-white sm:size-14 sm:rounded-[18px]",
              color,
            )}
              style={{ boxShadow: `0 6px 16px ${shadow}` }}>
              <Icon className="size-7 sm:size-6" />
            </div>
            <span className="text-center text-[13px] font-semibold leading-tight text-[#334155] sm:text-[11px]">
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Setup card ───────────────────────────────────────────────────────────────

function SetupCard({ onDismiss }: { onDismiss: () => void }) {
  const steps = [
    { n: "1", title: "Add your first product", sub: "Stock your shop or list a service" },
    { n: "2", title: "Record your first sale", sub: "Log a sale, service, or expense" },
    { n: "3", title: "Create your first invoice", sub: "Send a professional invoice" },
  ];

  return (
    <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_4px_20px_rgba(15,23,42,0.07)]">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-[#eff4ff] to-[#e0eaff] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full border-2 border-[#1557df]/20 bg-white text-[13px] font-extrabold text-[#1557df]">
            0/3
          </div>
          <div>
            <p className="text-[15px] font-bold text-[#071122]">Set up your business</p>
            <p className="flex items-center gap-1 text-[13px] text-[#d97706]">
              <PaddyCoinIcon className="size-3.5" />
              +50 coins on completion
            </p>
          </div>
        </div>
        <button onClick={onDismiss} className="grid size-7 place-items-center rounded-full bg-white/60 text-[#94a3b8]">
          <X className="size-4" />
        </button>
      </div>

      {/* Steps */}
      <div className="divide-y divide-[#f1f5f9] px-5">
        {steps.map(({ n, title, sub }) => (
          <button key={n} className="flex w-full items-center gap-3 py-3.5 text-left active:bg-[#f8fafc]">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[#e2e8f0] text-[13px] font-bold text-[#94a3b8]">
              {n}
            </span>
            <span className="flex-1">
              <span className="block text-[14px] font-semibold text-[#071122]">{title}</span>
              <span className="text-[12px] text-[#94a3b8]">{sub}</span>
            </span>
            <ChevronRight className="size-4 text-[#c1cad8]" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Recent transactions ──────────────────────────────────────────────────────

function RecentCard({ sales }: { sales: DashboardSummary["recentSales"] }) {
  if (sales.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_4px_20px_rgba(15,23,42,0.07)]">
      <div className="flex items-center justify-between px-5 py-4">
        <p className="text-[15px] font-bold text-[#071122]">Recent Sales</p>
        <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[12px] font-semibold text-[#64748b]">
          Latest {sales.length}
        </span>
      </div>
      <div className="space-y-0">
        {sales.map((sale, i) => (
          <div
            key={sale.id}
            className={cn(
              "flex items-center gap-3 px-5 py-3",
              i !== sales.length - 1 && "border-b border-[#f1f5f9]",
            )}
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f0fdf7] text-[#00c282]">
              <ArrowUpRight className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-[#071122]">{sale.title}</p>
              <p className="text-[12px] text-[#94a3b8]">
                {new Date(sale.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
              </p>
            </div>
            <p className="text-[14px] font-bold text-[#00c282]">+{formatMoney(sale.amount)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}
