import * as React from "react"
import { cn } from "@/lib/utils"

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
}

const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <div className={cn("relative flex items-center py-[16px]", className)} ref={ref} {...props}>
        <div className="flex-grow border-t border-[var(--border-secondary)]"></div>
        {label && (
          <span className="shrink-0 px-[12px] font-poppins text-[12px] text-[#A1A1AA]">
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
