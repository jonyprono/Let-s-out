import * as React from "react"
import { cn } from "@/lib/utils"
import { Star } from "lucide-react"

export interface SaveEventButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  saved?: boolean;
}

const SaveEventButton = React.forwardRef<HTMLButtonElement, SaveEventButtonProps>(
  ({ className, saved = false, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "flex h-[40px] w-[40px] items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-brand-primary)]",
          saved
            ? "bg-[var(--color-action-primary)] text-[var(--color-icon-inverse)] hover:bg-[var(--color-action-primary-active)]"
            : "bg-[var(--neutral-gray-200)] text-[var(--color-icon-secondary)] hover:bg-[var(--neutral-gray-300)]",
          className
        )}
        {...props}
      >
        <Star className="h-5 w-5" fill="none" strokeWidth={2} />
      </button>
    )
  }
)
SaveEventButton.displayName = "SaveEventButton"

export { SaveEventButton }
