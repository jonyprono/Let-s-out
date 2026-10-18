import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, ChevronLeft, EyeOff } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { eventsApi } from '@/features/events/api'
import { chatApi } from '@/features/chat/api'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  isContributionPayment,
  applyPoolContributionOptimistic,
} from '@/lib/pool-contribution'
import { PaymentFlow } from '@/components/shared/PaymentFlow'

const parseSafeDate = (dateStr: any): Date => {
  if (!dateStr) return new Date()
  const d = new Date(dateStr)
  if (!isNaN(d.getTime())) return d
  return new Date()
}

export function PaymentPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()

  const amountParam = searchParams.get('amount')
  const typeParam = searchParams.get('type')
  const rawAmount = amountParam ? Number(amountParam) : undefined

  const [resolvedAmount, setResolvedAmount] = useState<number | null>(null)
  const [paymentKey, setPaymentKey] = useState(0)
  // ── État anonymat ───────────────────────────────────────────────────────────────────────────────────────────
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isNonParticipantDonation, setIsNonParticipantDonation] = useState(false)

  const handleReset = () => {
    setResolvedAmount(null)
    setPaymentKey(prev => prev + 1)
    setIsAnonymous(false)
    setIsNonParticipantDonation(false)
  }

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['events', eventId],
    queryFn: () => eventsApi.getById(eventId!).then((r) => r.data),
    enabled: !!eventId,
  })

  const isContribution = isContributionPayment(amountParam, event, typeParam)
  // FedaPay minimum is 100 F — apply for all contributions when no poolMinAmount set
  const minAmount = isContribution
    ? Math.max(100, event?.poolMinAmount || 100)
    : Math.max(100, event?.price || 100)

  const defaultAmount = isContribution
    ? rawAmount ? String(rawAmount) : (event?.poolMinAmount ? String(event.poolMinAmount) : '')
    : event?.price ? String(event.price) : ''

  // ── API handlers ────────────────────────────────────────────
  const handleInitiate = async (amount: number) => {
    const payload: {
      eventId: string
      amount?: number
      isAnonymous?: boolean
      isNonParticipantDonation?: boolean
    } = { eventId: eventId!, amount, isAnonymous, isNonParticipantDonation }
    const { data } = await apiClient.post('/payments/fedapay/initiate', payload)
    return data
  }

  const handleDevConfirm = async (amount: number) => {
    const payload: {
      eventId: string
      amount?: number
      isAnonymous?: boolean
      isNonParticipantDonation?: boolean
    } = { eventId: eventId!, amount, isAnonymous, isNonParticipantDonation }
    await apiClient.post('/payments/dev/confirm-booking', payload)
  }

  const handleSuccess = async (amount: number, isSandbox?: boolean) => {
    setResolvedAmount(amount)
    // Apply optimistic update immediately so UI reflects change
    if (isContribution && eventId) {
      applyPoolContributionOptimistic(qc, eventId, amount)
    }
    // Sync the transaction with our backend
    if (eventId) {
      if (isSandbox) {
        try {
          await apiClient.post('/payments/dev/confirm-booking', {
            eventId, amount, isAnonymous, isNonParticipantDonation
          })
        } catch (confirmErr) {
          console.warn('Dev confirm failed', confirmErr)
          throw new Error("Impossible de valider le paiement Sandbox. Assurez-vous d'avoir déployé le backend.")
        }
      } else {
        try {
          await apiClient.post('/payments/sync-missed', { eventId })
        } catch (syncErr) {
          console.warn('sync-missed failed', syncErr)
          throw new Error('La synchronisation du paiement a échoué. Le webhook prendra le relais.')
        }
      }
    }
    // Force re-fetch all relevant data
    await qc.invalidateQueries({ queryKey: ['chat'] })
    await qc.invalidateQueries({ queryKey: ['events', eventId] })
    await qc.invalidateQueries({ queryKey: ['events', eventId, 'my-booking'] })
    qc.invalidateQueries({ queryKey: ['events'] })
    toast.success(
      isNonParticipantDonation
        ? 'Don enregistré avec succès ! Merci pour votre générosité.'
        : isContribution
          ? 'Contribution enregistrée avec succès !'
          : "Paiement réussi ! Vous participez à l'événement",
    )
  }

  const handleOpenChat = async () => {
    if (!eventId) return
    try {
      const conv = await chatApi.getEventConversation(eventId)
      navigate(`/chat/${conv.id}`)
    } catch (err) {
      toast.error('Impossible de charger le chat. Réessayez.')
      navigate(`/events/${eventId}`)
    }
  }

  // ── Loading ──────────────────────────────────────────────────
  if (eventLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white dark:bg-[#1A1A1A]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF7A00]" />
      </div>
    )
  }

  // ── Header card (rendered inside PaymentFlow) ────────────────
  const headerCard = isContribution ? (
    <div className="w-full bg-[#FAFAFA] dark:bg-[#222] rounded-[12px] p-4 mb-6 mt-2 border border-gray-100 dark:border-gray-800">
      <h1 className="text-[16px] font-semibold text-gray-900 dark:text-white mb-3">{event?.title}</h1>
      <div className="border-t border-dashed border-gray-200 dark:border-gray-700 w-full mb-3" />
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-gray-600 dark:text-gray-400">Contribution</span>
        <span className="text-[13px] font-semibold text-[#007AFF]">
          {event?.poolMode === 'fixe'
            ? 'Montant fixe'
            : event?.poolMode === 'minimum'
            ? 'Montant minimum'
            : 'Montant libre'}
        </span>
      </div>
    </div>
  ) : (
    <>
      <h1 className="text-[20px] font-bold text-gray-900 dark:text-white mt-2 mb-2">{event?.title}</h1>
      <div className="flex items-center justify-between py-3 border-b border-[#F0F0F0] mb-5">
        <span className="text-[13px] text-[#8D8D8D]">Participation</span>
        <span className="text-[13px] font-semibold text-[#FF7A00]">
          A partir de {minAmount > 0 ? `${minAmount.toLocaleString()}F` : 'Gratuit'}
        </span>
      </div>
    </>
  )

  // ── Summary subtitle rendered inside PaymentFlow ─────────────
  const summarySubtitle = event?.startAt ? (() => {
    const d = parseSafeDate(event.startAt)
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
    const endD = event.endAt ? parseSafeDate(event.endAt) : null
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}${endD ? ` - ${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}` : ''}`
  })() : undefined

  // ── Bloc anonymat (rendu dans le formulaire de PaymentFlow) ──────────────
  // Visible uniquement pour les contributions à une cagnotte
  const anonymityBlock = isContribution ? (
    <div className="mb-5 rounded-[14px] border border-gray-100 dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1E1E1E] p-4 space-y-3">
      {/* Toggle : anonymat */}
      <button
        id="toggle-anonymous"
        type="button"
        onClick={() => setIsAnonymous(v => !v)}
        className="w-full flex items-start gap-3 text-left"
      >
        <div className={`mt-0.5 w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          isAnonymous ? 'bg-[#FF7A00]/10' : 'bg-gray-100 dark:bg-white/5'
        }`}>
          <EyeOff className={`w-4 h-4 transition-colors ${
            isAnonymous ? 'text-[#FF7A00]' : 'text-gray-400'
          }`} />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-gray-900 dark:text-white leading-snug">
            Contribuer anonymement
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed mt-0.5">
            Votre nom ne sera pas affiché publiquement.
            L'administration de Let's Out conserve votre identité conformément aux CGU.
          </p>
        </div>
        <div
          aria-checked={isAnonymous}
          role="switch"
          className={`mt-1 shrink-0 w-11 h-6 rounded-full transition-colors duration-200 relative ${
            isAnonymous ? 'bg-[#FF7A00]' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          <span className={`absolute top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow transition-transform duration-200 ${
            isAnonymous ? 'translate-x-[22px]' : 'translate-x-[3px]'
          }`} />
        </div>
      </button>

      {/* Séparateur */}
      <div className="border-t border-dashed border-gray-200 dark:border-gray-700" />

      {/* Toggle : donner sans rejoindre */}
      <button
        id="toggle-non-participant"
        type="button"
        onClick={() => setIsNonParticipantDonation(v => !v)}
        className="w-full flex items-start gap-3 text-left"
      >
        <div className={`mt-0.5 w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          isNonParticipantDonation ? 'bg-[#007AFF]/10' : 'bg-gray-100 dark:bg-white/5'
        }`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill={isNonParticipantDonation ? '#007AFF' : 'none'}
              stroke={isNonParticipantDonation ? '#007AFF' : '#9CA3AF'}
              strokeWidth="1.5"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-gray-900 dark:text-white leading-snug">
            Donner sans rejoindre l'événement
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed mt-0.5">
            Votre don est inclus dans la cagnotte mais vous ne devenez pas participant.
            Aucun droit de vote ou de validation.
          </p>
        </div>
        <div
          aria-checked={isNonParticipantDonation}
          role="switch"
          className={`mt-1 shrink-0 w-11 h-6 rounded-full transition-colors duration-200 relative ${
            isNonParticipantDonation ? 'bg-[#007AFF]' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          <span className={`absolute top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow transition-transform duration-200 ${
            isNonParticipantDonation ? 'translate-x-[22px]' : 'translate-x-[3px]'
          }`} />
        </div>
      </button>
    </div>
  ) : null

  // ── Success screens ──────────────────────────────────────────
  // ── Écran de succès pour un don direct (sans participation) ───────────────────────────────────────
  const DonationSuccessScreen = () => (
    <div className="w-full h-full bg-white dark:bg-[#1A1A1A] flex flex-col font-poppins">
      <div className="flex-shrink-0 px-5 pt-safe-4 pt-4 pb-3 flex items-center">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center active:scale-95">
          <ChevronLeft className="w-5 h-5 text-gray-900 dark:text-white" strokeWidth={2} />
        </button>
        <span className="flex-1 text-center text-[16px] font-semibold text-gray-900 dark:text-white -ml-9">
          Don envoyé
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 flex flex-col items-center" style={{ scrollbarWidth: 'none' }}>
        <div className="mt-10 mb-6">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, #007AFF, #5AC8FA)' }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                fill="white"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-[20px] font-bold text-[#007AFF] mb-2 text-center">Merci pour votre don !</h1>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 text-center mb-8 px-4 leading-relaxed max-w-[300px]">
          {isAnonymous
            ? 'Votre contribution anonyme a bien été reçue. Votre identité reste confidentielle.'
            : 'Votre don a été ajouté à la cagnotte. La communauté vous remercie !'}
        </p>

        <div className="w-full rounded-[16px] border border-gray-100 dark:border-white/5 bg-[#FAFAFA] dark:bg-[#222] p-5 shadow-sm max-w-[358px] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-gray-500">Montant donné</span>
            <span className="text-[14px] font-bold text-[#007AFF]">{resolvedAmount?.toLocaleString()} F CFA</span>
          </div>
          {isAnonymous && (
            <div className="flex items-center gap-2 bg-[#FF7A00]/8 rounded-[10px] px-3 py-2">
              <EyeOff className="w-4 h-4 text-[#FF7A00] shrink-0" />
              <span className="text-[12px] text-[#FF7A00] font-medium">Contribution anonyme</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-dashed border-gray-200 dark:border-gray-700 pt-3">
            <span className="text-[13px] text-gray-500">Événement</span>
            <span className="text-[13px] font-medium text-gray-900 dark:text-white text-right max-w-[180px] truncate">{event?.title}</span>
          </div>
        </div>
      </div>

      <div
        className="flex-shrink-0 bg-white dark:bg-[#1A1A1A] px-5 pt-3 border-t border-gray-100 dark:border-white/10 flex flex-col gap-3"
        style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
      >
        <Button
          onClick={handleReset}
          className="w-full font-semibold h-[52px]"
          style={{ background: 'linear-gradient(135deg, #007AFF, #5AC8FA)' }}
        >
          Faire un autre don
        </Button>
        <button
          onClick={() => navigate(`/events/${eventId}`)}
          className="w-full h-[52px] flex items-center justify-center gap-2 rounded-full font-semibold text-[15px] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] active:scale-[0.98] transition-transform"
        >
          Voir l'événement
        </button>
      </div>
    </div>
  )

  const ContributionSuccessScreen = () => {
    const target = event?.poolTarget || 0
    const previousCollected = event?.poolCollected || 0
    const totalCollected = previousCollected + (resolvedAmount || 0)
    const currentProgress = target > 0 ? (totalCollected / target) * 100 : 0
    const addedProgress = target > 0 ? ((resolvedAmount || 0) / target) * 100 : 0

    return (
      <div className="w-full h-full bg-white dark:bg-[#1A1A1A] flex flex-col font-poppins">
        <div className="flex-shrink-0 px-5 pt-safe-4 pt-4 pb-3 flex items-center">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center active:scale-95">
            <ChevronLeft className="w-5 h-5 text-gray-900 dark:text-white" strokeWidth={2} />
          </button>
          <span className="flex-1 text-center text-[16px] font-semibold text-gray-900 dark:text-white -ml-9">
            Contribuer à la cagnotte
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 flex flex-col items-center" style={{ scrollbarWidth: 'none' }}>
          <div className="mt-8 mb-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #4CD964, #34C759)' }}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <path d="M8 18L15 25L28 11" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <h1 className="text-[20px] font-bold text-[#22C55E] mb-2 text-center">Contribution envoyée !</h1>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 text-center mb-8 px-4 leading-relaxed max-w-[300px]">
            Top! Votre contribution a été bien envoyée. La cagnotte a progressé de {Math.round(addedProgress)}%. 🎉
          </p>

          <div className="w-full rounded-[16px] border border-gray-100 dark:border-white/5 bg-white dark:bg-[#1A1A1A] p-5 shadow-sm max-w-[358px]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[16px] font-bold text-[#FF7A00]">Cagnotte</span>
              <span className="text-[14px] font-bold text-[#22C55E]">
                {target > 0 ? target.toLocaleString() : totalCollected.toLocaleString()} F CFA
              </span>
            </div>
            <div className="border-t border-dashed border-gray-200 dark:border-gray-700 w-full mb-4" />
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-[6px] mb-6 overflow-hidden">
              <div className="bg-[#FF7A00] h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(currentProgress, 100)}%` }} />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-500 dark:text-gray-400">Votre contribution</span>
                <span className="text-[13px] font-semibold text-[#FF7A00]">{resolvedAmount?.toLocaleString()} F</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-500 dark:text-gray-400">Total collecté</span>
                <span className="text-[13px] font-semibold text-[#22C55E]">{totalCollected.toLocaleString()} F</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-500 dark:text-gray-400">Progression (+{Math.round(addedProgress)}%)</span>
                <span className="text-[12px] font-bold text-white bg-[#FF7A00] px-2 py-0.5 rounded-[4px]">{Math.round(currentProgress)}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 bg-white dark:bg-[#1A1A1A] px-5 pt-3 border-t border-gray-100 dark:border-white/10 flex flex-col gap-3" style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}>
          <Button
            onClick={handleReset}
            className="w-full font-semibold h-[52px]"
          >
            Contribuer à nouveau
          </Button>
          <button
            onClick={() => navigate(`/events/${eventId}/manage?tab=cagnotte`)}
            className="w-full h-[52px] flex items-center justify-center gap-2 rounded-full font-semibold text-[15px] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] active:scale-[0.98] transition-transform"
          >
            <ChevronLeft className="w-5 h-5" />
            Retour à l'événement
          </button>
        </div>
      </div>
    )
  }

  const JoinSuccessScreen = () => {
    const startDate = parseSafeDate(event?.startAt)
    return (
      <div className="w-full h-full bg-[#FAFAFA] dark:bg-[#1A1A1A] flex flex-col font-poppins relative">
        <div className="flex-1 overflow-y-auto px-5 pb-32 flex flex-col items-center justify-center" style={{ scrollbarWidth: 'none' }}>
          <div className="mb-4 mt-8">
            <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center relative shadow-sm">
              <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(243.43deg, #4DEF8E 16.67%, #FFEB3A 83.33%)' }} />
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="relative z-10">
                <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <h1 className="text-[20px] font-bold text-[#22C55E] mb-3 text-center">Participation validée !</h1>
          <p className="text-[13px] text-gray-600 dark:text-gray-400 text-center mb-8 px-2 max-w-[300px] leading-relaxed font-inter">
            Votre participation est confirmée pour cet événement. Rejoignez le groupe de discussion et découvrez les autres OUTSTERS.
          </p>

          <div className="w-full rounded-[12px] border border-gray-100 dark:border-white/10 bg-white dark:bg-[#1A1A1A] shadow-sm p-4 space-y-4 max-w-[340px]">
            <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">{event?.title}</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-500 dark:text-gray-400 font-inter">Date</span>
                <span className="text-[13px] font-medium text-gray-900 dark:text-white font-inter text-right">
                  {event?.startAt ? `${startDate.getDate()} ${['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][startDate.getMonth()]} ${startDate.getFullYear()}, ${String(startDate.getHours()).padStart(2,'0')}h` : '--'}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-[13px] text-gray-500 dark:text-gray-400 font-inter shrink-0">Lieu</span>
                <span className="text-[13px] font-medium text-gray-900 dark:text-white font-inter text-right">
                  {event?.city ? `${event.address ? event.address + ' ' : ''}(${event.city})` : 'Lieu non précisé'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-500 dark:text-gray-400 font-inter">Votre participation</span>
                <span className="text-[13px] font-medium text-gray-900 dark:text-white font-inter text-right">
                  {resolvedAmount ? `${resolvedAmount.toLocaleString()} F` : event?.price ? `${event.price.toLocaleString()} F` : 'Gratuit'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-[#FAFAFA] dark:bg-[#1A1A1A] px-5 pt-3 pb-8 flex flex-col gap-3">
          <Button onClick={handleOpenChat} className="w-full font-medium h-[48px] text-[14px]">
            Rejoindre le groupe
          </Button>
          <button onClick={() => navigate(`/events/${eventId}`)} className="w-full h-[48px] rounded-full font-medium text-[14px] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] active:scale-[0.98] transition-transform">
            Retour à l'événement
          </button>
        </div>
      </div>
    )
  }

  // ── Render PaymentFlow ───────────────────────────────────────
  return (
    <PaymentFlow
      key={paymentKey}
      headerTitle={
        isNonParticipantDonation
          ? 'Faire un don'
          : isContribution
            ? 'Contribuer à la cagnotte'
            : "Rejoindre l'événement"
      }
      headerCard={headerCard}
      minAmount={minAmount}
      defaultAmount={defaultAmount}
      formSubmitText={isNonParticipantDonation ? 'Donner' : isContribution ? 'Envoyer' : 'Rejoindre'}
      summaryTitle="Résumé de la transaction"
      summaryItemTitle={event?.title}
      summaryItemSubtitle={summarySubtitle}
      summaryItemDetails={event?.city ? `${event.address ? event.address + ', ' : ''}${event.city}` : undefined}
      summarySubmitText={isNonParticipantDonation ? 'Confirmer le don' : isContribution ? 'Payer la contribution' : 'Payer'}
      amountLabel={isNonParticipantDonation ? 'Don' : isContribution ? 'Contribution' : 'Participation'}
      extraFormContent={anonymityBlock}
      anonymousBadge={isAnonymous}
      onInitiate={handleInitiate}
      onDevConfirm={handleDevConfirm}
      onSuccess={handleSuccess}
      successScreen={
        isNonParticipantDonation
          ? <DonationSuccessScreen />
          : isContribution
            ? <ContributionSuccessScreen />
            : <JoinSuccessScreen />
      }
      onBack={() => window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate('/')}
    />
  )
}
