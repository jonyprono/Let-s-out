import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  leftIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, leftIcon, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {leftIcon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-icon-secondary)] flex items-center justify-center cursor-pointer pointer-events-none">
            {leftIcon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            // Dimensions identiques au champ téléphone : h-[var(--input-height)], rounded-[var(--input-radius)], border 1px → 2px orange au focus
            "flex h-[var(--input-height)] w-full rounded-[var(--input-radius)] border border-[var(--border-primary)] bg-white px-4 font-inter text-[14px] font-medium text-[var(--color-text-primary)] transition-all duration-150 placeholder:text-[var(--color-text-placeholder)] placeholder:font-normal focus:outline-none focus:border-2 focus:border-[var(--border-brand-primary)] disabled:cursor-not-allowed disabled:opacity-50",
            icon && "pr-12",
            leftIcon && "pl-11",
            className
          )}
          ref={ref}
          {...props}
        />
        {icon && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-icon-tertiary)] flex items-center justify-center cursor-pointer">
            {icon}
          </div>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
