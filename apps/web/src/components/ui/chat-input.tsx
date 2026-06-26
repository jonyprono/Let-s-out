
import { cn } from "@/lib/utils"
import { AttachmentIcon as Paperclip, Camera01Icon as Camera, Mic01Icon as Mic, SentIcon as Send } from "hugeicons-react"

export interface ChatInputProps {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  onAttach?: () => void;
  onCamera?: () => void;
  onMic?: () => void;
  className?: string;
}

export function ChatInput({ value, onChange, onSend, onAttach, onCamera, onMic, className }: ChatInputProps) {
  const hasContent = value.trim().length > 0;

  return (
    <div className={cn("flex w-full items-end gap-[var(--spacing-150)] p-[var(--spacing-200)]", className)}>
      <div className="flex min-h-[48px] flex-1 items-center rounded-full border border-[var(--border-default)] bg-[var(--color-background-primary)] px-[var(--spacing-200)] focus-within:border-[var(--border-brand-primary)]">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Écrire un message..."
          className="flex-1 bg-transparent py-3 font-poppins text-[var(--font-size-body-medium)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && hasContent) {
              onSend();
            }
          }}
        />
        <div className="flex items-center gap-[var(--spacing-150)] text-[var(--color-icon-secondary)]">
          <button onClick={onAttach} className="hover:text-[var(--color-icon-primary)] focus:outline-none">
            <Paperclip width={24} height={24} strokeWidth={1.5} />
          </button>
          {!hasContent && (
            <button onClick={onCamera} className="hover:text-[var(--color-icon-primary)] focus:outline-none">
              <Camera width={24} height={24} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>
      
      <button
        onClick={hasContent ? onSend : onMic}
        className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-[var(--color-action-primary)] text-white shadow-sm transition-transform hover:scale-105 active:scale-95 focus:outline-none"
      >
        {hasContent ? <Send width={24} height={24} strokeWidth={1.5} /> : <Mic width={24} height={24} strokeWidth={1.5} />}
      </button>
    </div>
  )
}
