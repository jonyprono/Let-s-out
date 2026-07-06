import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, Check } from "lucide-react"

export interface PaymentOption {
  id: string
  label: string
  icon?: React.ReactNode
  emoji?: string
  logo?: string
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
          "w-full flex flex-row items-center p-[10px] gap-[4px] h-[44px] bg-[#FFFFFF] border border-[#E0E0E0] rounded-[6px] active:bg-gray-50 transition-colors focus:outline-none",
          isOpen && "border-[#FF7A00]"
        )}
      >
        <div className="flex items-center gap-[4px] flex-1 overflow-hidden">
          {selectedOption ? (
            <>
              {selectedOption.logo && <img src={selectedOption.logo} alt={selectedOption.label} className="w-6 h-6 object-contain shrink-0" />}
              {selectedOption.icon && <span className="flex-shrink-0">{selectedOption.icon}</span>}
              {selectedOption.emoji && <span className="flex-shrink-0">{selectedOption.emoji}</span>}
              <span className="flex-1 text-[14px] text-[#1B1818] text-left truncate">{selectedOption.label}</span>
            </>
          ) : (
            <span className="flex-1 text-[14px] text-gray-400 text-left">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={cn("w-4 h-4 text-[#8D8D8D] shrink-0 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 bg-[#FFFFFF] border border-[#DFDFDF] rounded-[10px] shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="max-h-60 overflow-auto">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cn(
                  "w-full flex flex-row items-center p-[10px] gap-[4px] h-[44px] hover:bg-[#FFF8F0] transition-colors text-left"
                )}
                onClick={() => {
                  onChange(option.id)
                  setIsOpen(false)
                }}
              >
                {option.logo && <img src={option.logo} alt={option.label} className="w-6 h-6 object-contain shrink-0" />}
                {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
                {option.emoji && <span className="flex-shrink-0">{option.emoji}</span>}
                <span className="flex-1 text-[14px] text-[#1B1818] text-left">
                  {option.label}
                </span>
                {value === option.id && <Check className="w-4 h-4 text-[#FF7A00] shrink-0" strokeWidth={2.5} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
