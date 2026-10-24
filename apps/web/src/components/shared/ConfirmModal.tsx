import { Trash2, AlertTriangle, HelpCircle, Loader2 } from 'lucide-react'

export interface ConfirmModalProps {
  open: boolean
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'primary'
  isPending?: boolean
  onConfirm: () => void | Promise<void>
  onClose: () => void
}

export function ConfirmModal({
  open,
  title = 'Confirmation requise',
  description = 'Êtes-vous sûr de vouloir effectuer cette action ?',
  confirmText = 'Oui, confirmer',
  cancelText = 'Non, annuler',
  variant = 'danger',
  isPending = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1A1A1A] w-full max-w-sm sm:max-w-md rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm ${
            variant === 'danger'
              ? 'bg-red-100 dark:bg-red-950/50 text-red-500'
              : variant === 'warning'
              ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-500'
              : 'bg-orange-100 dark:bg-orange-950/50 text-[#FF7A00]'
          }`}
        >
          {variant === 'danger' ? (
            <Trash2 className="w-7 h-7" />
          ) : variant === 'warning' ? (
            <AlertTriangle className="w-7 h-7" />
          ) : (
            <HelpCircle className="w-7 h-7" />
          )}
        </div>

        {/* Title */}
        <h3 className="text-[18px] font-bold text-gray-900 dark:text-white mb-2 leading-snug">
          {title}
        </h3>

        {/* Description */}
        <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
          {description}
        </p>

        {/* Actions */}
        <div className="flex gap-3 w-full">
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="flex-1 h-12 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold text-sm transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className={`flex-1 h-12 rounded-2xl active:scale-95 text-white font-semibold text-sm shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
              variant === 'danger'
                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                : 'bg-[#FF7A00] hover:bg-[#E06C00] shadow-[#FF7A00]/20'
            }`}
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
