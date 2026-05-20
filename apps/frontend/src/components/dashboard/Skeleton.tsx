"use client";

import { cn } from "@/lib/utils";

export function SkeletonLine({ className }: { className?: string }) {
  return (
    <div className={cn(
      "animate-pulse rounded-lg bg-gradient-to-r from-[#e2e8f0] via-[#f1f5f9] to-[#e2e8f0] bg-[length:400%_100%]",
      "h-4 w-full",
      className,
    )} style={{ backgroundSize: "400% 100%", animation: "skeleton-shimmer 1.4s ease-in-out infinite" }} />
  );
}

export function SkeletonCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[20px] bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.07)]", className)}>
      {children}
    </div>
  );
}

export function SkeletonAvatar({ className }: { className?: string }) {
  return (
    <div className={cn(
      "animate-pulse rounded-full bg-gradient-to-r from-[#e2e8f0] via-[#f1f5f9] to-[#e2e8f0]",
      "size-12",
      className,
    )} />
  );
}
