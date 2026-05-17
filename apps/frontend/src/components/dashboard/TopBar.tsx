"use client";

import { Bell, Sprout } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PaddyCoinIcon } from "@/components/PaddyCoinIcon";

export function TopBar({ coins }: { coins: number }) {
  const [flash, setFlash] = useState<number | null>(null);
  const prevCoins = useRef(coins);

  useEffect(() => {
    if (coins > prevCoins.current) {
      const gained = coins - prevCoins.current;
      setFlash(gained);
      const t = setTimeout(() => setFlash(null), 2000);
      prevCoins.current = coins;
      return () => clearTimeout(t);
    }
    prevCoins.current = coins;
  }, [coins]);

  return (
    <header className="sticky top-0 z-20 h-[68px] border-b border-[#dfe5ed] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:h-[72px]">
      <div className="mx-auto flex h-full max-w-[620px] items-center justify-between px-4 sm:px-0">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-[12px] bg-[#1557df] text-[15px] font-semibold text-white shadow-[0_2px_4px_rgba(21,87,223,0.24)]">
            SP
          </div>
          <h1 className="text-[21px] font-semibold leading-none text-[#081124] sm:text-[22px]">
            Mikama Services
          </h1>
        </div>
        <div className="flex items-center gap-5 sm:gap-6">
          <Bell className="size-6 text-[#26364d]" strokeWidth={2} />
          <div className="relative flex h-[50px] min-w-[110px] items-center justify-center gap-2 rounded-[28px] border border-[#fde8a9] bg-[#fffdf3] px-4 text-[19px] font-semibold text-[#d57a00] shadow-[0_1px_1px_rgba(213,122,0,0.06)]">
            <PaddyCoinIcon className="size-5" />
            <span>{coins}</span>
            <Sprout className="size-4 text-[#8cc84b]" />
            {flash !== null && (
              <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 animate-bounce rounded-full bg-[#f59e0b] px-2 py-0.5 text-[13px] font-extrabold text-white">
                +{flash}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
