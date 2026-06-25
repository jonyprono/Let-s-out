import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <input
          type={type}
          className={cn(
            "flex h-[44px] w-full rounded-[8px] border border-[var(--border-default)] bg-[var(--color-background-primary)] px-[var(--spacing-200)] py-[10px] font-poppins text-[var(--font-size-body-medium)] text-[var(--color-text-primary)] transition-colors placeholder:text-[var(--color-text-placeholder)] focus-visible:outline-none focus-visible:border-[var(--border-brand-primary)] disabled:cursor-not-allowed disabled:opacity-50",
            icon && "pr-[var(--spacing-500)]",
            className
          )}
          ref={ref}
          {...props}
        />
        {icon && (
          <div className="absolute right-[var(--spacing-150)] top-1/2 -translate-y-1/2 text-[var(--color-icon-tertiary)] flex items-center justify-center cursor-pointer">
            {icon}
          </div>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
