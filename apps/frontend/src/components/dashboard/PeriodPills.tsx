import { periods } from "@/data/dashboard";
import type { Period } from "@/types/dashboard";

import { Pill } from "./Pill";

export function PeriodPills({
  activePeriod,
  onPeriodChange,
}: {
  activePeriod: Period;
  onPeriodChange: (period: Period) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap gap-2.5 sm:gap-3">
      {periods.map((period) => (
        <Pill
          key={period}
          active={period === activePeriod}
          onClick={() => onPeriodChange(period)}
        >
          {period}
        </Pill>
      ))}
    </div>
  );
}
