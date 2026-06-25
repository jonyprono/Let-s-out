import * as React from "react"
import { cn } from "@/lib/utils"

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  max?: number;
}

export const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ className, value, max = 100, ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    return (
      <div
        ref={ref}
        className={cn("relative h-[4px] w-full overflow-hidden rounded-full bg-[var(--color-background-secondary)]", className)}
        {...props}
      >
        <div
          className="h-full w-full flex-1 bg-[var(--color-action-primary)] transition-all duration-300"
          style={{ transform: `translateX(-${100 - percentage}%)` }}
        />
      </div>
    )
  }
)
ProgressBar.displayName = "ProgressBar"

export interface CarouselIndicatorsProps extends React.HTMLAttributes<HTMLDivElement> {
  count: number;
  activeIndex: number;
}

export const CarouselIndicators = React.forwardRef<HTMLDivElement, CarouselIndicatorsProps>(
  ({ className, count, activeIndex, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("flex items-center justify-center gap-[var(--spacing-100)]", className)} {...props}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-[4px] rounded-full transition-all duration-300",
              i === activeIndex
                ? "w-[24px] bg-[var(--color-action-primary)]"
                : "w-[4px] bg-[var(--color-background-secondary)]"
            )}
          />
        ))}
      </div>
    )
  }
)
CarouselIndicators.displayName = "CarouselIndicators"
