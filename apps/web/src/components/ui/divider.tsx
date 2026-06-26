import * as React from "react"
import { cn } from "@/lib/utils"

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
}

const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <div className={cn("relative flex items-center py-[var(--spacing-200)]", className)} ref={ref} {...props}>
        <div className="flex-grow border-t border-[var(--border-secondary)]"></div>
        {label && (
          <span className="shrink-0 px-[var(--spacing-150)] font-inter text-[12px] text-[var(--color-text-tertiary)]">
            {label}
          </span>
        )}
        <div className="flex-grow border-t border-[var(--border-secondary)]"></div>
      </div>
    )
  }
)
Divider.displayName = "Divider"

export { Divider }
