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
          "flex h-9 w-9 items-center justify-center rounded-full transition-colors active:scale-95",
          saved
            ? "bg-[var(--brand-orange-500)] text-white"
            : "bg-gray-200 text-gray-600",
          className
        )}
        {...props}
      >
        <Star className="h-[18px] w-[18px]" strokeWidth={2} fill="none" />
      </button>
    )
  }
)
SaveEventButton.displayName = "SaveEventButton"

export { SaveEventButton }
