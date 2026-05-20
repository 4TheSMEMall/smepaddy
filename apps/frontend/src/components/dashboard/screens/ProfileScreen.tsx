"use client";

import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  Copy,
  MapPin,
  Phone,
  Mail,
  Pencil,
  Share2,
  Sprout,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";

import { PaddyCoinIcon } from "@/components/PaddyCoinIcon";
import { Button } from "@/components/ui/button";
import { updateBusiness, type CurrentAccountResponse } from "@/lib/accountApi";
import { ApiError } from "@/lib/api";
import type { WalletInfo } from "@/lib/coinApi";
import { getStoredAccessToken } from "@/lib/session";

const BUSINESS_TYPES = [
  "Fashion & Clothing",
  "Electronics & Gadgets",
  "Food & Beverages",
  "Health & Beauty",
  "Agriculture & Farming",
  "Auto Parts & Accessories",
  "Building & Construction",
  "Education & Training",
  "General Merchandise",
  "Logistics & Transport",
  "Manufacturing",
  "Professional Services",
  "Retail & Wholesale",
  "Telecommunications",
  "Other",
];

export function ProfileScreen({
  onBack,
  wallet,
  account,
  onAccountUpdated,
}: {
  onBack: () => void;
  wallet?: WalletInfo | null;
  account?: CurrentAccountResponse | null;
  onAccountUpdated?: (updated: CurrentAccountResponse) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(account?.business?.businessName ?? "");
  const [editType, setEditType] = useState(account?.business?.businessType ?? "");
  const [editLocation, setEditLocation] = useState(account?.business?.location ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function startEdit() {
    setEditName(account?.business?.businessName ?? "");
    setEditType(account?.business?.businessType ?? "");
    setEditLocation(account?.business?.location ?? "");
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    if (!editName.trim()) { setError("Business name is required."); return; }
    if (!editType.trim()) { setError("Business type is required."); return; }
    const token = getStoredAccessToken();
    if (!token) return;
    setSaving(true); setError(null);
    try {
      const res = await updateBusiness(token, {
        businessName: editName.trim(),
        businessType: editType.trim(),
        location: editLocation.trim() || undefined,
      });
      // Update parent state so TopBar + receipts refresh immediately
      if (onAccountUpdated && account) {
        onAccountUpdated({
          ...account,
          business: account.business ? { ...account.business, ...res.business } : res.business,
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const levelColors = ["#64748b", "#1557df", "#059669", "#d97706", "#7c3aed"];
  const levelColor = levelColors[Math.min((wallet?.level ?? 1) - 1, 4)] ?? "#64748b";

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button className="grid size-10 place-items-center rounded-full bg-white shadow-[0_1px_6px_rgba(15,23,42,0.1)]" onClick={onBack}>
          <ArrowLeft className="size-5" />
        </button>
        <h2 className="text-[20px] font-extrabold text-[#071122]">My Profile</h2>
        <button
          onClick={startEdit}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-[#f1f5f9] px-3 text-[13px] font-semibold text-[#334155] active:bg-[#e2e8f0]"
        >
          <Pencil className="size-3.5" /> Edit
        </button>
      </div>

      {/* Hero profile card */}
      <div className="overflow-hidden rounded-[22px] bg-gradient-to-br from-[#1557df] to-[#0d40b8] px-5 py-6 text-white shadow-[0_8px_24px_rgba(21,87,223,0.3)]">
        <div className="flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-full bg-white/20">
            <UserRound className="size-8" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[20px] font-extrabold leading-tight">{account?.user?.fullName ?? "—"}</h3>
            {account?.user?.phone && (
              <p className="mt-1 flex items-center gap-1.5 text-[13px] text-white/70">
                <Phone className="size-3.5" />{account.user.phone}
              </p>
            )}
            {account?.user?.email && (
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-white/70">
                <Mail className="size-3.5 shrink-0" />{account.user.email}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Edit form ── */}
      {editing && (
        <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_4px_20px_rgba(15,23,42,0.1)]">
          {/* Form header */}
          <div className="flex items-center justify-between border-b border-[#f1f5f9] px-4 py-3">
            <p className="text-[15px] font-extrabold text-[#071122]">Edit Business Info</p>
            <button onClick={() => setEditing(false)} className="grid size-7 place-items-center rounded-full bg-[#f1f5f9] text-[#94a3b8]">
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-3 p-4">
            {/* Business name */}
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-[#334155]">Business Name *</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Mikama Services"
                className="h-12 w-full rounded-[12px] border border-[#d3dbe6] px-4 text-[15px] outline-none focus:border-[#1557df] focus:ring-2 focus:ring-[#d7e4ff]"
              />
            </div>

            {/* Business type */}
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-[#334155]">Business Type *</label>
              <div className="relative">
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="h-12 w-full appearance-none rounded-[12px] border border-[#d3dbe6] bg-white px-4 text-[15px] outline-none focus:border-[#1557df] focus:ring-2 focus:ring-[#d7e4ff]"
                >
                  <option value="">Select type…</option>
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8]">▾</div>
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-[#334155]">Location (optional)</label>
              <input
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder="e.g. Satellite Town, Lagos"
                className="h-12 w-full rounded-[12px] border border-[#d3dbe6] px-4 text-[15px] outline-none focus:border-[#1557df] focus:ring-2 focus:ring-[#d7e4ff]"
              />
            </div>

            {error && (
              <p className="rounded-[10px] bg-[#fff0f0] px-3 py-2.5 text-[13px] font-semibold text-[#ef3b42]">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 rounded-[12px] bg-[#f1f5f9] py-3 text-[14px] font-bold text-[#334155]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-[12px] bg-[#1557df] py-3 text-[14px] font-bold text-white shadow-[0_4px_12px_rgba(21,87,223,0.3)] disabled:opacity-60"
              >
                {saving ? "Saving…" : saved ? <><Check className="size-4" /> Saved!</> : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Business info (read mode) */}
      {!editing && (
        <div className="rounded-[20px] bg-white px-4 py-4 shadow-[0_2px_12px_rgba(15,23,42,0.07)]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-[10px] bg-[#eff4ff]">
                <Building2 className="size-4 text-[#1557df]" />
              </div>
              <p className="text-[14px] font-bold text-[#071122]">Business Info</p>
            </div>
            <button onClick={startEdit} className="text-[12px] font-semibold text-[#1557df]">
              Edit
            </button>
          </div>
          <div className="space-y-3">
            <InfoRow label="Business Name" value={account?.business?.businessName ?? "—"} />
            <InfoRow label="Type" value={account?.business?.businessType ?? "—"} />
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-[13px] text-[#64748b]">
                <MapPin className="size-3.5" />Location
              </span>
              <span className="text-right text-[13px] font-semibold text-[#071122]">
                {account?.business?.location ?? <span className="text-[#94a3b8]">Not set</span>}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-[13px] text-[#64748b]">
                <CalendarDays className="size-3.5" />Member since
              </span>
              <span className="text-right text-[13px] font-semibold text-[#071122]">
                {account?.business?.createdAt
                  ? new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(account.business.createdAt))
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Paddy Coins */}
      <div className="overflow-hidden rounded-[20px] bg-gradient-to-br from-[#fffbeb] to-[#fef3c7] px-4 py-4 shadow-[0_2px_12px_rgba(217,119,6,0.12)]">
        <div className="mb-3 flex items-center gap-2">
          <PaddyCoinIcon className="size-5 text-[#d97706]" />
          <p className="text-[14px] font-bold text-[#92400e]">Paddy Coins</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-[14px] bg-white/70 px-2 py-3">
            <p className="text-[18px] font-extrabold text-[#d97706]">{(wallet?.balance ?? 0).toLocaleString()}</p>
            <p className="text-[11px] font-semibold text-[#94a3b8]">Balance</p>
          </div>
          <div className="rounded-[14px] bg-white/70 px-2 py-3">
            <p className="text-[16px] font-extrabold flex items-center justify-center gap-1" style={{ color: levelColor }}>
              <Sprout className="size-4 text-[#8cc84b]" />{wallet?.levelTitle ?? "Starter"}
            </p>
            <p className="text-[11px] font-semibold text-[#94a3b8]">Level {wallet?.level ?? 1}</p>
          </div>
          <div className="rounded-[14px] bg-white/70 px-2 py-3">
            <p className="text-[18px] font-extrabold text-[#071122]">{wallet?.streak ?? 0}🔥</p>
            <p className="text-[11px] font-semibold text-[#94a3b8]">Day Streak</p>
          </div>
        </div>
        {wallet?.nextLevelAt && (
          <div className="mt-3">
            <div className="mb-1.5 flex justify-between text-[12px]">
              <span className="text-[#92400e]">Next: {nextLevelTitle(wallet.level)}</span>
              <span className="font-semibold text-[#d97706]">{wallet.totalEarned} / {wallet.nextLevelAt}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#fde68a]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#f59e0b] to-[#d97706] transition-all"
                style={{ width: `${Math.min(100, Math.round((wallet.totalEarned / wallet.nextLevelAt) * 100))}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Refer a friend */}
      <div className="rounded-[20px] bg-white px-4 py-4 shadow-[0_2px_12px_rgba(15,23,42,0.07)]">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-[10px] bg-[#f0fdf4]">
            <Share2 className="size-4 text-[#059669]" />
          </div>
          <p className="text-[14px] font-bold text-[#071122]">Refer a Friend</p>
          <span className="ml-auto flex items-center gap-1 rounded-full bg-[#fef3c7] px-2 py-0.5 text-[12px] font-bold text-[#d97706]">
            <PaddyCoinIcon className="size-3" /> +50
          </span>
        </div>
        <p className="mb-3 text-[13px] text-[#64748b]">Share your link and earn 50 coins for every friend who joins!</p>
        <div className="mb-3 truncate rounded-[12px] bg-[#f8fafc] px-3 py-2.5 text-[12px] text-[#334155]">
          https://smepaddy-production.up.railway.app/ref=...
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" className="h-10 rounded-[12px] text-[13px]"><Copy className="size-4" /> Copy</Button>
          <Button className="h-10 rounded-[12px] text-[13px]"><Share2 className="size-4" /> Share</Button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[13px] text-[#64748b]">{label}</span>
      <span className="text-right text-[13px] font-semibold text-[#071122]">{value}</span>
    </div>
  );
}

function nextLevelTitle(level: number): string {
  return ({ 1: "Hustler", 2: "Boss", 3: "Big Boss", 4: "Mogul" }[level] ?? "Mogul");
}
