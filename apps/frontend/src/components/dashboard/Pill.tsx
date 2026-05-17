import { cn } from "@/lib/utils";

export function Pill({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-[44px] rounded-[14px] border border-[#d9e0ea] bg-white px-4 text-[17px] font-medium text-[#526075] shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:h-[46px] sm:px-5 sm:text-[18px]",
        active &&
          "border-[#1156df] bg-[#1557df] text-white shadow-[0_2px_5px_rgba(21,87,223,0.26)]",
      )}
    >
      {children}
    </button>
  );
}
