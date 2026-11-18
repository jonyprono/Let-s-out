
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
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

/**
 * Géométrie verticale figée : 13px + 22px (line-height explicite) + 13px = 48px.
 * Avant, la ligne héritait de line-height 1.5 (= 24px) dans une boîte de 48px avec
 * 26px de padding : il ne restait que 22px pour une ligne de 24px → bas du texte
 * et du placeholder rognés (visible surtout sur iOS / WebKit).
 */
const LINE_HEIGHT_PX = 22
const SINGLE_LINE_HEIGHT_PX = 48
const MAX_HEIGHT_PX = 120

export function ChatInput({ value, onChange, onSend, onAttach, onCamera, onMic, className }: ChatInputProps) {
  const { t } = useTranslation()
  const hasContent = value.trim().length > 0;
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Après l'envoi (valeur vidée par le parent), la zone revient à une seule ligne.
  useEffect(() => {
    if (value === '' && textareaRef.current) {
      textareaRef.current.style.height = `${SINGLE_LINE_HEIGHT_PX}px`
    }
  }, [value])

  return (
    <div className={cn("flex w-full items-end gap-2 p-3", className)}>
      <div className="flex min-h-[48px] flex-1 items-center rounded-3xl border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#1A1A1A] px-4 focus-within:border-[var(--color-action-primary)] shadow-sm overflow-hidden">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.max(SINGLE_LINE_HEIGHT_PX, Math.min(e.target.scrollHeight, MAX_HEIGHT_PX)) + 'px';
            onChange(e.target.value);
          }}
          rows={1}
          placeholder={t('chatDetails.ecrireUnMessage')}
          className="flex-1 appearance-none bg-transparent py-[13px] font-poppins text-[16px] text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none min-w-0 resize-none overflow-y-auto no-scrollbar"
          style={{ height: `${SINGLE_LINE_HEIGHT_PX}px`, lineHeight: `${LINE_HEIGHT_PX}px` }}
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
