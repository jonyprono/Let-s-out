
import { cn } from "@/lib/utils"
import { SaveEventButton } from "./save-event-button"
import { PriceBadge } from "./price-badge"
import { Share01Icon } from "hugeicons-react"

export interface EventCardProps {
  title: string;
  dateStr: string;
  locationStr: string;
  participantsCount: number;
  imageUrl?: string;
  priceType?: "free" | "paid";
  priceAmount?: number;
  isSaved?: boolean;
  onSaveToggle?: () => void;
  onShare?: () => void;
  customBadge?: React.ReactNode;
  className?: string;
}

export function EventCard({
  title,
  dateStr,
  locationStr,
  participantsCount,
  imageUrl,
  priceType = "free",
  priceAmount,
  isSaved = false,
  onSaveToggle,
  onShare,
  customBadge,
  className,
}: EventCardProps) {
  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-large)] border border-[var(--border-default)] bg-[var(--color-background-primary)]", className)}>
      <div className="relative h-[160px] w-full bg-[var(--color-background-secondary)]">
        {imageUrl && (
          <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
        )}
        <div className="absolute right-[var(--spacing-150)] top-[var(--spacing-150)] flex gap-[var(--spacing-100)]">
          {onShare && (
            <button
              onClick={onShare}
              className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-[var(--color-background-primary-muted)] text-[var(--color-icon-primary)] transition-colors hover:bg-[var(--color-background-secondary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-brand-primary)]"
            >
              <Share01Icon width={24} height={24} strokeWidth={1.5} />
            </button>
          )}
          <SaveEventButton saved={isSaved} onClick={onSaveToggle} />
        </div>
      </div>
      <div className="flex flex-col gap-[var(--spacing-100)] p-[var(--spacing-200)]">
        <h3 className="font-poppins text-[16px] font-semibold text-[var(--color-text-primary)] leading-tight">
          {title}
        </h3>
        <p className="font-poppins text-[var(--font-size-body-small)] text-[var(--color-text-secondary)]">
          {dateStr}
        </p>
        <p className="font-poppins text-[var(--font-size-body-small)] text-[var(--color-text-secondary)]">
          {locationStr}
        </p>
        <div className="mt-[var(--spacing-100)] flex items-center justify-between">
          <div className="flex items-center gap-[var(--spacing-100)]">
            <div className="flex -space-x-[var(--spacing-100)]">
              <div className="h-6 w-6 rounded-full border border-white bg-[var(--color-background-secondary)]"></div>
              <div className="h-6 w-6 rounded-full border border-white bg-[var(--color-background-secondary)]"></div>
              <div className="h-6 w-6 rounded-full border border-white bg-[var(--color-background-secondary)]"></div>
            </div>
            <span className="font-poppins text-[var(--font-size-body-xsmall)] text-[var(--color-text-secondary)]">
              {participantsCount} Participants
            </span>
          </div>
          {customBadge ? customBadge : <PriceBadge type={priceType} amount={priceAmount} />}
        </div>
      </div>
    </div>
  )
}
