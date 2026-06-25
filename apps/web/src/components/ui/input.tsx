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
            "flex h-[48px] w-full rounded-[8px] border border-[#E5E5E5] bg-white px-4 py-2 font-poppins text-[14px] text-[#1B1818] transition-colors placeholder:text-[#A3A3A3] focus-visible:outline-none focus-visible:border-[#FF7A00] disabled:cursor-not-allowed disabled:opacity-50",
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
