import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import type { Event } from '@/features/events/api'
import {
  getPoolMode,
  getFixedContributionAmount,
  validateContributionAmount,
  getInitialContributionInput,
  POOL_MODE_LABELS,
} from '@/lib/pool-contribution'

interface ContributeModalProps {
  event: Event
  onClose: () => void
  onConfirm: (amount: number) => void
}

export function ContributeModal({ event, onClose, onConfirm }: ContributeModalProps) {
  const mode = getPoolMode(event)
  const isFixed = mode === 'fixe'
  const isMinimum = mode === 'minimum'
  const fixedAmount = getFixedContributionAmount(event)
  const minAmount = event.poolMinAmount

  const [amount, setAmount] = useState(() => getInitialContributionInput(event))

  useEffect(() => {
    setAmount(getInitialContributionInput(event))
  }, [event.id, event.poolMode, event.poolMinAmount])

  const handleConfirm = () => {
    const parsed = isFixed && fixedAmount ? fixedAmount : parseInt(amount, 10)
    const result = validateContributionAmount(event, parsed)
    if (!result.valid) {
      toast.error(result.error)
      return
    }
    onConfirm(parsed)
  }

  return (
    <div className="absolute inset-0 z-50 bg-black/40 flex items-end justify-center">
      <div className="w-full bg-white dark:bg-[#1A1A1A] rounded-t-[32px] shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 pt-safe-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] font-bold text-gray-900 dark:text-white">Contribuer à la cagnotte</span>
            <span className="text-[11px] bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 font-bold px-2 py-0.5 rounded-full">
              {POOL_MODE_LABELS[mode]}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#2a2a2a] flex items-center justify-center touch-sm"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        <div className="px-5 pt-4" style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))' }}>
          {isFixed && fixedAmount ? (
            <div className="mb-4 p-3 bg-orange-50 rounded-xl border border-orange-100">
              <p className="text-[13px] text-action-primary font-medium">
                Montant fixe — vous allez payer{' '}
                <strong>{fixedAmount.toLocaleString('fr-FR')} F CFA</strong> (non modifiable).
              </p>
            </div>
          ) : isMinimum && minAmount ? (
            <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-[13px] text-blue-600 font-medium">
                Montant minimum : <strong>{Number(minAmount).toLocaleString('fr-FR')} F CFA</strong>. Vous pouvez contribuer plus.
              </p>
            </div>
          ) : (
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-4">
              Saisissez le montant de votre choix pour soutenir cet événement.
            </p>
          )}

          {isFixed && fixedAmount ? (
            <div className="flex gap-2 items-center mb-6">
              <div className="flex-1 px-4 py-3.5 border border-gray-200 dark:border-white/10 rounded-xl text-[16px] font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-[#222222] text-center">
                {fixedAmount.toLocaleString('fr-FR')}
              </div>
              <div className="px-3 py-3.5 border border-gray-200 dark:border-white/10 rounded-xl text-[14px] font-bold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-[#222222]">
                F CFA
              </div>
            </div>
          ) : (
            <div className="flex gap-2 items-center mb-6">
              <input
                type="number"
                inputMode="numeric"
                min={isMinimum && minAmount ? Number(minAmount) : 1}
                autoFocus
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder={isMinimum && minAmount ? `Min. ${Number(minAmount).toLocaleString('fr-FR')}` : 'Ex: 5000'}
                className="flex-1 px-4 py-3.5 border border-gray-200 dark:border-white/10 rounded-xl text-[16px] font-semibold focus:outline-none focus:border-action-primary text-gray-900 dark:text-white transition-colors"
              />
              <div className="px-3 py-3.5 border border-gray-200 dark:border-white/10 rounded-xl text-[14px] font-bold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-[#222222]">
                F CFA
              </div>
            </div>
          )}

          <button
            onClick={handleConfirm}
            className="w-full bg-action-primary text-white py-4 rounded-full font-bold text-[16px] active:scale-[0.98] transition-transform shadow-md"
          >
            {isFixed ? `Payer ${(fixedAmount ?? 0).toLocaleString('fr-FR')} F CFA` : 'Procéder au paiement'}
          </button>
        </div>
      </div>
    </div>
  )
}
