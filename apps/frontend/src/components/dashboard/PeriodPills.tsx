import { periods } from "@/data/dashboard";
import { cn } from "@/lib/utils";
import type { Period } from "@/types/dashboard";

export function PeriodPills({
  activePeriod,
  onPeriodChange,
}: {
  activePeriod: Period;
  onPeriodChange: (period: Period) => void;
}) {
  return (
    <div className="-mx-4 sm:mx-0">
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1 sm:flex-wrap sm:px-0"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {periods.map((period) => (
          <button
            key={period}
            onClick={() => onPeriodChange(period)}
            className={cn(
              "h-10 shrink-0 rounded-full px-4 text-[14px] font-semibold transition-all duration-200",
              period === activePeriod
                ? "bg-[#1557df] text-white shadow-[0_4px_12px_rgba(21,87,223,0.3)]"
                : "bg-white text-[#64748b] shadow-[0_1px_4px_rgba(15,23,42,0.08)] active:bg-[#f1f5f9]",
            )}
          >
            {period}
          </button>
        ))}
      </div>
    </div>
  );
}
