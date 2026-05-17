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
    <nav className="fixed inset-x-0 bottom-0 z-30 h-[72px] border-t border-[#e4e9f0] bg-white/96 shadow-[0_-1px_5px_rgba(15,23,42,0.04)] backdrop-blur sm:h-[76px]">
      <div className="mx-auto grid h-full max-w-[620px] grid-cols-5">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 text-[14px] font-medium text-[#748199] sm:text-[15px]",
              active === item.id && "text-[#1557df]",
            )}
            onClick={() => onChange(item.id)}
          >
            {active === item.id && (
              <motion.span
                layoutId="nav-indicator"
                className="absolute top-0 h-1 w-10 rounded-b bg-[#1557df]"
              />
            )}
            <item.icon className="size-6 sm:size-7" strokeWidth={2} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
