import * as React from "react"
import { cn } from "@/lib/utils"

export interface PriceBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: "free" | "paid";
  amount?: string | number;
  currency?: string;
}

const PriceBadge = React.forwardRef<HTMLDivElement, PriceBadgeProps>(
  ({ className, type = "free", amount, currency = "FCFA", ...props }, ref) => {
    const isFree = type === "free" || amount === 0 || amount === "0";

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-[var(--radius-small)] px-[var(--spacing-100)] py-[var(--spacing-025)] font-poppins text-[var(--font-size-body-small)] font-medium",
          isFree
            ? "bg-[var(--functional-green-50)] text-[var(--color-text-positive)]"
            : "bg-[var(--brand-blue-100)] text-[var(--color-text-brand-secondary)]",
          className
        )}
        {...props}
      >
        {isFree ? "Gratuit" : `${amount} ${currency}`}
      </div>
    )
  }
)
PriceBadge.displayName = "PriceBadge"

export { PriceBadge }
