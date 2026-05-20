"use client";

import { ArrowLeft, Landmark } from "lucide-react";
import { useMemo, useState } from "react";

import { ApiError } from "@/lib/api";
import { applyForLoan, type EligibilityResult, type Loan, type LoanPaymentMethod } from "@/lib/loanApi";
import { getStoredAccessToken } from "@/lib/session";
import { cn } from "@/lib/utils";

const TENURE_OPTIONS: Record<string, number[]> = {
  NANO:  [7, 10, 14],
  MICRO: [30, 60, 90],
};

const INTEREST_RATES: Record<string, number> = {
  NANO:  0.05,
  MICRO: 0.04,
};

type PaymentMethodLabel = "Cash" | "Transfer" | "Card";
const methodMap: Record<PaymentMethodLabel, LoanPaymentMethod> = {
  Cash: "CASH", Transfer: "TRANSFER", Card: "CARD",
};

export function LoanApplicationScreen({
  eligibility,
  onBack,
  onApplied,
}: {
  eligibility: EligibilityResult;
  onBack: () => void;
  onApplied: (loan: Loan) => void;
}) {
  const el = eligibility.eligibility;

  // Derive values unconditionally so hooks are always called (Rules of Hooks).
  // This screen is only mounted when eligible === true (guaranteed by routing).
  const tier = el.eligible ? el.tier : "NANO";
  const minAmount = el.eligible ? el.minAmount : 1000;
  const maxAmount = el.eligible ? el.maxAmount : 10000;
  const tenureOptions = TENURE_OPTIONS[tier] ?? [7];
  const rate = INTEREST_RATES[tier] ?? 0.05;
  const tierLabel = tier === "NANO" ? "Nano Loan" : "Micro Loan";

  const [amount, setAmount] = useState(String(minAmount));
  const [tenure, setTenure] = useState(tenureOptions[0]!);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodLabel>("Cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!el.eligible) return null;

  const amountNum = Number(amount) || 0;
  const interest = Math.round(amountNum * rate * 100) / 100;
  const total = amountNum + interest;
  const dueDate = new Date(Date.now() + tenure * 86_400_000);

  const amountValid = amountNum >= minAmount && amountNum <= maxAmount;

  async function handleApply() {
    if (!amountValid) { setError(`Amount must be between ${formatMoney(minAmount)} and ${formatMoney(maxAmount)}`); return; }
    const token = getStoredAccessToken();
    if (!token) { setError("Session expired."); return; }
    setSaving(true); setError(null);
    try {
      const res = await applyForLoan(token, { amount: amountNum, tenureDays: tenure });
      onApplied(res.loan);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to apply. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button className="grid size-10 place-items-center rounded-full bg-white shadow-[0_1px_6px_rgba(15,23,42,0.1)]" onClick={onBack}>
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h2 className="text-[20px] font-extrabold text-[#071122]">Apply for Loan</h2>
          <p className="text-[13px] text-[#94a3b8]">{tierLabel}</p>
        </div>
      </div>

      {/* Amount */}
      <div className="rounded-[20px] bg-white px-4 py-4 shadow-[0_2px_12px_rgba(15,23,42,0.07)]">
        <label className="mb-2 block text-[15px] font-bold text-[#071122]">Loan Amount (₦)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={cn(
            "h-14 w-full rounded-[12px] border px-4 text-[20px] font-bold outline-none",
            amountValid ? "border-[#1557df] text-[#071122]" : "border-[#ef3b42] text-[#ef3b42]",
          )}
        />
        <p className="mt-1.5 text-[12px] text-[#94a3b8]">
          Min: {formatMoney(minAmount)} · Max: {formatMoney(maxAmount)}
        </p>
      </div>

      {/* Tenure */}
      <div className="rounded-[20px] bg-white px-4 py-4 shadow-[0_2px_12px_rgba(15,23,42,0.07)]">
        <p className="mb-3 text-[15px] font-bold text-[#071122]">Repayment Period</p>
        <div className="flex gap-2">
          {tenureOptions.map((t) => (
            <button key={t} type="button" onClick={() => setTenure(t)}
              className={cn("flex-1 rounded-[12px] py-2.5 text-[14px] font-bold transition-colors",
                tenure === t ? "bg-[#1557df] text-white shadow-[0_4px_12px_rgba(21,87,223,0.3)]" : "bg-[#f1f5f9] text-[#334155]")}>
              {t} days
            </button>
          ))}
        </div>
      </div>

      {/* Breakdown */}
      <div className="rounded-[20px] bg-white px-4 py-4 shadow-[0_2px_12px_rgba(15,23,42,0.07)]">
        <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-[#94a3b8]">Repayment Summary</p>
        <Row label="Principal" value={formatMoney(amountNum)} />
        <Row label={`Interest (${(rate * 100).toFixed(0)}% flat)`} value={formatMoney(interest)} />
        <Row label="Total to repay" value={formatMoney(total)} bold />
        <Row label="Due by" value={formatDate(dueDate)} />
      </div>

      {/* Payment method */}
      <div className="rounded-[20px] bg-white px-4 py-4 shadow-[0_2px_12px_rgba(15,23,42,0.07)]">
        <p className="mb-3 text-[15px] font-bold text-[#071122]">Payment Method</p>
        <div className="flex gap-2">
          {(["Cash", "Transfer", "Card"] as PaymentMethodLabel[]).map((m) => (
            <button key={m} type="button" onClick={() => setPaymentMethod(m)}
              className={cn("flex-1 rounded-[12px] py-2.5 text-[14px] font-bold transition-colors",
                paymentMethod === m ? "bg-[#1557df] text-white" : "bg-[#f1f5f9] text-[#334155]")}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-[12px] bg-[#fff0f0] px-4 py-3 text-[13px] font-semibold text-[#ef3b42]">{error}</p>}

      <button type="button" onClick={handleApply} disabled={saving || !amountValid}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-[16px] bg-gradient-to-r from-[#1557df] to-[#0d40b8] text-[16px] font-bold text-white shadow-[0_6px_16px_rgba(21,87,223,0.35)] disabled:opacity-60">
        <Landmark className="size-5" />
        {saving ? "Applying…" : `Get ${formatMoney(total)}`}
      </button>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-[#f0f4f9] py-3 last:border-0">
      <span className="text-[17px] text-[#64748b]">{label}</span>
      <span className={cn("text-[17px]", bold ? "font-extrabold text-[#071122]" : "font-semibold text-[#071122]")}>
        {value}
      </span>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN", maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" }).format(date);
}
