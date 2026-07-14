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
  onImageClick?: () => void;
  children?: React.ReactNode;
}

function renderContent(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a 
          key={i} 
          href={part} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-500 dark:text-blue-400 hover:underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function MessageBubble({
  content,
  time,
  isSender = false,
  imageUrl,
  avatarUrl,
  showSpacer = false,
  onAvatarClick,
  onImageClick,
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
      
      <div className={cn("flex max-w-[85%] sm:max-w-[75%] flex-col gap-[var(--spacing-050)]", isSender ? "items-end" : "items-start")}>
        {imageUrl ? (
          <div className="overflow-hidden rounded-[var(--radius-large)] border border-[var(--border-secondary)] relative group">
            <img 
              src={imageUrl} 
              alt="attachment" 
              className={cn("max-h-[200px] w-auto object-cover transition-opacity", onImageClick && "cursor-pointer hover:opacity-90 active:opacity-75")} 
              onClick={(e) => {
                if (onImageClick) {
                  e.stopPropagation();
                  onImageClick();
                }
              }}
            />
            <div className={cn("absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[10px] text-white bg-black/50")}>
              {time}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "relative px-[var(--spacing-200)] py-[var(--spacing-150)] font-poppins text-[var(--font-size-body-medium)] rounded-[var(--radius-large)]",
              isSender
                ? "bg-[var(--brand-orange-100)] text-[#1B1818] dark:bg-[var(--brand-orange-500)] dark:text-white rounded-tr-sm"
                : "bg-[var(--color-background-secondary)] text-[#1B1818] dark:text-white rounded-tl-sm"
            )}
          >
            {children ? (
              children
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <span className="selectable-text whitespace-pre-wrap break-words w-full" style={{ wordBreak: 'break-word' }}>
                  {content ? renderContent(content) : null}
                </span>
                <span className="inline-block text-[10px] text-[var(--color-text-secondary)] opacity-70 leading-none ml-auto shrink-0 mt-1">
                  {time}
                </span>
              </div>
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

