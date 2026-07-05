import * as React from "react"
import { cn } from "@/lib/utils"

export interface ProgressBarLabeledProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  max?: number;
}

export const ProgressBarLabeled = React.forwardRef<HTMLDivElement, ProgressBarLabeledProps>(
  ({ className, value, max = 100, ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    
    return (
      <div ref={ref} className={cn("flex items-center gap-3 w-full", className)} {...props}>
        {/* The bar */}
        <div className="relative h-[6px] flex-1 overflow-hidden rounded-full bg-[var(--color-background-secondary)]">
          <div
            className="h-full bg-[var(--brand-orange-500)] transition-all duration-300 rounded-full"
            style={{ width: `${percentage}%` }}
          />
        </div>
        {/* The badge */}
        <div className="px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white bg-[var(--brand-orange-500)] shrink-0">
          {Math.round(percentage)}%
        </div>
      </div>
    )
  }
)
ProgressBarLabeled.displayName = "ProgressBarLabeled"
