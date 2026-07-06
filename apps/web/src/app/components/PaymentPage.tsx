import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, ChevronLeft, XCircle, ChevronDown, Check } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { eventsApi } from '@/features/events/api'
import { toast } from 'sonner'
import {
  isContributionPayment,
  applyPoolContributionOptimistic,
} from '@/lib/pool-contribution'

// ── Operators ──────────────────────────────────────────────
const OPERATORS = [
  { id: 'mtn', label: 'MTN Momo', logo: '/logos/mtn.png', prefix: '97' },
  { id: 'moov', label: 'MOOV', logo: '/logos/moov.png', prefix: '96' },
  { id: 'celtis', label: 'CELTIS', logo: '/logos/celtiis.png', prefix: '95' },
]

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
  const [selectedOperator, setSelectedOperator] = useState(OPERATORS[0])
  const [showOperatorDropdown, setShowOperatorDropdown] = useState(false)
  const operatorRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (event && !participationAmount) {
      if (event.price > 0) setParticipationAmount(String(event.price))
    }
  }, [event])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (operatorRef.current && !operatorRef.current.contains(e.target as Node)) {
        setShowOperatorDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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
      <div className="w-full h-full bg-white flex flex-col" style={{ fontFamily: 'Poppins, sans-serif' }}>
        <div className="flex-shrink-0 px-5 pt-safe-4 pt-4 pb-3 flex items-center">
          <button onClick={() => navigate(`/events/${eventId}`)} className="w-9 h-9 flex items-center justify-center active:scale-95">
            <ChevronLeft className="w-5 h-5 text-[#1B1818]" strokeWidth={2} />
          </button>
          <span className="flex-1 text-center text-[16px] font-semibold text-[#1B1818] -ml-9">Rejoindre l'événement</span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-32 flex flex-col items-center" style={{ scrollbarWidth: 'none' }}>
          <div className="mt-12 mb-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #4CD964, #34C759)' }}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <path d="M8 18L15 25L28 11" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <h1 className="text-[22px] font-bold text-[#2E7D32] mb-2 text-center">Participation validée !</h1>
          <p className="text-[13px] text-gray-500 text-center mb-8 px-6">
            Votre participation est confirmée pour cet événement. Rejoignez le groupe de discussion et découvrez les autres participants.
          </p>

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

        <div className="absolute bottom-0 left-0 right-0 bg-white px-5 pt-3 flex flex-col gap-3" style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}>
          <button onClick={handleOpenChat} className="w-full py-[14px] rounded-full font-bold text-[15px] text-white bg-[#FF7A00] active:scale-95 transition-transform shadow-md shadow-orange-500/20">
            Rejoindre le groupe
          </button>
          <button onClick={() => navigate(`/events/${eventId}`)} className="w-full py-[14px] rounded-full font-bold text-[15px] text-gray-700 border border-gray-200 bg-white active:scale-95 transition-transform">
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
    <div className="w-full h-full bg-white flex flex-col" style={{ fontFamily: 'Poppins, sans-serif' }}>

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-5 pt-safe-4 pt-4 pb-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center active:scale-95"
        >
          <ChevronLeft className="w-[22px] h-[22px] text-[#1B1818]" strokeWidth={2} />
        </button>
        <span className="flex-1 text-center text-[16px] font-semibold text-[#1B1818] -ml-8">
          Rejoindre l'événement
        </span>
      </div>

      {/* ── Form content ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-40" style={{ scrollbarWidth: 'none' }}>

        {/* Event name */}
        <h1 className="text-[20px] font-bold text-[#1B1818] mt-2 mb-2">{event?.title}</h1>

        {/* Participation row */}
        <div className="flex items-center justify-between py-3 border-b border-[#F0F0F0] mb-5">
          <span className="text-[13px] text-[#8D8D8D]">Participation</span>
          <span className="text-[13px] font-semibold text-[#FF7A00]">
            A partir de {minAmount > 0 ? `${minAmount.toLocaleString()}F` : 'Gratuit'}
          </span>
        </div>

        {/* ── Amount field ── */}
        <div className="mb-4">
          <label className="block text-[13px] font-medium text-[#1B1818] mb-2">
            Montant de votre participation
          </label>
          <div className="flex items-center border border-[#DFDFDF] rounded-[10px] bg-white overflow-hidden h-[52px]">
            <input
              type="number"
              value={participationAmount}
              onChange={(e) => setParticipationAmount(e.target.value)}
              placeholder="0"
              className="flex-1 px-4 text-[15px] text-[#1B1818] placeholder:text-[#C0C0C0] outline-none bg-transparent h-full"
            />
            <span className="pr-4 text-[13px] font-semibold text-[#8D8D8D]">F CFA</span>
          </div>
          {minAmount > 0 && (
            <p className="text-[11px] text-[#8D8D8D] mt-1 ml-0.5">Minimum {minAmount.toLocaleString()}F</p>
          )}
        </div>

        {/* ── Payment method ── */}
        <div className="mb-4">
          <label className="block text-[13px] font-medium text-[#1B1818] mb-2">Méthode de paiement</label>
          <div className="flex flex-row items-center p-[10px] gap-[4px] w-full h-[44px] bg-white border border-[#E0E0E0] rounded-[6px]">
            <img src="/logos/mobile-money.png" alt="Mobile money" className="w-6 h-6 object-contain shrink-0" />
            <span className="flex-1 text-[14px] text-[#1B1818] text-left">Mobile money</span>
            <ChevronDown className="w-4 h-4 text-[#8D8D8D] shrink-0" />
          </div>
        </div>

        {/* ── Operator (real dropdown) ── */}
        <div className="mb-4" ref={operatorRef}>
          <label className="block text-[13px] font-medium text-[#1B1818] mb-2">Opérateur</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowOperatorDropdown(!showOperatorDropdown)}
              className="w-full flex flex-row items-center p-[10px] gap-[4px] h-[44px] bg-white border border-[#E0E0E0] rounded-[6px] active:bg-gray-50 transition-colors"
            >
              <img src={selectedOperator.logo} alt={selectedOperator.label} className="w-6 h-6 object-contain shrink-0" />
              <span className="flex-1 text-[14px] text-[#1B1818] text-left">{selectedOperator.label}</span>
              <ChevronDown
                className="w-4 h-4 text-[#8D8D8D] shrink-0 transition-transform duration-200"
                style={{ transform: showOperatorDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>

            {showOperatorDropdown && (
              <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-30 bg-white border border-[#DFDFDF] rounded-[10px] shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                {OPERATORS.map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => {
                      setSelectedOperator(op)
                      setShowOperatorDropdown(false)
                    }}
                    className="w-full flex flex-row items-center p-[10px] gap-[4px] h-[44px] hover:bg-[#FFF8F0] transition-colors"
                  >
                    <img src={op.logo} alt={op.label} className="w-6 h-6 object-contain shrink-0" />
                    <span className="flex-1 text-[14px] text-[#1B1818] text-left">{op.label}</span>
                    {selectedOperator.id === op.id && (
                      <Check className="w-4 h-4 text-[#FF7A00] shrink-0" strokeWidth={2.5} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Phone number ── */}
        <div className="mb-8">
          <label className="block text-[13px] font-medium text-[#1B1818] mb-2">Numéro de téléphone</label>
          <div className="flex items-center border border-[#DFDFDF] rounded-[10px] bg-white overflow-hidden h-[52px]">
            <div className="flex items-center gap-1.5 px-3 border-r border-[#DFDFDF] h-full">
              <span className="text-[16px]">🇧🇯</span>
              <span className="text-[13px] text-[#1B1818] font-medium">(229)</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#8D8D8D]" />
            </div>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="00 00 00 00 00"
              className="flex-1 px-4 text-[14px] text-[#1B1818] placeholder:text-[#C0C0C0] outline-none bg-transparent h-full"
            />
          </div>
        </div>

      </div>

      {/* ── Sticky footer ── */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-white px-5 pt-3 flex flex-col items-center gap-2 border-t border-[#F0F0F0]"
        style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
      >
        <button
          onClick={handleOpenSummary}
          className="w-full h-[52px] rounded-full font-bold text-[15px] text-white bg-[#FF7A00] opacity-90 active:opacity-100 active:scale-[0.98] transition-all shadow-md shadow-orange-500/20"
        >
          Rejoindre
        </button>
        <div className="flex flex-col items-center justify-center gap-[4px] pt-[0.25rem] w-full text-center">
          <div className="flex items-center justify-center gap-[6px] font-medium text-[#1B1818] text-[clamp(12px,3.5vw,14px)]">
            Sécurisé PCI DSS 
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.34844 0C0.990808 0 0.647828 0.142067 0.394948 0.394948C0.142067 0.647828 0 0.990808 0 1.34844V5.3061C0 11.5255 5.28169 13.5833 6.30877 13.9253C6.58912 14.0249 6.89525 14.0249 7.17559 13.9253C8.20267 13.5833 13.4844 11.5255 13.4844 5.3061V1.34844C13.4844 0.99081 13.3423 0.64783 13.0894 0.394948C12.8365 0.142067 12.4936 0 12.1359 0H1.34844Z" fill="#14CD7F"/>
              <path d="M9.50648 4.04541L6.04353 7.34908L4.315 5.69724" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-[#6B7280] text-[clamp(11px,3vw,13px)] font-medium">Fedapay</span>
        </div>
      </div>

      {/* ── Transaction Summary Bottom Sheet ── */}
      {status === 'summary' && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-end justify-center animate-in fade-in duration-200">
          <div className="w-full bg-white rounded-t-[24px] shadow-2xl animate-in slide-in-from-bottom duration-300" style={{ fontFamily: 'Poppins, sans-serif' }}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-[#E0E0E0] rounded-full" />
            </div>

            <div className="px-5 pt-4" style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))' }}>

              <h2 className="text-[17px] font-bold text-[#1B1818] mb-5 text-center">Résumé de la transaction</h2>

              <div className="mb-5">
                <h3 className="text-[16px] font-bold text-[#1B1818]">{event?.title}</h3>
                {event?.startAt && (
                  <p className="text-[12px] text-[#8D8D8D] mt-0.5">
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
                  <p className="text-[12px] text-[#8D8D8D]">{event.address ? `${event.address}, ` : ''}{event.city}</p>
                )}
              </div>

              {/* Phone + operator */}
              <div className="flex items-center gap-2 bg-[#F8F8F8] rounded-[10px] px-4 py-3 mb-1">
                <img src={selectedOperator.logo} alt={selectedOperator.label} className="w-6 h-6 object-contain shrink-0" />
                <span className="text-[14px] font-semibold text-[#1B1818] flex-1">{selectedOperator.label} • 229 {phoneNumber}</span>
              </div>
              <p className="text-[11px] text-[#8D8D8D] mb-5 text-center">Moyen sécurisé de paiement</p>

              {/* Breakdown */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#8D8D8D]">Participation</span>
                  <span className="text-[13px] font-semibold text-[#1B1818]">{finalAmount.toLocaleString()}F</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#8D8D8D]">Frais de transaction</span>
                  <span className="text-[13px] font-semibold text-[#1B1818]">{transactionFee.toLocaleString()} F</span>
                </div>
                <div className="border-t border-[#F0F0F0] pt-3 flex items-center justify-between">
                  <span className="text-[14px] font-bold text-[#1B1818]">Net à payer</span>
                  <span className="text-[15px] font-bold text-[#1B1818]">{netToPay.toLocaleString()} F</span>
                </div>
              </div>

              <button
                onClick={handlePay}
                className="w-full h-[52px] rounded-full font-bold text-[15px] text-white bg-[#FF7A00] active:scale-[0.98] transition-transform shadow-md shadow-orange-500/20"
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
