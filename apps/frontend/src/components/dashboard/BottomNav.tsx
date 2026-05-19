"use client";

import { motion } from "framer-motion";

import { navItems } from "@/data/dashboard";
import { cn } from "@/lib/utils";
import type { Tab } from "@/types/dashboard";

export function BottomNav({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
}) {
  return (
    <nav className="nav-safe fixed inset-x-0 bottom-0 z-30 border-t border-[#e4e9f0] bg-white/95 shadow-[0_-8px_28px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="mx-auto grid h-[72px] max-w-[620px] grid-cols-5 px-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={cn(
              "relative flex min-w-0 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors duration-150 sm:text-[11px]",
              active === item.id
                ? "text-[#1557df]"
                : "text-[#94a3b8] active:text-[#1557df]",
            )}
            onClick={() => onChange(item.id)}
          >
            {active === item.id && (
              <motion.span
                layoutId="nav-indicator"
                className="absolute top-0 h-[3px] w-8 rounded-b-full bg-[#1557df]"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <div className={cn(
              "flex size-8 items-center justify-center rounded-[10px] transition-all duration-150",
              active === item.id ? "bg-[#eff4ff]" : "",
            )}>
              <item.icon
                className={cn("size-5", active === item.id && "stroke-[2.5]")}
                strokeWidth={active === item.id ? 2.5 : 2}
              />
            </div>
            <span className="max-w-full truncate px-0.5">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
