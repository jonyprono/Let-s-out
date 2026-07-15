import { useState } from 'react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface ReportModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  isPending?: boolean
  type?: 'USER' | 'GROUP_OR_CHAT'
}

export function ReportModal({ open, onClose, onConfirm, isPending, type = 'USER' }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('')

  const allReasons = [
    { value: 'SPAM', label: 'Spam ou publicité non sollicitée', types: ['USER', 'GROUP_OR_CHAT'] },
    { value: 'INAPPROPRIATE', label: 'Contenu inapproprié ou offensant', types: ['USER', 'GROUP_OR_CHAT'] },
    { value: 'FAKE', label: 'Faux profil ou usurpation d\'identité', types: ['USER'] },
    { value: 'HARASSMENT', label: 'Harcèlement ou intimidation', types: ['USER', 'GROUP_OR_CHAT'] },
    { value: 'SCAM', label: 'Arnaque ou escroquerie', types: ['USER', 'GROUP_OR_CHAT'] },
    { value: 'HATE_SPEECH', label: 'Discours de haine', types: ['USER', 'GROUP_OR_CHAT'] },
    { value: 'OTHER', label: 'Autre raison', types: ['USER', 'GROUP_OR_CHAT'] }
  ]

  const reasons = allReasons.filter(r => r.types.includes(type))

  const handleConfirm = () => {
    if (selectedReason) {
      onConfirm(selectedReason)
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="p-4 sm:p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1 items-center mb-2">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center mb-2">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center">Signaler</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center px-4">
            Aidez-nous à garder Let's Out sûr en nous indiquant ce qui ne va pas.
          </p>
        </div>

        <div className="flex flex-col gap-2 mt-2">
          {reasons.map((reason) => (
            <button
              key={reason.value}
              onClick={() => setSelectedReason(reason.value)}
              className={`flex items-center justify-between p-4 rounded-2xl border transition-colors ${
                selectedReason === reason.value
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                  : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#18181b] hover:bg-gray-50 dark:hover:bg-[#202022]'
              }`}
            >
              <span className={`text-sm font-medium text-left flex-1 pr-4 ${selectedReason === reason.value ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                {reason.label}
              </span>
              <div className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center ${
                selectedReason === reason.value ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
              }`}>
                {selectedReason === reason.value && <div className="w-2.5 h-2.5 rounded-full bg-red-500" />}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 pb-8 flex gap-3">
          <Button 
            variant="outline" 
            onClick={onClose} 
            className="flex-1 h-12 rounded-2xl text-gray-700 dark:text-gray-300"
            disabled={isPending}
          >
            Annuler
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!selectedReason || isPending}
            className="flex-1 h-12 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-medium disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Envoyer'}
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
