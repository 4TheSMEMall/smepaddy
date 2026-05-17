import * as React from "react";

import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-[18px] border border-[#dce3ec] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.11)]",
        className,
      )}
      {...props}
    />
  );
}

export { Card };
