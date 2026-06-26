
import { cn } from "@/lib/utils"

export interface ToggleButtonProps {
  options: { label: React.ReactNode; value: string }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ToggleButton({ options, value, onChange, className }: ToggleButtonProps) {
  return (
    <div
      className={cn(
        "inline-flex h-[40px] items-center gap-[var(--spacing-100)]",
        className
      )}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-full items-center justify-center rounded-full px-[var(--spacing-250)] font-poppins text-[var(--font-size-body-medium)] font-medium transition-colors focus-visible:outline-none",
              isActive
                ? "bg-[var(--color-background-primary-muted)] text-[var(--color-text-brand-primary)]"
                : "bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
