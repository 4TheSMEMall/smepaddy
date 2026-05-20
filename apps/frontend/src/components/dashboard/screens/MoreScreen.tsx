"use client";

import { serviceItems } from "@/data/dashboard";
import { cn } from "@/lib/utils";

import { IconBubble } from "../IconBubble";

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
  return (
    <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-[#dce3ec] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.14)] sm:gap-y-6 sm:px-4 sm:py-6">
      {serviceItems.map((item) => (
        <button
          key={item.label}
          onClick={getAction(item.label, onSettings, onProfile, onConsignment, onRecurring, onLoans, onAnalytics, onRewards, onSavings, onCustomers)}
          className={cn(
            "mx-auto flex min-h-[96px] w-full flex-col items-center justify-center gap-2 rounded-[16px] px-2 py-3 text-center text-[14px] font-semibold text-[#334155] sm:h-[132px] sm:w-[86%] sm:gap-3 sm:rounded-[18px] sm:text-[18px]",
            item.active && item.label !== "Settings" && "bg-[#f3f6f9]",
            item.label === "Settings" &&
              "border border-[#bdd0ee] bg-[#f1f6fc] text-[#1557df]",
          )}
        >
          <IconBubble tone={item.tone ?? "slate"}>
            <item.icon className="size-6" />
          </IconBubble>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function getAction(
  label: string,
  onSettings: () => void,
  onProfile: () => void,
  onConsignment: () => void,
  onRecurring: () => void,
  onLoans: () => void,
  onAnalytics: () => void,
  onRewards: () => void,
  onSavings: () => void,
  onCustomers: () => void,
) {
  if (label === "Settings") return onSettings;
  if (label === "Profile") return onProfile;
  if (label === "Consignment") return onConsignment;
  if (label === "Recurring") return onRecurring;
  if (label === "Loans") return onLoans;
  if (label === "Analytics") return onAnalytics;
  if (label === "Rewards") return onRewards;
  if (label === "Savings") return onSavings;
  if (label === "Customers") return onCustomers;
  return undefined;
}
