"use client";

import { ArrowLeft, CheckCircle2, Clock, Coins } from "lucide-react";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api";
import { getWallet } from "@/lib/coinApi";
import {
  getLoan,
  repayLoan,
  type Loan,
  type LoanPaymentMethod,
  type LoanRepayment,
} from "@/lib/loanApi";
import { getStoredAccessToken } from "@/lib/session";
import { cn } from "@/lib/utils";

type PaymentMethodLabel = "Cash" | "Transfer" | "Card";
const methodMap: Record<PaymentMethodLabel, LoanPaymentMethod> = {
  Cash: "CASH", Transfer: "TRANSFER", Card: "CARD",
};

export function LoanDetailScreen({
  loanId,
  onBack,
  onRepaid,
}: {
  loanId: string;
  onBack: () => void;
  onRepaid: () => void;
}) {
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRepayForm, setShowRepayForm] = useState(false);
  const [repayAmount, setRepayAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodLabel>("Cash");
  const [useCoins, setUseCoins] = useState(false);
  const [coinBalance, setCoinBalance] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) return;
    Promise.all([
      getLoan(token, loanId),
      getWallet(token),
    ]).then(([loanRes, walletRes]) => {
      setLoan(loanRes.loan);
      setCoinBalance(walletRes.wallet.balance);
    }).finally(() => setLoading(false));
  }, [loanId]);

  async function handleRepay() {
    const amount = Number(repayAmount);
    if (!amount || amount <= 0) { setError("Enter a valid amount."); return; }
    const token = getStoredAccessToken();
    if (!token) return;

    // Calculate coin discount: max coins = min(coinBalance, interest in coins)
    const maxCoinsForLoan = loan ? Math.floor(loan.interest) : 0;
    const coinsToUse = useCoins ? Math.min(coinBalance, maxCoinsForLoan) : 0;

    setSaving(true); setError(null);
    try {
      const res = await repayLoan(token, loanId, {
        amount,
        paymentMethod: methodMap[paymentMethod],
        coinsToUse,
      });
      setLoan(res.loan);
      if (coinsToUse > 0) setCoinBalance((b) => b - coinsToUse);
      setRepayAmount("");
      setShowRepayForm(false);
      setUseCoins(false);
      if (res.loan.status === "COMPLETED") onRepaid();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Repayment failed.");
    } finally {
      setSaving(false);
    }
  }

  const progress = loan ? Math.round((loan.amountRepaid / loan.total) * 100) : 0;
  const isOverdue = loan ? new Date(loan.dueDate) < new Date() && loan.status === "ACTIVE" : false;
  const daysLeft = loan
    ? Math.max(0, Math.ceil((new Date(loan.dueDate).getTime() - Date.now()) / 86_400_000))
    : 0;

  const tierLabel = loan?.loanType === "NANO" ? "Nano Loan" : "Micro Loan";

  return (
    <div className="mx-4 space-y-5 pb-8 sm:mx-0">
      <div className="flex items-center gap-4">
        <button className="grid size-9 place-items-center" onClick={onBack}>
          <ArrowLeft className="size-7" />
        </button>
        <h2 className="text-[28px] font-extrabold text-[#071122]">Loan Details</h2>
      </div>

      {loading && <p className="py-10 text-center text-[18px] text-[#94a3b8]">Loading…</p>}

      {loan && (
        <>
          {/* Hero */}
          <div
            className={cn(
              "rounded-[28px] px-7 py-8 text-white shadow-xl",
              loan.status === "COMPLETED"
                ? "bg-gradient-to-br from-[#059669] to-[#047857]"
                : isOverdue
                  ? "bg-gradient-to-br from-[#ef3b42] to-[#b91c1c]"
                  : "bg-gradient-to-br from-[#1557df] to-[#1e3a5f]",
            )}
          >
            <p className="mb-1 text-[15px] font-semibold text-white/60">{tierLabel}</p>
            <p className="text-[52px] font-extrabold leading-none">{formatMoney(loan.total)}</p>
            <p className="mt-2 text-[18px] text-white/70">
              {loan.status === "COMPLETED"
                ? "Fully repaid ✓"
                : isOverdue
                  ? "Overdue — please repay now"
                  : `${daysLeft} days remaining`}
            </p>

            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[14px] text-white/60">
              <span>Repaid: {formatMoney(loan.amountRepaid)}</span>
              <span>Balance: {formatMoney(loan.balance)}</span>
            </div>
          </div>

          {/* Details */}
          <div className="rounded-[24px] bg-white px-6 py-2 shadow-[0_10px_26px_rgba(15,23,42,0.07)]">
            <DetailRow label="Principal" value={formatMoney(loan.principal)} />
            <DetailRow label="Interest" value={formatMoney(loan.interest)} />
            <DetailRow label="Total" value={formatMoney(loan.total)} bold />
            <DetailRow label="Due Date" value={formatDate(new Date(loan.dueDate))} />
            <DetailRow label="Applied" value={formatDate(new Date(loan.createdAt))} last />
          </div>

          {/* Repay button */}
          {loan.status === "ACTIVE" && !showRepayForm && (
            <button
              type="button"
              onClick={() => { setRepayAmount(String(loan.balance)); setShowRepayForm(true); }}
              className="h-[64px] w-full rounded-[18px] bg-[#1557df] text-[20px] font-bold text-white shadow-[0_4px_14px_rgba(21,87,223,0.3)]"
            >
              Make a Repayment
            </button>
          )}

          {/* Repay form */}
          {showRepayForm && (
            <div className="rounded-[24px] bg-white px-6 py-6 shadow-[0_10px_26px_rgba(15,23,42,0.07)]">
              <p className="mb-4 text-[20px] font-extrabold text-[#071122]">Make a Repayment</p>
              <label className="mb-2 block text-[18px] font-semibold">Amount (₦)</label>
              <input
                type="number"
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
                className="mb-4 h-[60px] w-full rounded-[14px] border border-[#1557df] px-5 text-[22px] font-bold outline-none"
              />
              {/* Coin-assisted repayment toggle */}
              {coinBalance > 0 && loan && (
                <div className={cn(
                  "mb-5 rounded-[16px] px-4 py-3",
                  useCoins ? "bg-[#fdf6e3] border border-[#fde68a]" : "bg-[#f8fafc]",
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coins className="size-5 text-[#d97706]" />
                      <div>
                        <p className="text-[15px] font-bold text-[#334155]">Use Paddy Coins</p>
                        <p className="text-[13px] text-[#94a3b8]">
                          {Math.min(coinBalance, Math.floor(loan.interest))} coins = ₦{Math.min(coinBalance, Math.floor(loan.interest))} off interest
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUseCoins((v) => !v)}
                      className={cn(
                        "relative h-7 w-[52px] shrink-0 overflow-hidden rounded-full transition-colors duration-200",
                        useCoins ? "bg-[#d97706]" : "bg-[#cbd5e1]",
                      )}
                    >
                      <span className={cn(
                        "absolute top-[2px] left-[2px] size-[23px] rounded-full bg-white transition-transform duration-200",
                        useCoins ? "translate-x-[25px]" : "translate-x-0",
                      )} />
                    </button>
                  </div>
                  {useCoins && (
                    <p className="mt-2 text-[14px] font-semibold text-[#d97706]">
                      ✓ {Math.min(coinBalance, Math.floor(loan.interest))} coins will cover ₦{Math.min(coinBalance, Math.floor(loan.interest))} of your interest
                    </p>
                  )}
                </div>
              )}

              <p className="mb-4 text-[15px] font-semibold">Payment Method</p>
              <div className="mb-5 flex gap-3">
                {(["Cash", "Transfer", "Card"] as PaymentMethodLabel[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={cn(
                      "flex-1 rounded-[12px] py-3 text-[17px] font-bold",
                      paymentMethod === m ? "bg-[#1557df] text-white" : "bg-[#f1f5f9] text-[#334155]",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {error && <p className="mb-3 text-[15px] font-semibold text-[#ef3b42]">{error}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRepayForm(false)}
                  className="flex-1 rounded-[14px] bg-[#f1f5f9] py-3 text-[17px] font-bold text-[#334155]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRepay}
                  disabled={saving}
                  className="flex-1 rounded-[14px] bg-[#1557df] py-3 text-[17px] font-bold text-white disabled:opacity-60"
                >
                  {saving ? "Paying…" : "Confirm"}
                </button>
              </div>
            </div>
          )}

          {/* Repayment history */}
          {loan.repayments && loan.repayments.length > 0 && (
            <div className="rounded-[24px] bg-white px-6 py-6 shadow-[0_10px_26px_rgba(15,23,42,0.07)]">
              <p className="mb-4 text-[16px] font-bold uppercase tracking-wide text-[#94a3b8]">
                Payment History
              </p>
              <div className="space-y-3">
                {loan.repayments.map((r) => (
                  <RepaymentRow key={r.id} repayment={r} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RepaymentRow({ repayment }: { repayment: LoanRepayment }) {
  return (
    <div className="flex items-center gap-3">
      {repayment.paidOnTime ? (
        <CheckCircle2 className="size-5 shrink-0 text-[#059669]" />
      ) : (
        <Clock className="size-5 shrink-0 text-[#d97706]" />
      )}
      <div className="flex-1">
        <p className="text-[17px] font-bold text-[#071122]">{formatMoney(repayment.amount)}</p>
        <p className="text-[14px] text-[#94a3b8]">
          {formatDate(new Date(repayment.createdAt))} · {repayment.paymentMethod}
          {repayment.paidOnTime ? " · On time" : " · Late"}
        </p>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  bold,
  last,
}: {
  label: string;
  value: string;
  bold?: boolean;
  last?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between py-4", !last && "border-b border-[#f0f4f9]")}>
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
