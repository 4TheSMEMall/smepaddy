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
}: {
  onSettings: () => void;
  onProfile: () => void;
  onConsignment: () => void;
  onRecurring: () => void;
  onLoans: () => void;
  onAnalytics: () => void;
  onRewards: () => void;
  onSavings: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-y-6 rounded-[22px] border border-[#dce3ec] bg-white px-4 py-6 shadow-[0_1px_3px_rgba(15,23,42,0.14)]">
      {serviceItems.map((item) => (
        <button
          key={item.label}
          onClick={getAction(item.label, onSettings, onProfile, onConsignment, onRecurring, onLoans, onAnalytics, onRewards, onSavings)}
          className={cn(
            "mx-auto flex h-[132px] w-[86%] flex-col items-center justify-center gap-3 rounded-[18px] text-[18px] font-medium text-[#334155]",
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
) {
  if (label === "Settings") return onSettings;
  if (label === "Profile") return onProfile;
  if (label === "Consignment") return onConsignment;
  if (label === "Recurring") return onRecurring;
  if (label === "Loans") return onLoans;
  if (label === "Analytics") return onAnalytics;
  if (label === "Rewards") return onRewards;
  if (label === "Savings") return onSavings;
  return undefined;
}
