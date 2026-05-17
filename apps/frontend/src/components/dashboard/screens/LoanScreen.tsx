"use client";

import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Lock,
  TrendingUp,
  Unlock,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api";
import { getLoanEligibility, type EligibilityResult, type Loan } from "@/lib/loanApi";
import { getStoredAccessToken } from "@/lib/session";
import { cn } from "@/lib/utils";

// ─── Score bands ─────────────────────────────────────────────────────────────

const PCS_BANDS = [
  { min: 800, label: "Elite",       color: "#059669", bg: "from-[#059669] to-[#047857]" },
  { min: 650, label: "Trusted",     color: "#2563eb", bg: "from-[#2563eb] to-[#1d4ed8]" },
  { min: 500, label: "Established", color: "#7c3aed", bg: "from-[#7c3aed] to-[#6d28d9]" },
  { min: 300, label: "Growing",     color: "#d97706", bg: "from-[#d97706] to-[#b45309]" },
  { min: 0,   label: "Building",    color: "#64748b", bg: "from-[#334155] to-[#0f172a]" },
];

function bandFor(pcs: number) {
  return PCS_BANDS.find((b) => pcs >= b.min) ?? PCS_BANDS[PCS_BANDS.length - 1]!;
}

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIERS = [
  { key: "NANO",   label: "Nano",   emoji: "🌱", range: "₦1K – ₦10K",   rate: "5% flat",  coins: 200,  days: 30 },
  { key: "MICRO",  label: "Micro",  emoji: "🌿", range: "₦10K – ₦50K",  rate: "4% flat",  coins: 1000, days: 90 },
  { key: "SMALL",  label: "Small",  emoji: "🌳", range: "₦50K – ₦200K", rate: "3.5%/mo",  coins: 3000, days: 180 },
  { key: "GROWTH", label: "Growth", emoji: "🏆", range: "₦200K – ₦1M",  rate: "2.5%/mo",  coins: 8000, days: 365 },
];

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:    "bg-[#dffbea] text-[#0f9f68]",
  COMPLETED: "bg-[#e0f2fe] text-[#0284c7]",
  DEFAULTED: "bg-[#ffe4e6] text-[#ef3b42]",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function LoanScreen({
  onBack,
  onApply,
  onViewLoan,
}: {
  onBack: () => void;
  onApply: (eligibility: EligibilityResult) => void;
  onViewLoan: (loan: Loan) => void;
}) {
  const [data, setData] = useState<EligibilityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) { setError("Session expired."); setLoading(false); return; }
    getLoanEligibility(token)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Unable to load loan info."))
      .finally(() => setLoading(false));
  }, []);

  const pcs = data?.pcs ?? 0;
  const band = bandFor(pcs);
  const pcsPercent = Math.round(((pcs - 100) / 800) * 100);

  // SVG ring gauge
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (circumference * Math.max(0, pcsPercent)) / 100;

  const eligibility = data?.eligibility;
  const currentTier = eligibility?.eligible ? TIERS.find((t) => t.key === eligibility.tier) : null;
  const currentTierIndex = currentTier ? TIERS.findIndex((t) => t.key === currentTier.key) : -1;
  const nextTier = currentTierIndex >= 0 && currentTierIndex < TIERS.length - 1
    ? TIERS[currentTierIndex + 1]
    : null;

  return (
    <div className="mx-4 pb-8 sm:mx-0">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button className="grid size-9 place-items-center" onClick={onBack}>
          <ArrowLeft className="size-7" />
        </button>
        <div>
          <h2 className="text-[31px] font-extrabold leading-none text-[#071122]">Business Loans</h2>
          <p className="mt-0.5 text-[16px] text-[#8b99b3]">Your credit profile</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="size-8 animate-spin rounded-full border-4 border-[#f1f5f9] border-t-[#1557df]" />
        </div>
      )}

      {error && (
        <p className="rounded-[14px] bg-[#fff0f0] px-4 py-3 text-[17px] font-semibold text-[#ef3b42]">{error}</p>
      )}

      {data && (
        <div className="space-y-5">

          {/* ── PCS Score hero card ── */}
          <div className={cn(
            "relative overflow-hidden rounded-[28px] bg-gradient-to-br px-7 py-8 text-white shadow-[0_14px_40px_rgba(0,0,0,0.18)]",
            band.bg,
          )}>
            {/* Decorative circles */}
            <div className="pointer-events-none absolute -right-8 -top-8 size-[160px] rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-10 -left-6 size-[120px] rounded-full bg-white/[0.07]" />

            <div className="relative flex items-center gap-6">
              {/* Ring gauge */}
              <div className="shrink-0">
                <svg width="130" height="130" viewBox="0 0 130 130">
                  {/* Track */}
                  <circle cx="65" cy="65" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="11" />
                  {/* Progress */}
                  <circle
                    cx="65" cy="65" r={radius}
                    fill="none"
                    stroke="white"
                    strokeWidth="11"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    transform="rotate(-90 65 65)"
                    style={{ transition: "stroke-dashoffset 1s ease" }}
                  />
                  <text x="65" y="60" textAnchor="middle" fill="white" fontSize="24" fontWeight="800">{pcs}</text>
                  <text x="65" y="78" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="11">{band.label}</text>
                </svg>
              </div>

              {/* Score details */}
              <div className="flex-1">
                <p className="text-[14px] font-semibold uppercase tracking-wide text-white/60">Credit Score</p>
                <p className="mt-1 text-[32px] font-extrabold leading-none">{pcs} <span className="text-[18px] font-semibold text-white/60">/ 900</span></p>
                <p className="mt-3 text-[14px] text-white/70">
                  {band.label === "Building"
                    ? "Keep recording transactions to grow your score"
                    : "Your score unlocks better loan terms"}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-[12px] bg-white/15 px-3 py-2">
                    <p className="text-[11px] text-white/60">Days Active</p>
                    <p className="text-[18px] font-extrabold">{data.daysActive}</p>
                  </div>
                  <div className="rounded-[12px] bg-white/15 px-3 py-2">
                    <p className="text-[11px] text-white/60">Coins Earned</p>
                    <p className="text-[18px] font-extrabold">{data.totalEarned}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Active loan ── */}
          {data.activeLoan && (
            <div>
              <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-[#94a3b8]">Active Loan</p>
              <ActiveLoanCard loan={data.activeLoan} onTap={() => onViewLoan(data.activeLoan!)} />
            </div>
          )}

          {/* ── Eligibility / Apply card ── */}
          {!data.activeLoan && eligibility?.eligible && currentTier && (
            <div className="relative overflow-hidden rounded-[24px] bg-white px-6 py-6 shadow-[0_10px_30px_rgba(15,23,42,0.09)]">
              {/* Green left accent */}
              <div className="absolute left-0 top-0 h-full w-1.5 rounded-l-[24px] bg-gradient-to-b from-[#22c55e] to-[#16a34a]" />

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-[#16a34a]" />
                    <p className="text-[14px] font-bold text-[#16a34a]">You qualify!</p>
                  </div>
                  <p className="text-[13px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                    {currentTier.emoji} {currentTier.label} Loan
                  </p>
                  <p className="mt-1 text-[34px] font-extrabold leading-none text-[#071122]">
                    {eligibility.maxAmount >= 1000
                      ? `₦${(eligibility.maxAmount / 1000).toFixed(0)}K`
                      : formatMoney(eligibility.maxAmount)}
                  </p>
                  <p className="mt-1 text-[15px] text-[#64748b]">
                    Up to {formatMoney(eligibility.maxAmount)} · {currentTier.rate}
                  </p>
                </div>
                <div className="grid size-[56px] shrink-0 place-items-center rounded-[18px] bg-[#f0fdf4]">
                  <Zap className="size-6 text-[#16a34a]" />
                </div>
              </div>

              {/* Progress to next tier */}
              {nextTier && (
                <div className="mt-5 rounded-[14px] bg-[#f8fafc] px-4 py-3">
                  <div className="mb-2 flex justify-between text-[13px]">
                    <span className="font-semibold text-[#334155]">Progress to {nextTier.emoji} {nextTier.label}</span>
                    <span className="text-[#94a3b8]">{data.totalEarned} / {nextTier.coins} coins</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#22c55e] to-[#16a34a] transition-all"
                      style={{ width: `${Math.min(100, (data.totalEarned / nextTier.coins) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => onApply(data)}
                className="mt-5 flex h-[58px] w-full items-center justify-center gap-2 rounded-[16px] bg-gradient-to-r from-[#1557df] to-[#1d4ed8] text-[19px] font-bold text-white shadow-[0_6px_16px_rgba(21,87,223,0.35)]"
              >
                Apply for {formatMoney(eligibility.maxAmount)}
                <ChevronRight className="size-5" />
              </button>
            </div>
          )}

          {/* ── Not eligible card ── */}
          {!data.activeLoan && eligibility && !eligibility.eligible && (
            <div className="rounded-[24px] bg-white px-6 py-6 shadow-[0_10px_30px_rgba(15,23,42,0.09)]">
              <p className="mb-1 text-[20px] font-extrabold text-[#071122]">Almost there!</p>
              <p className="mb-5 text-[16px] text-[#64748b]">{eligibility.reason}</p>
              <div className="space-y-4">
                <RequirementBar
                  label="Days active"
                  current={data.daysActive}
                  target={30}
                  unit="days"
                />
                <RequirementBar
                  label="Coins earned"
                  current={data.totalEarned}
                  target={200}
                  unit="coins"
                />
              </div>
            </div>
          )}

          {/* ── PCS Score Breakdown ── */}
          {data.pcsBreakdown && (
            <PCSBreakdownCard breakdown={data.pcsBreakdown} />
          )}

          {/* ── Loan Tiers grid ── */}
          <div>
            <p className="mb-3 text-[15px] font-bold uppercase tracking-wide text-[#94a3b8]">
              Credit Ladder
            </p>
            <div className="grid grid-cols-2 gap-3">
              {TIERS.map((tier, i) => {
                const unlocked =
                  eligibility?.eligible && TIERS.findIndex((t) => t.key === eligibility.tier) >= i;
                const isCurrent = eligibility?.eligible && eligibility.tier === tier.key;

                return (
                  <div
                    key={tier.key}
                    className={cn(
                      "relative overflow-hidden rounded-[20px] p-5 transition-all",
                      isCurrent
                        ? "bg-gradient-to-br from-[#1557df] to-[#1d4ed8] text-white shadow-[0_8px_24px_rgba(21,87,223,0.3)]"
                        : unlocked
                          ? "bg-white shadow-[0_4px_16px_rgba(15,23,42,0.08)]"
                          : "bg-[#f8fafc]",
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[22px]">{tier.emoji}</span>
                      {unlocked
                        ? <Unlock className={cn("size-4", isCurrent ? "text-white/70" : "text-[#16a34a]")} />
                        : <Lock className="size-4 text-[#cbd5e1]" />}
                    </div>
                    <p className={cn(
                      "text-[16px] font-extrabold",
                      isCurrent ? "text-white" : unlocked ? "text-[#071122]" : "text-[#94a3b8]",
                    )}>
                      {tier.label}
                    </p>
                    <p className={cn(
                      "text-[13px]",
                      isCurrent ? "text-white/70" : unlocked ? "text-[#64748b]" : "text-[#cbd5e1]",
                    )}>
                      {tier.range}
                    </p>
                    <p className={cn(
                      "mt-2 text-[13px] font-bold",
                      isCurrent ? "text-white/80" : unlocked ? "text-[#1557df]" : "text-[#94a3b8]",
                    )}>
                      {tier.rate}
                    </p>

                    {isCurrent && (
                      <div className="mt-3 rounded-[8px] bg-white/20 px-2 py-1 text-center text-[11px] font-bold text-white">
                        YOUR TIER
                      </div>
                    )}
                    {!unlocked && (
                      <p className="mt-2 text-[11px] text-[#cbd5e1]">
                        {tier.coins} coins · {tier.days}d active
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ─── Active loan card ─────────────────────────────────────────────────────────

function ActiveLoanCard({ loan, onTap }: { loan: Loan; onTap: () => void }) {
  const progress = loan.total > 0 ? Math.round((loan.amountRepaid / loan.total) * 100) : 0;
  const daysLeft = Math.max(0, Math.ceil((new Date(loan.dueDate).getTime() - Date.now()) / 86_400_000));
  const isOverdue = new Date(loan.dueDate) < new Date() && loan.status === "ACTIVE";
  const tierInfo = TIERS.find((t) => t.key === loan.loanType);

  return (
    <button
      type="button"
      onClick={onTap}
      className={cn(
        "w-full overflow-hidden rounded-[22px] p-6 text-left shadow-[0_10px_30px_rgba(0,0,0,0.12)] active:scale-[0.98] transition-transform",
        isOverdue
          ? "bg-gradient-to-br from-[#ef3b42] to-[#b91c1c] text-white"
          : "bg-gradient-to-br from-[#1557df] to-[#1d4ed8] text-white",
      )}
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-[13px] font-semibold text-white/60">
            {tierInfo?.emoji} {tierInfo?.label} Loan
          </p>
          <p className="text-[32px] font-extrabold leading-none">{formatMoney(loan.total)}</p>
        </div>
        <div className="text-right">
          <p className="text-[13px] text-white/60">
            {isOverdue ? "⚠️ Overdue" : `${daysLeft}d left`}
          </p>
          <ChevronRight className="ml-auto mt-1 size-5 text-white/60" />
        </div>
      </div>

      <div className="mb-2 h-2.5 overflow-hidden rounded-full bg-white/20">
        <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex justify-between text-[14px] text-white/70">
        <span>Repaid {formatMoney(loan.amountRepaid)}</span>
        <span>{progress}% done</span>
      </div>
    </button>
  );
}

// ─── PCS Breakdown card ───────────────────────────────────────────────────────

function PCSBreakdownCard({ breakdown }: { breakdown: EligibilityResult["pcsBreakdown"] }) {
  const [expanded, setExpanded] = useState(false);
  const entries = Object.values(breakdown) as Array<{ score: number; max: number; label: string; detail: string }>;

  return (
    <div className="rounded-[24px] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.09)]">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between px-6 py-5"
      >
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-[12px] bg-[#eef4ff] text-[#1557df]">
            <TrendingUp className="size-5" />
          </div>
          <p className="text-[18px] font-extrabold text-[#071122]">Score Breakdown</p>
        </div>
        <ChevronRight
          className={cn("size-5 text-[#94a3b8] transition-transform", expanded && "rotate-90")}
        />
      </button>

      {expanded && (
        <div className="border-t border-[#f0f4f9] px-6 pb-6 pt-4 space-y-4">
          {entries.map((c) => (
            <div key={c.label}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[15px] font-semibold text-[#334155]">{c.label}</span>
                <span className="text-[14px] font-bold text-[#071122]">
                  {c.score}
                  <span className="font-normal text-[#94a3b8]"> / {c.max}</span>
                </span>
              </div>
              <div className="mb-1 h-2 overflow-hidden rounded-full bg-[#f1f5f9]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#1557df] to-[#2563eb] transition-all"
                  style={{ width: `${Math.round((c.score / c.max) * 100)}%` }}
                />
              </div>
              <p className="text-[13px] text-[#94a3b8]">{c.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Requirement progress bar ─────────────────────────────────────────────────

function RequirementBar({
  label, current, target, unit,
}: { label: string; current: number; target: number; unit: string }) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  const done = current >= target;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {done
            ? <CheckCircle2 className="size-4 text-[#16a34a]" />
            : <div className="size-4 rounded-full border-2 border-[#e2e8f0]" />}
          <span className="text-[15px] font-semibold text-[#334155]">{label}</span>
        </div>
        <span className="text-[14px] text-[#64748b]">
          {current} / {target} {unit}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#f1f5f9]">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            done ? "bg-gradient-to-r from-[#22c55e] to-[#16a34a]" : "bg-gradient-to-r from-[#d97706] to-[#b45309]",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN", maximumFractionDigits: 0,
  }).format(value);
}

// Type needed by parent
export type { EligibilityResult, Loan };
