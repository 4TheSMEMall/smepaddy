import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[#1557df] text-white shadow-[0_2px_5px_rgba(21,87,223,0.34)] hover:bg-[#0f4fd2]",
        secondary:
          "border border-[#d9e0ea] bg-white text-[#334155] shadow-[0_1px_3px_rgba(15,23,42,0.08)] hover:bg-[#f8fafc]",
        success:
          "bg-[#05a970] text-white shadow-[0_2px_5px_rgba(5,169,112,0.28)] hover:bg-[#069464]",
        danger:
          "bg-[#ef3b42] text-white shadow-[0_2px_5px_rgba(239,59,66,0.26)]",
        ghost: "text-[#334155] hover:bg-[#f1f5f9]",
      },
      size: {
        default: "h-12 px-5 text-[16px] sm:h-14 sm:px-7 sm:text-[22px]",
        sm: "h-11 px-4 text-[15px] sm:h-12 sm:px-5 sm:text-[18px]",
        icon: "size-12 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
