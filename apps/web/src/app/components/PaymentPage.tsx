import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, ChevronLeft, XCircle, ChevronDown } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { eventsApi } from '@/features/events/api'
import { toast } from 'sonner'
import {
  isContributionPayment,
  applyPoolContributionOptimistic,
} from '@/lib/pool-contribution'

export function PaymentPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const amountParam = searchParams.get('amount')
  const typeParam = searchParams.get('type')
  const rawAmount = amountParam ? Number(amountParam) : undefined

  // UI state
  const [status, setStatus] = useState<'form' | 'loading' | 'summary' | 'success' | 'error'>('form')
  const [resolvedAmount, setResolvedAmount] = useState<number | null>(null)

  // Form state
  const [participationAmount, setParticipationAmount] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['events', eventId],
    queryFn: () => eventsApi.getById(eventId!).then((r) => r.data),
    enabled: !!eventId,
  })

  const isContribution = isContributionPayment(amountParam, event, typeParam)
  const minAmount = event?.poolMinAmount || event?.price || 0
  const transactionFee = 100

  const finalAmount = (() => {
    const entered = Number(participationAmount)
    if (entered > 0) return entered
    if (isContribution && rawAmount) return rawAmount
    return event?.price || 0
  })()

  const netToPay = finalAmount + transactionFee

  // Auto-fill amount from event price or pool
  useEffect(() => {
    if (event && !participationAmount) {
      if (event.price > 0) setParticipationAmount(String(event.price))
    }
  }, [event])

  const handleOpenSummary = () => {
    if (!participationAmount || Number(participationAmount) < minAmount) {
      toast.error(`Montant minimum : ${minAmount.toLocaleString()} F`)
      return
    }
    if (!phoneNumber.trim()) {
      toast.error('Veuillez saisir votre numéro de téléphone')
      return
    }
    setStatus('summary')
  }

  const handlePay = async () => {
    if (!eventId) return
    setStatus('loading')

    const amountToUse = finalAmount

    try {
      const payload: { eventId: string; amount?: number } = { eventId }
      if (isContribution || amountParam) payload.amount = amountToUse

      const { data } = await apiClient.post('/payments/fedapay/initiate', payload)
      setResolvedAmount(amountToUse)

      if (data.devMode) {
        await handleDevConfirm(amountToUse)
      } else {
        const script = document.createElement('script')
        script.src = 'https://cdn.fedapay.com/checkout.js?v=1.1.7'
        script.async = true
        document.head.appendChild(script)
        script.onload = () => {
          const FedaPay = (window as any).FedaPay
          FedaPay.init({
            public_key: data.publicKey,
            transaction: { token: data.transactionToken },
            onComplete: (resp: any) => {
              if (resp.reason === FedaPay.DIALOG_DISMISSED) {
                setStatus('error')
                toast.error('Paiement annulé')
              } else {
                onPaymentSuccess(amountToUse, isContribution || !!(event?.poolTarget && amountParam))
              }
            },
          }).open()
        }
      }
    } catch (err: any) {
      setStatus('error')
      toast.error(err.response?.data?.error || 'Erreur lors du paiement')
    }
  }

  const handleDevConfirm = async (amount: number) => {
    if (!eventId) return
    try {
      const payload: { eventId: string; amount?: number } = { eventId }
      if (isContribution || amountParam) payload.amount = amount
      await apiClient.post('/payments/dev/confirm-booking', payload)
      onPaymentSuccess(amount, isContribution || !!(event?.poolTarget && amountParam))
    } catch (err: any) {
      setStatus('error')
      toast.error(err.response?.data?.error || 'Erreur')
    }
  }

  const onPaymentSuccess = (amount: number, contribution: boolean) => {
    setStatus('success')
    setResolvedAmount(amount)
    if (contribution && eventId) {
      applyPoolContributionOptimistic(qc, eventId, amount)
    }
    qc.invalidateQueries({ queryKey: ['chat'] })
    qc.invalidateQueries({ queryKey: ['events', eventId] })
    qc.invalidateQueries({ queryKey: ['events', eventId, 'my-booking'] })
    toast.success(
      contribution
        ? 'Contribution enregistrée avec succès !'
        : "Paiement réussi ! Vous participez à l'événement",
    )
  }

  const handleOpenChat = async () => {
    if (!eventId) return
    navigate(`/events/${eventId}`)
  }

  const parseSafeDate = (dateStr: any): Date => {
    if (!dateStr) return new Date()
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) return d
    return new Date()
  }

  if (eventLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF7A00]" />
      </div>
    )
  }

  // ── SUCCESS STATE ──
  if (status === 'success') {
    const startDate = parseSafeDate(event?.startAt)
    return (
      <div className="w-full h-full bg-white flex flex-col font-sans">
        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-safe-4 pt-4 pb-3 flex items-center">
          <button onClick={() => navigate(`/events/${eventId}`)} className="w-9 h-9 flex items-center justify-center active:scale-95">
            <ChevronLeft className="w-5 h-5 text-gray-900" strokeWidth={2.5} />
          </button>
          <span className="flex-1 text-center text-[16px] font-semibold text-gray-900 -ml-9">Rejoindre l'événement</span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-32 flex flex-col items-center" style={{ scrollbarWidth: 'none' }}>
          {/* Success icon */}
          <div className="mt-12 mb-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, #4CD964, #34C759)' }}
            >
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <path d="M8 18L15 25L28 11" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <h1 className="text-[22px] font-bold text-[#2E7D32] mb-2 text-center">Participation validée !</h1>
          <p className="text-[13px] text-gray-500 text-center mb-8 px-6">
            Votre participation est confirmée pour cet événement. Rejoignez le groupe de discussion et découvrez les autres participants.
          </p>

          {/* Summary card */}
          <div className="w-full rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-4">
            <h2 className="text-[15px] font-bold text-gray-900">{event?.title}</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-500">Date</span>
                <span className="text-[13px] font-semibold text-gray-900">
                  {event?.startAt ? `${startDate.getDate()} Juin ${startDate.getFullYear()}, ${String(startDate.getHours()).padStart(2, '0')}h` : '--'}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-[13px] text-gray-500 shrink-0">Lieu</span>
                <span className="text-[13px] font-semibold text-gray-900 text-right">
                  {event?.city ? `${event.address ? event.address + ' ' : ''}(${event.city})` : 'Lieu non précisé'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-500">Votre participation</span>
                <span className="text-[13px] font-semibold text-gray-900">
                  {resolvedAmount ? `${resolvedAmount.toLocaleString()} F` : event?.price ? `${event.price.toLocaleString()} F` : 'Gratuit'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="absolute bottom-0 left-0 right-0 bg-white px-5 pt-3 flex flex-col gap-3"
          style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
        >
          <button
            onClick={handleOpenChat}
            className="w-full py-[14px] rounded-full font-bold text-[15px] text-white bg-[#FF7A00] active:scale-95 transition-transform shadow-md shadow-orange-500/20"
          >
            Rejoindre le groupe
          </button>
          <button
            onClick={() => navigate(`/events/${eventId}`)}
            className="w-full py-[14px] rounded-full font-bold text-[15px] text-gray-700 border border-gray-200 bg-white active:scale-95 transition-transform"
          >
            Retour à l'événement
          </button>
        </div>
      </div>
    )
  }

  // ── ERROR STATE ──
  if (status === 'error') {
    return (
      <div className="w-full h-full bg-white flex flex-col">
        <div className="px-5 pt-safe-4 pt-4 pb-3 flex items-center">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-full active:scale-95">
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
          <XCircle className="w-20 h-20 text-red-400" />
          <h2 className="text-xl font-bold text-gray-900">Paiement impossible</h2>
          <p className="text-gray-500 mb-4">Vérifiez le montant ou réessayez.</p>
          <button onClick={() => setStatus('form')} className="w-full bg-gray-900 text-white py-4 rounded-full font-bold">
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  // ── LOADING STATE ──
  if (status === 'loading') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-white gap-4">
        <Loader2 className="w-10 h-10 text-[#FF7A00] animate-spin" />
        <p className="text-gray-500 text-[14px]">Traitement en cours...</p>
      </div>
    )
  }

  // ── PAYMENT FORM ──
  return (
    <div className="w-full h-full bg-white flex flex-col font-sans">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-safe-4 pt-4 pb-3 flex items-center">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center active:scale-95">
          <ChevronLeft className="w-5 h-5 text-gray-900" strokeWidth={2.5} />
        </button>
        <span className="flex-1 text-center text-[16px] font-semibold text-gray-900 -ml-9">Rejoindre l'événement</span>
      </div>

      {/* Form content */}
      <div className="flex-1 overflow-y-auto px-5 pb-32" style={{ scrollbarWidth: 'none' }}>

        {/* Event name + participation row */}
        <div className="mb-6">
          <h1 className="text-[20px] font-bold text-gray-900 mb-3">{event?.title}</h1>
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <span className="text-[13px] text-gray-600">Participation</span>
            <span className="text-[13px] font-semibold text-[#007AFF]">
              A partir de {minAmount > 0 ? `${minAmount.toLocaleString()}F` : 'Gratuit'}
            </span>
          </div>
        </div>

        {/* Amount field */}
        <div className="mb-5">
          <label className="block text-[13px] font-medium text-gray-700 mb-2">
            Montant de votre participation
          </label>
          <div className="flex items-center border border-gray-200 rounded-[12px] overflow-hidden bg-white">
            <input
              type="number"
              value={participationAmount}
              onChange={(e) => setParticipationAmount(e.target.value)}
              placeholder="0"
              className="flex-1 px-4 py-3.5 text-[15px] text-gray-900 outline-none bg-transparent"
            />
            <span className="pr-4 text-[13px] font-semibold text-gray-500">F CFA</span>
          </div>
          {minAmount > 0 && (
            <p className="text-[11px] text-gray-400 mt-1.5 ml-1">Minimum {minAmount.toLocaleString()}F</p>
          )}
        </div>

        {/* Payment method */}
        <div className="mb-5">
          <label className="block text-[13px] font-medium text-gray-700 mb-2">Méthode de paiement</label>
          <div className="flex items-center border border-gray-200 rounded-[12px] bg-white px-4 py-3.5">
            <span className="text-lg mr-3">📱</span>
            <span className="flex-1 text-[14px] text-gray-900">Mobile money</span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Operator */}
        <div className="mb-5">
          <label className="block text-[13px] font-medium text-gray-700 mb-2">Opérateur</label>
          <div className="flex items-center border border-gray-200 rounded-[12px] bg-white px-4 py-3.5">
            <span className="text-lg mr-3">🟡</span>
            <span className="flex-1 text-[14px] text-gray-900">MTN Momo</span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Phone number */}
        <div className="mb-8">
          <label className="block text-[13px] font-medium text-gray-700 mb-2">Numéro de téléphone</label>
          <div className="flex items-center border border-gray-200 rounded-[12px] bg-white overflow-hidden">
            <div className="flex items-center gap-1.5 px-3 border-r border-gray-200 py-3.5">
              <span className="text-base">🇧🇯</span>
              <span className="text-[13px] text-gray-700 font-medium">(229)</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="00 00 00 00 00"
              className="flex-1 px-4 py-3.5 text-[14px] text-gray-900 outline-none bg-transparent"
            />
          </div>
        </div>

      </div>

      {/* Sticky footer */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-white px-5 pt-3 flex flex-col items-center gap-2"
        style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
      >
        <button
          onClick={handleOpenSummary}
          className="w-full py-[14px] rounded-full font-bold text-[15px] text-white bg-[#FF7A00] opacity-80 active:opacity-100 active:scale-95 transition-all shadow-md shadow-orange-500/20"
        >
          Rejoindre
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-500 font-medium">Sécurisé PCI DSS</span>
          <span className="text-green-500 text-xs">✓</span>
          <span className="text-[11px] text-gray-400">Fedapay</span>
        </div>
      </div>

      {/* ── TRANSACTION SUMMARY BOTTOM SHEET ── */}
      {status === 'summary' && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-end justify-center animate-in fade-in duration-200">
          <div className="w-full bg-white rounded-t-[28px] shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="px-5 pt-4 pb-safe-4" style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))' }}>

              <h2 className="text-[17px] font-bold text-gray-900 mb-5 text-center">Résumé de la transaction</h2>

              {/* Event info */}
              <div className="mb-5">
                <h3 className="text-[16px] font-bold text-gray-900">{event?.title}</h3>
                {event?.startAt && (
                  <p className="text-[12px] text-gray-500 mt-0.5">
                    {(() => {
                      const d = parseSafeDate(event.startAt)
                      const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
                      const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
                      const endD = event.endAt ? parseSafeDate(event.endAt) : null
                      return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}${endD ? ` - ${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}` : ''}`
                    })()}
                  </p>
                )}
                {event?.city && (
                  <p className="text-[12px] text-gray-500">{event.address ? `${event.address}, ` : ''}{event.city}</p>
                )}
              </div>

              {/* Phone display */}
              <div className="flex items-center gap-2 bg-gray-50 rounded-[12px] px-4 py-3 mb-1">
                <span className="text-base">🟡</span>
                <span className="text-[14px] font-semibold text-gray-900 flex-1">229 {phoneNumber}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-[11px] text-gray-400 mb-5 text-center">Moyen sécurisé de paiement</p>

              {/* Amount breakdown */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-600">Participation</span>
                  <span className="text-[13px] font-semibold text-gray-900">{finalAmount.toLocaleString()}F</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-600">Frais de transaction</span>
                  <span className="text-[13px] font-semibold text-gray-900">{transactionFee.toLocaleString()} F</span>
                </div>
                <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                  <span className="text-[14px] font-bold text-gray-900">Net à payer</span>
                  <span className="text-[15px] font-bold text-gray-900">{netToPay.toLocaleString()} F</span>
                </div>
              </div>

              <button
                onClick={handlePay}
                className="w-full py-[14px] rounded-full font-bold text-[15px] text-white bg-[#FF7A00] active:scale-95 transition-transform shadow-md shadow-orange-500/20"
              >
                Payer
              </button>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
