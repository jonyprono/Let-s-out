import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import type { Event } from '@/features/events/api'

interface ContributeModalProps {
  event: Event
  onClose: () => void
  onConfirm: (amount: number) => void
}

export function ContributeModal({ event, onClose, onConfirm }: ContributeModalProps) {
  const poolMode = event.poolMode || 'libre'
  const poolMinAmount = event.poolMinAmount
  const isFixed = poolMode === 'fixe'
  const isMinimum = poolMode === 'minimum'

  const [amount, setAmount] = useState('')

  useEffect(() => {
    if (isFixed && poolMinAmount) {
      setAmount(String(poolMinAmount))
    } else {
      setAmount('')
    }
  }, [event.id, isFixed, poolMinAmount])

  const handleConfirm = () => {
    const value = parseInt(amount, 10)
    if (isNaN(value) || value <= 0) {
      toast.error('Veuillez entrer un montant valide (supérieur à 0)')
      return
    }
    if (isFixed && poolMinAmount && value !== poolMinAmount) {
      toast.error(`Le montant fixe est de ${Number(poolMinAmount).toLocaleString()} F CFA`)
      return
    }
    if (isMinimum && poolMinAmount && value < poolMinAmount) {
      toast.error(`Le montant minimum est de ${Number(poolMinAmount).toLocaleString()} F CFA`)
      return
    }
    onConfirm(value)
  }

  return (
    <div className="absolute inset-0 z-50 bg-black/40 flex items-end justify-center">
      <div className="w-full bg-white rounded-t-[32px] shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 pt-safe-2">
          <div>
            <span className="text-[16px] font-bold text-gray-900">Contribuer à la cagnotte</span>
            {isFixed && (
              <span className="ml-2 text-[11px] bg-orange-50 text-[#FF9F1C] font-bold px-2 py-0.5 rounded-full border border-orange-100">Montant fixe</span>
            )}
            {isMinimum && (
              <span className="ml-2 text-[11px] bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full border border-blue-100">Montant minimum</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="px-5 pt-4" style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))' }}>
          {isFixed && poolMinAmount ? (
            <div className="mb-4 p-3 bg-orange-50 rounded-xl border border-orange-100">
              <p className="text-[13px] text-[#FF9F1C] font-medium">
                Montant fixe — {Number(poolMinAmount).toLocaleString()} F CFA (non modifiable).
              </p>
            </div>
          ) : isMinimum && poolMinAmount ? (
            <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-[13px] text-blue-600 font-medium">
                Montant minimum : <strong>{Number(poolMinAmount).toLocaleString()} F CFA</strong>. Vous pouvez contribuer plus.
              </p>
            </div>
          ) : (
            <p className="text-[13px] text-gray-500 mb-4">
              Saisissez le montant de votre choix pour soutenir cet événement.
            </p>
          )}
          <div className="flex gap-2 items-center mb-6">
            <input
              type="number"
              min={isMinimum && poolMinAmount ? Number(poolMinAmount) : 1}
              autoFocus
              readOnly={isFixed}
              value={amount}
              onChange={e => !isFixed && setAmount(e.target.value)}
              placeholder={isMinimum && poolMinAmount ? `Min. ${Number(poolMinAmount).toLocaleString()}` : 'Ex: 5000'}
              className={`flex-1 px-4 py-3.5 border rounded-xl text-[16px] font-semibold focus:outline-none transition-colors ${
                isFixed
                  ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed'
                  : 'border-gray-200 focus:border-[#FF9F1C] text-gray-900'
              }`}
            />
            <div className="px-3 py-3.5 border border-gray-200 rounded-xl text-[14px] font-bold text-gray-600 bg-gray-50">
              F CFA
            </div>
          </div>
          <button
            onClick={handleConfirm}
            className="w-full bg-[#FF9F1C] text-white py-4 rounded-full font-bold text-[16px] active:scale-[0.98] transition-transform shadow-md"
          >
            Procéder au paiement
          </button>
        </div>
      </div>
    </div>
  )
}
