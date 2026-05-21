import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router'
import { Loader2, ChevronLeft, CheckCircle, XCircle } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { chatApi } from '@/features/chat/api'
import { toast } from 'sonner'

export function PaymentPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const customAmount = searchParams.get('amount') ? Number(searchParams.get('amount')) : undefined
  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error'>('loading')
  const [info, setInfo] = useState<{ description: string; amount: number; devMode: boolean } | null>(null)

  useEffect(() => {
    if (!eventId) return
    const script = document.createElement('script')
    script.src = 'https://cdn.fedapay.com/checkout.js?v=1.1.7'
    script.async = true
    document.head.appendChild(script)

    const init = async () => {
      try {
        const payload: any = { eventId }
        if (customAmount) payload.amount = customAmount

        const { data } = await apiClient.post('/payments/fedapay/initiate', payload)
        setInfo({ description: data.description, amount: data.amount, devMode: data.devMode })
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
                  setStatus('success')
                  toast.success("Paiement réussi ! Vous participez à l'événement 🎉")
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
    return () => { try { document.head.removeChild(script) } catch {} }
  }, [eventId, navigate])

  const handleDevConfirm = async () => {
    try {
      const payload: any = { eventId }
      if (customAmount) payload.amount = customAmount
      await apiClient.post('/payments/dev/confirm-booking', payload)
      setStatus('success')
      toast.success('Réservation confirmée (mode dev) 🎉')
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
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-full">
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-[17px] font-bold text-[#1A1A1A]">Paiement</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 text-[#FF9F1C] animate-spin" />
            <p className="text-gray-500">Préparation du paiement...</p>
          </>
        )}

        {status === 'ready' && info && (
          <>
            <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center">
              <span className="text-4xl">💳</span>
            </div>
            <h2 className="text-xl font-bold text-[#1A1A1A]">Paiement</h2>
            <p className="text-gray-500 text-sm">{info.description}</p>
            <p className="text-2xl font-bold text-[#FF9F1C]">{info.amount.toLocaleString()} XOF</p>
            {info.devMode && (
              <>
                <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-4 py-2 rounded-lg w-full">
                  🧪 Mode développement — FedaPay non configuré
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
            <h2 className="text-xl font-bold text-[#1A1A1A]">Participation confirmée !</h2>
            <p className="text-gray-500">Vous avez rejoint l'événement avec succès.</p>
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
            <h2 className="text-xl font-bold text-[#1A1A1A]">Paiement annulé</h2>
            <p className="text-gray-500 mb-4">Votre paiement n'a pas abouti.</p>
            <button onClick={() => navigate(-1)} className="w-full bg-[#1A1A1A] text-white py-4 rounded-full font-bold">
              Retour
            </button>
          </>
        )}
      </div>
    </div>
  )
}
