
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
    <div className={cn("flex w-full items-end gap-2 p-3", className)}>
      <div className="flex min-h-[48px] flex-1 items-center rounded-3xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#1A1A1A] px-4 focus-within:border-[var(--color-action-primary)] shadow-sm overflow-hidden">
        <textarea
          value={value}
          onChange={(e) => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            onChange(e.target.value);
          }}
          rows={1}
          placeholder="Écrire un message..."
          className="flex-1 bg-transparent py-[13px] font-poppins text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none min-w-0 resize-none overflow-y-auto no-scrollbar"
          style={{ height: '48px' }}
        />
        <div className="flex items-center gap-3 text-gray-400 pl-2 pb-1">
          <button onClick={onAttach} className="hover:text-[var(--color-action-primary)] focus:outline-none transition-colors">
            <Paperclip width={22} height={22} strokeWidth={1.5} />
          </button>
          {!hasContent && (
            <button onClick={onCamera} className="hover:text-[var(--color-action-primary)] focus:outline-none transition-colors">
              <Camera width={22} height={22} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>
      
      <button
        onClick={hasContent ? onSend : onMic}
        className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-[var(--color-action-primary)] text-white shadow-sm transition-transform hover:scale-105 active:scale-95 focus:outline-none ml-1"
      >
        {hasContent ? <Send width={22} height={22} strokeWidth={1.5} /> : <Mic width={22} height={22} strokeWidth={1.5} />}
      </button>
    </div>
  )
}
