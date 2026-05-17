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
    <div className="mb-9 flex items-center gap-14">
      <button className="grid size-9 place-items-center" onClick={onBack}>
        <ArrowLeft className="size-7" />
      </button>
      <h2 className="text-[31px] font-extrabold">{title}</h2>
      <span className="text-[17px] font-semibold text-[#253047]">{plan}</span>
    </div>
  );
}
