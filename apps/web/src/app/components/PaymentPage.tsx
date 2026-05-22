import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, ChevronLeft, CheckCircle, XCircle } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { chatApi } from '@/features/chat/api'
import { eventsApi } from '@/features/events/api'
import { toast } from 'sonner'
import {
  resolveContributionAmount,
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
  const initiatedRef = useRef(false)

  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error'>('loading')
  const [info, setInfo] = useState<{ description: string; amount: number; devMode: boolean; isContribution: boolean } | null>(null)
  const [resolvedAmount, setResolvedAmount] = useState<number | null>(null)

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['events', eventId],
    queryFn: () => eventsApi.getById(eventId!).then((r) => r.data),
    enabled: !!eventId,
  })

  const isContribution = isContributionPayment(amountParam, event, typeParam)

  useEffect(() => {
    if (!eventId || eventLoading || !event) return
    if (initiatedRef.current) return

    let finalAmount: number
    if (isContribution) {
      const resolved = resolveContributionAmount(event, rawAmount)
      if ('error' in resolved) {
        setStatus('error')
        toast.error(resolved.error)
        return
      }
      finalAmount = resolved.amount
    } else {
      finalAmount = event.price > 0 ? event.price : 0
      if (finalAmount <= 0 && amountParam) {
        const resolved = resolveContributionAmount(event, rawAmount)
        if ('amount' in resolved) finalAmount = resolved.amount
      }
    }

    if (finalAmount <= 0) {
      setStatus('error')
      toast.error('Montant de paiement invalide')
      return
    }

    setResolvedAmount(finalAmount)
    initiatedRef.current = true

    const script = document.createElement('script')
    script.src = 'https://cdn.fedapay.com/checkout.js?v=1.1.7'
    script.async = true
    document.head.appendChild(script)

    const init = async () => {
      try {
        const payload: { eventId: string; amount?: number } = { eventId }
        if (isContribution || amountParam) payload.amount = finalAmount

        const { data } = await apiClient.post('/payments/fedapay/initiate', payload)
        setInfo({
          description: data.description,
          amount: data.amount,
          devMode: data.devMode,
          isContribution: isContribution || !!(event.poolTarget && amountParam),
        })
        setStatus('ready')

        if (!data.devMode) {
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
                  onPaymentSuccess(finalAmount, isContribution || !!(event.poolTarget && amountParam))
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

    init()
    return () => {
      try {
        document.head.removeChild(script)
      } catch {
        /* ignore */
      }
    }
  }, [eventId, event, eventLoading, isContribution, rawAmount, amountParam])

  const onPaymentSuccess = (amount: number, contribution: boolean) => {
    setStatus('success')
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

  const handleDevConfirm = async () => {
    if (!eventId || resolvedAmount == null) return
    try {
      const payload: { eventId: string; amount?: number } = { eventId }
      if (isContribution || amountParam) payload.amount = resolvedAmount
      await apiClient.post('/payments/dev/confirm-booking', payload)
      onPaymentSuccess(resolvedAmount, isContribution || !!(event?.poolTarget && amountParam))
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur')
    }
  }

  const handleOpenChat = async () => {
    if (!eventId) return
    try {
      const conv = await chatApi.getEventConversation(eventId)
      navigate(`/chat/${conv.id}`)
    } catch {
      toast.error('Discussion introuvable.')
    }
  }

  return (
    <div className="w-full h-full bg-white flex flex-col">
      <div className="px-6 pt-safe-4 pb-4 border-b border-gray-100 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-full touch-sm">
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-[17px] font-bold text-[#1A1A1A]">
          {info?.isContribution ? 'Contribution' : 'Paiement'}
        </h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
        {(status === 'loading' || eventLoading) && (
          <>
            <Loader2 className="w-10 h-10 text-[#FF9F1C] animate-spin" />
            <p className="text-gray-500">Préparation du paiement...</p>
          </>
        )}

        {status === 'ready' && info && (
          <>
            <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center">
              <span className="text-4xl">{info.isContribution ? '🎁' : '💳'}</span>
            </div>
            <h2 className="text-xl font-bold text-[#1A1A1A]">
              {info.isContribution ? 'Contribution à la cagnotte' : 'Paiement'}
            </h2>
            <p className="text-gray-500 text-sm">{info.description}</p>
            <p className="text-2xl font-bold text-[#FF9F1C]">{info.amount.toLocaleString('fr-FR')} F CFA</p>
            {event && isContribution && (
              <p className="text-xs text-gray-400">
                Mode : {event.poolMode === 'fixe' ? 'montant fixe' : event.poolMode === 'minimum' ? 'montant minimum' : 'montant libre'}
              </p>
            )}
            {info.devMode && (
              <>
                <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-4 py-2 rounded-lg w-full">
                  Mode développement — FedaPay non configuré
                </div>
                <button
                  onClick={handleDevConfirm}
                  className="w-full bg-[#FF9F1C] text-white py-4 rounded-full font-bold text-[16px] active:scale-[0.98]"
                >
                  Confirmer le paiement (DEV)
                </button>
              </>
            )}
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-20 h-20 text-green-500" />
            <h2 className="text-xl font-bold text-[#1A1A1A]">
              {info?.isContribution ? 'Contribution confirmée !' : 'Participation confirmée !'}
            </h2>
            <p className="text-gray-500">
              {info?.isContribution
                ? 'Merci pour votre contribution à la cagnotte.'
                : 'Vous avez rejoint l\'événement avec succès.'}
            </p>
            <div className="w-full max-w-sm space-y-3">
              <button
                onClick={handleOpenChat}
                className="w-full bg-[#10B981] text-white py-4 rounded-full font-bold text-[16px] active:scale-[0.98] transition-transform"
              >
                Accéder au chat
              </button>
              <button
                onClick={() => navigate(`/events/${eventId}`)}
                className="w-full border border-gray-200 text-gray-700 py-4 rounded-full font-bold text-[16px] active:scale-[0.98] transition-transform"
              >
                Retour à l'événement
              </button>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-20 h-20 text-red-400" />
            <h2 className="text-xl font-bold text-[#1A1A1A]">Paiement impossible</h2>
            <p className="text-gray-500 mb-4">Vérifiez le montant ou réessayez.</p>
            <button onClick={() => navigate(-1)} className="w-full bg-[#1A1A1A] text-white py-4 rounded-full font-bold">
              Retour
            </button>
          </>
        )}
      </div>
    </div>
  )
}
