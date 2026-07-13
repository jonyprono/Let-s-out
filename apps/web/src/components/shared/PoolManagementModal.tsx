import { X, Briefcase } from 'lucide-react'
import type { Event } from '@/features/events/api'
import {
  computePoolStats,
  getPoolMode,
  getFixedContributionAmount,
  POOL_MODE_LABELS,
} from '@/lib/pool-contribution'

interface PoolManagementModalProps {
  event: Event
  isCreator?: boolean
  isCoHost?: boolean
  currentUserId?: string
  onClose: () => void
  onReleaseFunds?: () => void
  onApproveFunds?: () => void
  isApproving?: boolean
}

export function PoolManagementModal({
  event,
  isCreator,
  isCoHost,
  currentUserId,
  onClose,
  onReleaseFunds,
  onApproveFunds,
  isApproving,
}: PoolManagementModalProps) {
  const { budget, collected, remaining, progress } = computePoolStats(event)
  const mode = getPoolMode(event)
  const fixedAmount = getFixedContributionAmount(event)

  return (
    <div className="absolute inset-0 z-50 bg-black/40 flex items-end justify-center">
      <div className="w-full bg-white dark:bg-[#1A1A1A] rounded-t-[24px] shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/10 flex-shrink-0 pt-safe-2">
          <span className="text-[16px] font-bold text-gray-900 dark:text-white">Gestion de la cagnotte</span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#2a2a2a] flex items-center justify-center touch-sm"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5" style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))' }}>
          <div className="rounded-[16px] bg-gray-50 dark:bg-[#222222] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[15px] text-gray-900 dark:text-white font-medium">Objectif</span>
              <span className="text-[15px] font-bold text-blue-600">{budget.toLocaleString('fr-FR')} F CFA</span>
            </div>
            <div className="border-t border-dashed border-gray-200 dark:border-white/10" />
            <div className="flex items-center justify-between">
              <span className="text-[15px] text-gray-600 dark:text-gray-300 font-medium">Progression</span>
              <span className="px-2 py-0.5 bg-[var(--color-action-primary)] text-white text-[12px] font-bold rounded-md">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full bg-[var(--color-action-primary)]" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[15px] text-gray-600 dark:text-gray-300 font-medium">Collecté</span>
              <span className="text-[15px] font-bold text-[#10B981]">{collected.toLocaleString('fr-FR')} F</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[15px] text-gray-600 dark:text-gray-300 font-medium">Restant</span>
              <span className="text-[15px] font-bold text-[var(--color-action-primary)]">{remaining.toLocaleString('fr-FR')} F</span>
            </div>
          </div>

          <div className="rounded-[16px] border border-gray-100 dark:border-white/10 p-4 space-y-2">
            <p className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Mode de contribution</p>
            <p className="text-[15px] font-bold text-gray-900 dark:text-white">{POOL_MODE_LABELS[mode]}</p>
            {mode === 'minimum' && event.poolMinAmount ? (
              <p className="text-[13px] text-gray-500 dark:text-gray-400">
                Minimum : <strong>{Number(event.poolMinAmount).toLocaleString('fr-FR')} F CFA</strong>
              </p>
            ) : null}
            {mode === 'fixe' && fixedAmount ? (
              <p className="text-[13px] text-gray-500 dark:text-gray-400">
                Montant par contribution : <strong>{fixedAmount.toLocaleString('fr-FR')} F CFA</strong>
              </p>
            ) : null}
            {mode === 'libre' ? (
              <p className="text-[13px] text-gray-500 dark:text-gray-400">Chaque participant choisit le montant de sa contribution.</p>
            ) : null}
          </div>

          {event.poolReleased && (
            <p className="text-[13px] text-center text-[#10B981] bg-[#10B981]/10 rounded-xl py-3 px-4 font-medium">
              Les fonds de cette cagnotte ont été débloqués et transférés.
            </p>
          )}

          {event.payoutRequest && event.payoutRequest.status === 'PENDING' && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
              <p className="text-[13px] text-amber-800 dark:text-amber-300 text-center font-medium">
                Demande de déblocage en attente d'approbation par les validateurs.
              </p>
              {isCoHost && currentUserId && !event.payoutRequest.approvals.includes(currentUserId) && (
                <button
                  onClick={onApproveFunds}
                  disabled={isApproving}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-[12px] text-[14px] font-bold flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
                >
                  Approuver le déblocage
                </button>
              )}
              {isCoHost && currentUserId && event.payoutRequest.approvals.includes(currentUserId) && (
                <p className="text-[12px] text-center text-amber-600 dark:text-amber-400">
                  Vous avez déjà approuvé cette demande.
                </p>
              )}
            </div>
          )}

          {isCreator && onReleaseFunds && !event.poolReleased && (!event.payoutRequest || event.payoutRequest.status !== 'PENDING') && (
            <button
              onClick={onReleaseFunds}
              className="w-full py-3.5 border border-[var(--color-action-primary)] text-[var(--color-action-primary)] rounded-[12px] text-[14px] font-bold flex justify-center items-center gap-2 bg-white dark:bg-[#1A1A1A] active:scale-95 transition-transform"
            >
              <Briefcase className="w-4 h-4" />
              Demander le déblocage des fonds
            </button>
          )}

          {isCreator && event.payoutRequest?.status === 'PENDING' && (
            <button
              disabled
              className="w-full py-3.5 border border-gray-300 text-gray-500 rounded-[12px] text-[14px] font-bold flex justify-center items-center gap-2 bg-gray-100 dark:bg-[#2A2A2A] dark:border-gray-700 cursor-not-allowed"
            >
              <Briefcase className="w-4 h-4" />
              Déblocage en cours...
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
