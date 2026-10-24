import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ReportModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  isPending?: boolean
  type?: 'USER' | 'GROUP_OR_CHAT'
}

export function ReportModal({ open, onClose, onConfirm, isPending, type = 'USER' }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('')

  if (!open) return null

  const allReasons = [
    { value: 'SPAM', label: 'Spam ou publicité non sollicitée', types: ['USER', 'GROUP_OR_CHAT'] },
    { value: 'INAPPROPRIATE', label: 'Contenu inapproprié ou offensant', types: ['USER', 'GROUP_OR_CHAT'] },
    { value: 'FAKE', label: "Faux profil ou usurpation d'identité", types: ['USER'] },
    { value: 'HARASSMENT', label: 'Harcèlement ou intimidation', types: ['USER', 'GROUP_OR_CHAT'] },
    { value: 'SCAM', label: 'Arnaque ou escroquerie', types: ['USER', 'GROUP_OR_CHAT'] },
    { value: 'HATE_SPEECH', label: 'Discours de haine', types: ['USER', 'GROUP_OR_CHAT'] },
    { value: 'OTHER', label: 'Autre raison', types: ['USER', 'GROUP_OR_CHAT'] }
  ]

  const reasons = allReasons.filter(r => r.types.includes(type))

  const handleCancel = () => {
    toast.info('Signalement annulé')
    onClose()
  }

  const handleConfirm = () => {
    if (selectedReason) {
      onConfirm(selectedReason)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleCancel}
    >
      <div
        className="bg-white dark:bg-[#1A1A1A] w-full max-w-sm sm:max-w-md max-h-[85vh] rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col gap-1 items-center mb-3 text-center shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/40 text-red-600 flex items-center justify-center mb-2 shadow-sm">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Signaler</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
            Aidez-nous à garder Let's Out sûr en nous indiquant ce qui ne va pas.
          </p>
        </div>

        {/* Reasons list (scrollable) */}
        <div className="flex flex-col gap-2 overflow-y-auto pr-1 my-2 flex-1" style={{ scrollbarWidth: 'none' }}>
          {reasons.map((reason) => (
            <button
              type="button"
              key={reason.value}
              onClick={() => setSelectedReason(reason.value)}
              className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left active:scale-[0.99] ${
                selectedReason === reason.value
                  ? 'border-red-500 bg-red-50/80 dark:bg-red-900/20'
                  : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#202022] hover:bg-gray-100 dark:hover:bg-[#252528]'
              }`}
            >
              <span className={`text-xs font-semibold flex-1 pr-3 ${selectedReason === reason.value ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                {reason.label}
              </span>
              <div className={`w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                selectedReason === reason.value ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
              }`}>
                {selectedReason === reason.value && <div className="w-2 h-2 rounded-full bg-red-500" />}
              </div>
            </button>
          ))}
        </div>

        {/* Buttons */}
        <div className="mt-4 flex gap-3 shrink-0">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="flex-1 h-12 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold text-xs transition-all active:scale-95 disabled:opacity-50"
          >
            Non, annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedReason || isPending}
            className="flex-1 h-12 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-semibold text-xs shadow-md shadow-red-500/20 active:scale-95 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Oui, signaler'}
          </button>
        </div>
      </div>
    </div>
  )
}
