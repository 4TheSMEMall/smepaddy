import { ArrowLeft } from "lucide-react";

export function ScreenTitle({
  title,
  plan,
  onBack,
}: {
  title: string;
  plan: string;
  onBack: () => void;
}) {
  return (
    <div className="mb-6 flex items-center justify-between gap-3 sm:mb-9 sm:justify-start sm:gap-14">
      <button className="grid size-10 shrink-0 place-items-center rounded-full bg-white shadow-[0_1px_5px_rgba(15,23,42,0.08)] sm:size-9 sm:bg-transparent sm:shadow-none" onClick={onBack}>
        <ArrowLeft className="size-7" />
      </button>
      <h2 className="min-w-0 flex-1 truncate text-[27px] font-extrabold leading-tight sm:flex-none sm:text-[31px]">{title}</h2>
      <span className="shrink-0 text-[14px] font-semibold text-[#253047] sm:text-[17px]">{plan}</span>
    </div>
  );
}
