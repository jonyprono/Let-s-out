import { createPortal } from 'react-dom'
import { Loader2, Trash2 } from 'lucide-react'
import { BottomSheet } from '@/components/ui/bottom-sheet'

export interface ConfirmSheetProps {
  open: boolean
  title: string
  description: string
  confirmText: string
  cancelText: string
  /** Action en cours : boutons désactivés, la feuille ne se ferme pas */
  isPending?: boolean
  onConfirm: () => void
  onClose: () => void
}

/**
 * Confirmation d'une action destructive, en feuille du bas Let's Out (remplace window.confirm).
 * Rendue dans <body> et au-dessus des lecteurs plein écran (z-[100]) : jamais rognée ni masquée
 * par un conteneur parent. Textes fournis par l'appelant (i18n).
 */
export function ConfirmSheet({ open, title, description, confirmText, cancelText, isPending = false, onConfirm, onClose }: ConfirmSheetProps) {
  if (!open) return null
  return createPortal(
    <BottomSheet open={open} onClose={() => { if (!isPending) onClose() }} overlayClassName="z-[200]">
      <div className="flex flex-col items-center text-center" role="alertdialog" aria-modal="true" aria-labelledby="confirm-sheet-title" aria-describedby="confirm-sheet-desc">
        <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-500 flex items-center justify-center mb-4">
          <Trash2 className="w-7 h-7" aria-hidden="true" />
        </div>
        <h3 id="confirm-sheet-title" className="text-[18px] font-bold text-gray-900 dark:text-white mb-2 leading-snug">
          <span>{title}</span>
        </h3>
        <p id="confirm-sheet-desc" className="text-[14px] text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
          <span>{description}</span>
        </p>
        <div className="flex gap-3 w-full">
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="flex-1 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-semibold text-[15px] active:scale-95 transition-transform disabled:opacity-50"
          >
            <span>{cancelText}</span>
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="flex-1 h-12 rounded-2xl bg-red-500 text-white font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </BottomSheet>,
    document.body,
  )
}
