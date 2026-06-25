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
            // Dimensions identiques au champ téléphone : h-[52px], rounded-[12px], border 1.25px → 2px orange au focus
            "flex h-[52px] w-full rounded-[12px] border border-[var(--border-default)] bg-white px-4 font-poppins text-[14px] font-medium text-[var(--color-text-primary)] transition-all duration-150 placeholder:text-[var(--color-text-placeholder)] placeholder:font-normal focus:outline-none focus:border-2 focus:border-[var(--border-brand-primary)] disabled:cursor-not-allowed disabled:opacity-50",
            icon && "pr-12",
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
