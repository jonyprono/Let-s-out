import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, Check } from "lucide-react"

export interface PaymentOption {
  id: string
  label: string
  icon?: React.ReactNode
  emoji?: string
}

export interface PaymentDropdownProps {
  value: string
  onChange: (value: string) => void
  options: PaymentOption[]
  placeholder?: string
  className?: string
}

export function PaymentDropdown({
  value,
  onChange,
  options,
  placeholder = "Sélectionner",
  className
}: PaymentDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  const selectedOption = options.find(o => o.id === value)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className={cn("relative w-full", className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 bg-[var(--color-background-primary)] border border-[var(--border-default)] rounded-[12px]",
          "text-[length:var(--font-size-body-medium)] text-[var(--color-text-primary)] focus:outline-none focus:border-2 focus:border-[var(--border-brand-primary)]",
          isOpen && "border-2 border-[var(--border-brand-primary)]"
        )}
      >
        <div className="flex items-center gap-2">
          {selectedOption ? (
            <>
              {selectedOption.icon && <span className="flex-shrink-0">{selectedOption.icon}</span>}
              {selectedOption.emoji && <span className="flex-shrink-0">{selectedOption.emoji}</span>}
              <span className="font-medium">{selectedOption.label}</span>
            </>
          ) : (
            <span className="text-[var(--color-text-placeholder)]">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={cn("w-5 h-5 text-[var(--color-text-secondary)] transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[var(--color-background-primary)] border border-[var(--border-default)] rounded-[12px] shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="max-h-60 overflow-auto py-1">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--color-background-secondary)] transition-colors text-left",
                  value === option.id && "bg-[var(--color-background-secondary)]"
                )}
                onClick={() => {
                  onChange(option.id)
                  setIsOpen(false)
                }}
              >
                <div className="flex items-center gap-2">
                  {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
                  {option.emoji && <span className="flex-shrink-0">{option.emoji}</span>}
                  <span className={cn("font-medium", value === option.id ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]")}>
                    {option.label}
                  </span>
                </div>
                {value === option.id && <Check className="w-4 h-4 text-[var(--brand-orange-500)]" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
