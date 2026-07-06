import * as React from "react"
import { cn } from "@/lib/utils"

export interface MessageBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  content?: string;
  time: string;
  isSender?: boolean;
  imageUrl?: string;
  avatarUrl?: string;
  showSpacer?: boolean;
  onAvatarClick?: () => void;
  children?: React.ReactNode;
}

export function MessageBubble({
  content,
  time,
  isSender = false,
  imageUrl,
  avatarUrl,
  showSpacer = false,
  onAvatarClick,
  className,
  children,
  ...props
}: MessageBubbleProps) {
  return (
    <div className={cn("flex w-full gap-[var(--spacing-100)]", isSender ? "flex-row-reverse" : "flex-row", className)} {...props}>
      {!isSender && (avatarUrl || showSpacer) && (
        <div className="flex w-8 flex-col justify-end flex-shrink-0">
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt="avatar"
              className={cn("h-8 w-8 rounded-full object-cover", onAvatarClick && "cursor-pointer active:opacity-75")}
              onClick={onAvatarClick}
            />
          )}
        </div>
      )}
      
      <div className={cn("flex max-w-[75%] flex-col gap-[var(--spacing-050)]", isSender ? "items-end" : "items-start")}>
        {imageUrl ? (
          <div className="overflow-hidden rounded-[var(--radius-large)] border border-[var(--border-secondary)] relative">
            <img src={imageUrl} alt="attachment" className="max-h-[200px] w-auto object-cover" />
            <div className={cn("absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[10px] text-white bg-black/50")}>
              {time}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "relative px-[var(--spacing-200)] py-[var(--spacing-150)] font-poppins text-[var(--font-size-body-medium)] rounded-[var(--radius-large)]",
              isSender
                ? "bg-[var(--brand-orange-100)] text-[var(--color-text-primary)] rounded-tr-sm"
                : "bg-[var(--color-background-secondary)] text-[var(--color-text-primary)] rounded-tl-sm"
            )}
          >
            {children ? (
              children
            ) : (
              <>
                <span className="selectable-text mr-2">{content}</span>
                <span className="inline-block text-[10px] text-[var(--color-text-secondary)] opacity-70 align-bottom leading-none">
                  {time}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {isSender && (avatarUrl || showSpacer) && (
        <div className="flex w-8 flex-col justify-end flex-shrink-0">
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt="avatar"
              className={cn("h-8 w-8 rounded-full object-cover", onAvatarClick && "cursor-pointer active:opacity-75")}
              onClick={onAvatarClick}
            />
          )}
        </div>
      )}
    </div>
  )
}

