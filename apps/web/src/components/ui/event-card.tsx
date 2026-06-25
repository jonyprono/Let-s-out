import * as React from "react"
import { cn } from "@/lib/utils"
import { SaveEventButton } from "./save-event-button"
import { PriceBadge } from "./price-badge"

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
  className,
}: EventCardProps) {
  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-large)] border border-[var(--border-default)] bg-[var(--color-background-primary)]", className)}>
      <div className="relative h-[160px] w-full bg-[var(--color-background-secondary)]">
        {imageUrl && (
          <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
        )}
        <div className="absolute right-[var(--spacing-150)] top-[var(--spacing-150)]">
          <SaveEventButton saved={isSaved} onClick={onSaveToggle} />
        </div>
      </div>
      <div className="flex flex-col gap-[var(--spacing-100)] p-[var(--spacing-200)]">
        <h3 className="font-poppins text-[var(--font-size-title-xsmall)] font-semibold text-[var(--color-text-primary)] leading-tight">
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
          <PriceBadge type={priceType} amount={priceAmount} />
        </div>
      </div>
    </div>
  )
}
