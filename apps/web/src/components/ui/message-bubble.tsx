import * as React from "react"
import { cn } from "@/lib/utils"

export interface MessageBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  content?: string;
  time: string;
  isSender?: boolean;
  imageUrl?: string;
  avatarUrl?: string;
  showAvatar?: boolean;
  senderName?: string;
  showSpacer?: boolean;
  onAvatarClick?: () => void;
  onImageClick?: () => void;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
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
  showAvatar,
  senderName,
  showSpacer = false,
  onAvatarClick,
  onImageClick,
  status,
  className,
  children,
  ...props
}: MessageBubbleProps) {

  const renderStatusIcon = () => {
    if (!isSender || !status) return null;
    
    if (status === 'sending') {
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1 opacity-70">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      );
    }
    if (status === 'sent') {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1 opacity-70">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      );
    }
    if (status === 'delivered') {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1 opacity-70">
          <polyline points="18 6 7 17 2 12"></polyline>
          <polyline points="22 10 16 16 14 14"></polyline>
        </svg>
      );
    }
    if (status === 'read') {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
          <polyline points="18 6 7 17 2 12"></polyline>
          <polyline points="22 10 16 16 14 14"></polyline>
        </svg>
      );
    }
    return null;
  };
  return (
    <div className={cn("flex w-full gap-2", isSender ? "flex-row-reverse" : "flex-row", className)} {...props}>
      {!isSender && (showAvatar || showSpacer) && (
        <div className="flex w-8 flex-col justify-end flex-shrink-0 pb-[18px]">
          {showAvatar && (
            avatarUrl ? (
              <img
                src={avatarUrl}
                alt="avatar"
                className={cn("h-8 w-8 rounded-full object-cover", onAvatarClick && "cursor-pointer active:opacity-75")}
                onClick={onAvatarClick}
              />
            ) : (
              <div 
                className={cn("h-8 w-8 rounded-full bg-gray-200 dark:bg-[#333] flex items-center justify-center text-[12px] font-bold text-gray-500 dark:text-gray-400", onAvatarClick && "cursor-pointer active:opacity-75")}
                onClick={onAvatarClick}
              >
                {senderName ? senderName.charAt(0).toUpperCase() : '?'}
              </div>
            )
          )}
        </div>
      )}
      
      <div className={cn("flex max-w-[85%] sm:max-w-[75%] flex-col gap-1", isSender ? "items-end" : "items-start")}>
        {imageUrl ? (
          <div className="overflow-hidden rounded-[var(--radius-large)] border border-[var(--border-secondary)] relative group flex flex-col">
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
            {/* Caption (like WhatsApp) */}
            {content && (
              <div className={cn(
                "px-3 pt-2 pb-1 text-[13px] font-poppins whitespace-pre-wrap break-words",
                isSender ? "text-[#1B1818] dark:text-white" : "text-[#1B1818] dark:text-white"
              )}>
                {content}
              </div>
            )}
            <div className={cn("absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[10px] text-white bg-black/50", content && "relative bottom-auto right-auto self-end px-2 py-0.5 rounded-full text-[10px] bg-black/10 dark:bg-white/10 text-[var(--color-text-secondary)] mb-1 mr-2")}>
              <span className="inline-flex items-center gap-1">
                {time}
                {isSender && renderStatusIcon()}
              </span>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "relative px-3.5 py-2 font-poppins text-[var(--font-size-body-medium)] rounded-[var(--radius-large)]",
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
                <span className="inline-flex items-center text-[10px] text-[var(--color-text-secondary)] opacity-70 leading-none ml-auto shrink-0 mt-1">
                  {time}
                  {renderStatusIcon()}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {isSender && (showAvatar || showSpacer) && (
        <div className="flex w-8 flex-col justify-end flex-shrink-0 pb-[18px]">
          {showAvatar && (
            avatarUrl ? (
              <img
                src={avatarUrl}
                alt="avatar"
                className={cn("h-8 w-8 rounded-full object-cover", onAvatarClick && "cursor-pointer active:opacity-75")}
                onClick={onAvatarClick}
              />
            ) : (
              <div 
                className={cn("h-8 w-8 rounded-full bg-gray-200 dark:bg-[#333] flex items-center justify-center text-[12px] font-bold text-gray-500 dark:text-gray-400", onAvatarClick && "cursor-pointer active:opacity-75")}
                onClick={onAvatarClick}
              >
                {senderName ? senderName.charAt(0).toUpperCase() : '?'}
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

