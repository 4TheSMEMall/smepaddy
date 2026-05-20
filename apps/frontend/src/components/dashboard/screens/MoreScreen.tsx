"use client";

import {
  BarChart2,
  Gift,
  Landmark,
  Package,
  PiggyBank,
  RefreshCw,
  Settings,
  Share2,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MoreItem = {
  label: string;
  icon: React.ElementType;
  gradient: string;
  shadow: string;
  active?: boolean;
};

const ITEMS: MoreItem[] = [
  { label: "Profile",      icon: User,       gradient: "from-[#1557df] to-[#0d40b8]", shadow: "rgba(21,87,223,0.3)",   active: true },
  { label: "Customers",    icon: Users,      gradient: "from-[#059669] to-[#047857]", shadow: "rgba(5,150,105,0.3)",   active: true },
  { label: "Analytics",   icon: BarChart2,  gradient: "from-[#7c3aed] to-[#6d28d9]", shadow: "rgba(124,58,237,0.3)",  active: true },
  { label: "Loans",        icon: Landmark,   gradient: "from-[#d97706] to-[#b45309]", shadow: "rgba(217,119,6,0.3)",   active: true },
  { label: "Savings",      icon: PiggyBank,  gradient: "from-[#059669] to-[#047857]", shadow: "rgba(5,150,105,0.3)",   active: true },
  { label: "Rewards",      icon: Gift,       gradient: "from-[#db2777] to-[#be185d]", shadow: "rgba(219,39,119,0.3)",  active: true },
  { label: "Recurring",    icon: RefreshCw,  gradient: "from-[#f59e0b] to-[#d97706]", shadow: "rgba(245,158,11,0.3)",  active: true },
  { label: "Consignment",  icon: Package,    gradient: "from-[#0891b2] to-[#0e7490]", shadow: "rgba(8,145,178,0.3)",   active: true },
  { label: "Invite",       icon: Share2,     gradient: "from-[#6366f1] to-[#4f46e5]", shadow: "rgba(99,102,241,0.3)",  active: false },
  { label: "Settings",     icon: Settings,   gradient: "from-[#475569] to-[#334155]", shadow: "rgba(71,85,105,0.3)",   active: true },
];

export function MoreScreen({
  onSettings,
  onProfile,
  onConsignment,
  onRecurring,
  onLoans,
  onAnalytics,
  onRewards,
  onSavings,
  onCustomers,
}: {
  onSettings: () => void;
  onProfile: () => void;
  onConsignment: () => void;
  onRecurring: () => void;
  onLoans: () => void;
  onAnalytics: () => void;
  onRewards: () => void;
  onSavings: () => void;
  onCustomers: () => void;
}) {
  function handlePress(label: string) {
    const map: Record<string, (() => void) | undefined> = {
      Settings:    onSettings,
      Profile:     onProfile,
      Consignment: onConsignment,
      Recurring:   onRecurring,
      Loans:       onLoans,
      Analytics:   onAnalytics,
      Rewards:     onRewards,
      Savings:     onSavings,
      Customers:   onCustomers,
    };
    map[label]?.();
  }

  return (
    <div className="space-y-5 pb-4">
      {/* Grid */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4">
        {ITEMS.map(({ label, icon: Icon, gradient, shadow, active }) => (
          <button
            key={label}
            onClick={() => handlePress(label)}
            className={cn(
              "flex flex-col items-center gap-2.5 rounded-[20px] bg-white px-2 py-4 text-center shadow-[0_2px_12px_rgba(15,23,42,0.07)] active:scale-[0.95] transition-transform duration-100",
              !active && "opacity-50",
            )}
          >
            <div
              className={cn(
                "grid size-12 place-items-center rounded-[16px] bg-gradient-to-br text-white",
                gradient,
              )}
              style={{ boxShadow: `0 5px 14px ${shadow}` }}
            >
              <Icon className="size-5" />
            </div>
            <span className="text-[12px] font-semibold leading-tight text-[#334155]">
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* App info footer */}
      <div className="rounded-[18px] bg-white px-5 py-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-bold text-[#071122]">SME Paddy</p>
            <p className="text-[12px] text-[#94a3b8]">Version 1.0 · Built for Nigerian SMEs</p>
          </div>
          <div className="grid size-10 place-items-center rounded-[12px] bg-gradient-to-br from-[#1557df] to-[#0d40b8] text-[13px] font-bold text-white shadow-[0_4px_12px_rgba(21,87,223,0.3)]">
            SP
          </div>
        </div>
      </div>
    </div>
  );
}
