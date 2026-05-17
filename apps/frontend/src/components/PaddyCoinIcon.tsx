import { cn } from "@/lib/utils";

export function PaddyCoinIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={cn("size-6", className)}
      fill="none"
    >
      <circle cx="19" cy="27" r="10" stroke="currentColor" strokeWidth="4" />
      <circle cx="29" cy="21" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        d="M16 27c0-4.8 3.9-8.8 8.8-8.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="4"
      />
      <path
        d="M31.5 10.5 33 7l1.5 3.5L38 12l-3.5 1.5L33 17l-1.5-3.5L28 12l3.5-1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
