"use client";

import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Copy,
  Edit3,
  Mail,
  MapPin,
  Phone,
  Share2,
  Sprout,
  UserRound,
} from "lucide-react";

import { PaddyCoinIcon } from "@/components/PaddyCoinIcon";
import { Button } from "@/components/ui/button";
import type { CurrentAccountResponse } from "@/lib/accountApi";
import type { WalletInfo } from "@/lib/coinApi";
import { cn } from "@/lib/utils";

export function ProfileScreen({
  onBack,
  wallet,
  account,
}: {
  onBack: () => void;
  wallet?: WalletInfo | null;
  account?: CurrentAccountResponse | null;
}) {
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
        <Button variant="secondary" size="sm" className="h-9 rounded-xl px-3 text-[13px]">
          <Edit3 className="size-4" /> Edit
        </Button>
      </div>

      {/* Hero profile card */}
      <div className="overflow-hidden rounded-[22px] bg-gradient-to-br from-[#1557df] to-[#0d40b8] px-5 py-6 text-white shadow-[0_8px_24px_rgba(21,87,223,0.3)]">
        <div className="flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-full bg-white/20 text-white">
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

      {/* Business info */}
      <div className="rounded-[20px] bg-white px-4 py-4 shadow-[0_2px_12px_rgba(15,23,42,0.07)]">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-[10px] bg-[#eff4ff]">
            <Building2 className="size-4 text-[#1557df]" />
          </div>
          <p className="text-[14px] font-bold text-[#071122]">Business Info</p>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[13px] text-[#64748b]">Business Name</span>
            <span className="text-right text-[13px] font-semibold text-[#071122]">{account?.business?.businessName ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[13px] text-[#64748b]">Type</span>
            <span className="text-right text-[13px] font-semibold text-[#071122]">{account?.business?.businessType ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[13px] text-[#64748b] flex items-center gap-1.5"><MapPin className="size-3.5" />Location</span>
            <span className="text-right text-[13px] font-semibold text-[#071122]">{account?.business?.location ?? "Not set"}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[13px] text-[#64748b] flex items-center gap-1.5"><CalendarDays className="size-3.5" />Member since</span>
            <span className="text-right text-[13px] font-semibold text-[#071122]">
              {account?.business?.createdAt
                ? new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(account.business.createdAt))
                : "—"}
            </span>
          </div>
        </div>
      </div>

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

function nextLevelTitle(level: number): string {
  return ({ 1: "Hustler", 2: "Boss", 3: "Big Boss", 4: "Mogul" }[level] ?? "Mogul");
}
