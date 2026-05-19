"use client";

import { Bell, Sprout } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PaddyCoinIcon } from "@/components/PaddyCoinIcon";

export function TopBar({ coins, businessName }: { coins: number; businessName?: string }) {
  const [flash, setFlash] = useState<number | null>(null);
  const prevCoins = useRef(coins);

  useEffect(() => {
    if (coins > prevCoins.current) {
      setFlash(coins - prevCoins.current);
      const t = setTimeout(() => setFlash(null), 2200);
      prevCoins.current = coins;
      return () => clearTimeout(t);
    }
    prevCoins.current = coins;
  }, [coins]);

  return (
    <header className="sticky top-0 z-20 border-b border-[#e8edf5] bg-white/95 shadow-[0_6px_22px_rgba(15,23,42,0.05)] backdrop-blur-xl"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="mx-auto flex h-[62px] max-w-[620px] items-center justify-between gap-3 px-4 sm:px-0">
        {/* Brand */}
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-gradient-to-br from-[#1557df] to-[#0d40b8] text-[13px] font-bold text-white shadow-[0_6px_16px_rgba(21,87,223,0.28)]">
            SP
          </div>
          <h1 className="min-w-0 truncate text-[20px] font-extrabold leading-none text-[#071122] sm:text-[21px]">
            {businessName ?? "SME Paddy"}
          </h1>
        </div>

        {/* Right side */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Notification bell */}
          <button className="relative grid size-10 place-items-center rounded-full bg-[#f1f5f9] text-[#334155] active:bg-[#e2e8f0]" aria-label="Notifications">
            <Bell className="size-5" strokeWidth={2} />
          </button>

          {/* Coin badge */}
          <div className="relative flex h-10 max-w-[118px] items-center gap-1.5 rounded-full border border-[#fde8a9] bg-[#fffdf3] px-3 text-[15px] font-extrabold text-[#d57a00] shadow-[0_4px_14px_rgba(245,158,11,0.12)] sm:max-w-none">
            <PaddyCoinIcon className="size-4" />
            <span className="truncate">{coins.toLocaleString()}</span>
            <Sprout className="size-3.5 text-[#8cc84b]" />
            {flash !== null && (
              <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#f59e0b] px-2 py-0.5 text-[11px] font-extrabold text-white shadow-sm animate-bounce">
                +{flash}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
