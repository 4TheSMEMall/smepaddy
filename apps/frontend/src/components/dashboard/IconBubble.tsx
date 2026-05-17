import { cn } from "@/lib/utils";
import type { Tone } from "@/types/dashboard";

const tones: Record<Tone, string> = {
  blue: "bg-[#eef4ff] text-[#1557df]",
  green: "bg-[#eafaf4] text-[#04a66d]",
  amber: "bg-[#fff8e8] text-[#d98900]",
  purple: "bg-[#f7ecff] text-[#8b1ed1]",
  indigo: "bg-[#f0f1ff] text-[#4b54d9]",
  slate: "bg-[#f1f5f9] text-[#334155]",
};

export function IconBubble({
  tone,
  children,
}: {
  tone: Tone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "grid size-[46px] place-items-center rounded-[14px]",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
