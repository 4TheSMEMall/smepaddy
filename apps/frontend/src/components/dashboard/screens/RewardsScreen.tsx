"use client";

import { ArrowLeft, CheckCircle2, Clock, Gift, Lock } from "lucide-react";
import { useEffect, useState } from "react";

import { PaddyCoinIcon } from "@/components/PaddyCoinIcon";
import { ApiError } from "@/lib/api";
import {
  getRedemptions,
  redeemTier,
  type RedemptionHistory,
  type RedemptionOverview,
  type RedemptionTier,
} from "@/lib/redemptionApi";
import { getStoredAccessToken } from "@/lib/session";
import { cn } from "@/lib/utils";

export function RewardsScreen({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<RedemptionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<RedemptionTier | null>(null);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) { setError("Session expired."); setLoading(false); return; }
    getRedemptions(token)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Unable to load rewards."))
      .finally(() => setLoading(false));
  }, []);

  async function handleRedeem(tier: RedemptionTier) {
    const token = getStoredAccessToken();
    if (!token) return;
    setRedeeming(tier.id);
    setError(null);
    try {
      const res = await redeemTier(token, tier.id);
      setSuccess(res.redemption.message);
      setConfirming(null);
      // Refresh data
      const updated = await getRedemptions(token);
      setData(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Redemption failed.");
    } finally {
      setRedeeming(null);
    }
  }

  return (
    <div className="mx-4 pb-10 sm:mx-0">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button className="grid size-9 place-items-center" onClick={onBack}>
          <ArrowLeft className="size-7" />
        </button>
        <div>
          <h2 className="text-[31px] font-extrabold leading-none text-[#071122]">Rewards</h2>
          <p className="mt-0.5 text-[16px] text-[#8b99b3]">Redeem your Paddy Coins</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="size-8 animate-spin rounded-full border-4 border-[#f1f5f9] border-t-[#d97706]" />
        </div>
      )}
      {error && <p className="mb-4 rounded-[14px] bg-[#fff0f0] px-4 py-3 text-[17px] font-semibold text-[#ef3b42]">{error}</p>}
      {success && (
        <div className="mb-4 flex items-start gap-3 rounded-[16px] bg-[#dffbea] px-5 py-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#059669]" />
          <p className="text-[16px] font-semibold text-[#065f46]">{success}</p>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-5">

          {/* Coin balance hero */}
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#d97706] to-[#b45309] px-7 py-8 text-white shadow-[0_14px_36px_rgba(217,119,6,0.3)]">
            <div className="pointer-events-none absolute -right-8 -top-8 size-[160px] rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-10 -left-6 size-[120px] rounded-full bg-white/[0.07]" />
            <div className="relative">
              <p className="mb-1 text-[14px] font-semibold uppercase tracking-wide text-white/60">
                Available Balance
              </p>
              <div className="flex items-end gap-3">
                <PaddyCoinIcon className="mb-1 size-9" />
                <p className="text-[56px] font-extrabold leading-none">{data.balance}</p>
                <p className="mb-2 text-[20px] text-white/60">coins</p>
              </div>
              <p className="mt-3 text-[15px] text-white/70">
                1 coin = ₦1 · Redeem for airtime, cash & more
              </p>
            </div>
          </div>

          {/* Confirm modal */}
          {confirming && (
            <div className="rounded-[24px] bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.12)]">
              <p className="mb-1 text-[20px] font-extrabold text-[#071122]">
                Confirm {confirming.emoji} {confirming.label} Redemption
              </p>
              <p className="mb-5 text-[16px] text-[#64748b]">
                Spend <strong>{confirming.coinsRequired} coins</strong> for {confirming.description}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="flex-1 rounded-[14px] bg-[#f1f5f9] py-4 text-[17px] font-bold text-[#334155]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleRedeem(confirming)}
                  disabled={redeeming === confirming.id}
                  className="flex-1 rounded-[14px] bg-[#d97706] py-4 text-[17px] font-bold text-white disabled:opacity-60"
                >
                  {redeeming === confirming.id ? "Processing…" : "Confirm"}
                </button>
              </div>
            </div>
          )}

          {/* Tiers */}
          {!confirming && (
            <>
              <p className="text-[15px] font-bold uppercase tracking-wide text-[#94a3b8]">
                Redemption Tiers
              </p>
              <div className="space-y-3">
                {data.tiers.map((tier) => (
                  <TierCard
                    key={tier.id}
                    tier={tier}
                    onRedeem={() => setConfirming(tier)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Redemption history */}
          {data.history.length > 0 && (
            <div className="rounded-[24px] bg-white p-6 shadow-[0_10px_26px_rgba(15,23,42,0.07)]">
              <p className="mb-4 text-[16px] font-bold uppercase tracking-wide text-[#94a3b8]">
                History
              </p>
              <div className="space-y-4">
                {data.history.map((h) => (
                  <HistoryRow key={h.id} item={h} />
                ))}
              </div>
            </div>
          )}

          {/* How it works */}
          <div className="rounded-[24px] bg-[#fffdf3] p-6">
            <div className="mb-3 flex items-center gap-2">
              <Gift className="size-5 text-[#d97706]" />
              <p className="text-[16px] font-bold text-[#071122]">How it works</p>
            </div>
            <ul className="space-y-2 text-[15px] text-[#64748b]">
              <li>• Earn coins by recording sales, expenses, and invoices</li>
              <li>• Reach a tier threshold and tap Redeem</li>
              <li>• We process your reward within 24 hours</li>
              <li>• Airtime credited to your registered number</li>
              <li>• Cash sent to your linked bank account</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tier Card ────────────────────────────────────────────────────────────────

function TierCard({ tier, onRedeem }: { tier: RedemptionTier; onRedeem: () => void }) {
  const progress = Math.min(100, Math.round((Math.min(tier.coinsRequired, tier.coinsRequired) / tier.coinsRequired) * 100));

  return (
    <div className={cn(
      "rounded-[20px] p-5",
      tier.unlocked
        ? "bg-white shadow-[0_4px_20px_rgba(15,23,42,0.08)]"
        : "bg-[#f8fafc]",
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-[28px]">{tier.emoji}</span>
          <div>
            <p className={cn("text-[18px] font-extrabold", tier.unlocked ? "text-[#071122]" : "text-[#94a3b8]")}>
              {tier.label}
            </p>
            <p className={cn("text-[14px]", tier.unlocked ? "text-[#64748b]" : "text-[#cbd5e1]")}>
              {tier.description}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-center gap-1 justify-end">
            <PaddyCoinIcon className="size-4 text-[#d97706]" />
            <span className={cn("text-[15px] font-bold", tier.unlocked ? "text-[#d97706]" : "text-[#94a3b8]")}>
              {tier.coinsRequired}
            </span>
          </div>
          <p className="text-[12px] text-[#94a3b8]">{tier.shortDesc}</p>
        </div>
      </div>

      {tier.unlocked ? (
        <button
          type="button"
          onClick={onRedeem}
          className="mt-4 h-[48px] w-full rounded-[14px] bg-gradient-to-r from-[#d97706] to-[#b45309] text-[16px] font-bold text-white shadow-[0_4px_12px_rgba(217,119,6,0.3)]"
        >
          Redeem {tier.emoji}
        </button>
      ) : (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-[13px] text-[#94a3b8]">
            <Lock className="size-3.5" />
            <span>Need {tier.coinsRequired} coins to unlock</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#e2e8f0]">
            <div
              className="h-full rounded-full bg-[#d97706] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── History Row ──────────────────────────────────────────────────────────────

function HistoryRow({ item }: { item: RedemptionHistory }) {
  const statusIcon = item.status === "FULFILLED"
    ? <CheckCircle2 className="size-5 text-[#059669]" />
    : <Clock className="size-5 text-[#d97706]" />;

  return (
    <div className="flex items-center gap-3">
      {statusIcon}
      <div className="flex-1">
        <p className="text-[15px] font-bold text-[#071122]">{item.tier} Redemption</p>
        <p className="text-[13px] text-[#94a3b8]">
          {item.coinsSpent} coins · {item.status} · {new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(item.createdAt))}
        </p>
      </div>
      <p className="text-[15px] font-bold text-[#d97706]">₦{item.rewardValue / 100}</p>
    </div>
  );
}
