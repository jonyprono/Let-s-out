import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient, useMutation } from '@tanstack/react-query'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { PaymentDropdown } from '@/components/ui/payment-dropdown'
import { PhoneInputField } from '@/components/shared/PhoneInputField'
import { COUNTRIES, Country } from '@/lib/countries'
import { usePhoneFormatter } from '@/lib/usePhoneFormatter'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

import { apiClient } from '@/lib/api-client'
import { eventsApi } from '@/features/events/api'
import { hapticFeedback } from '@/lib/haptics'

const OPERATORS = [
  { id: 'mtn', label: 'MTN Momo', emoji: '🟡' },
  { id: 'moov', label: 'MOOV', emoji: '🔵' },
  { id: 'celtis', label: 'CELTIS', emoji: '🟢' },
]

export interface JoinEventBottomSheetProps {
  event: any
  isOpen: boolean
  onClose: () => void
}

export function JoinEventBottomSheet({ event, isOpen, onClose }: JoinEventBottomSheetProps) {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [amountStr, setAmountStr] = useState(event.price > 0 ? String(event.price) : '')
  const [country, setCountry] = useState<Country>(COUNTRIES[0])
  const {
    displayValue: phoneDisplay,
    rawValue: rawPhone,
    handleChange: handlePhoneChange,
    reset: resetPhone,
  } = usePhoneFormatter()
  const [operatorId, setOperatorId] = useState(OPERATORS[0].id)
  const [isProcessing, setIsProcessing] = useState(false)

  const isFree = event.price === 0 && !event.poolTarget
  const transactionFee = isFree ? 0 : 50 // As per EventDetails logic
  const minAmount = event.poolMinAmount || event.price || 0
  
  const parsedAmount = Number(amountStr) || 0
  const finalAmount = Math.max(parsedAmount, minAmount)
  const netToPay = finalAmount + transactionFee

  const isFormValid = isFree || (finalAmount >= minAmount && rawPhone.trim().length >= 8)

  const joinMutation = useMutation({
    mutationFn: () => eventsApi.join(event.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', event.id] })
      qc.invalidateQueries({ queryKey: ['events', event.id, 'my-booking'] })
      onClose()
      navigate(`/events/${event.id}/success`)
    },
    onError: (err: any) => {
      const errCode = err?.response?.data?.error
      if (errCode === 'Already joined') {
        qc.invalidateQueries({ queryKey: ['events', event.id, 'my-booking'] })
        toast.info('Vous participez déjà à cet événement.')
        onClose()
      } else {
        toast.error(err?.response?.data?.message || "Impossible de rejoindre l'événement.")
      }
    },
  })

  const handlePay = async () => {
    hapticFeedback.impact()
    if (isFree) {
      joinMutation.mutate()
      return
    }

    setIsProcessing(true)
    try {
      const payload = { eventId: event.id, amount: finalAmount }
      const { data } = await apiClient.post('/payments/fedapay/initiate', payload)

      if (data.devMode) {
        await apiClient.post('/payments/dev/confirm-booking', payload)
        onPaymentSuccess()
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
                toast.error('Paiement annulé')
                setIsProcessing(false)
              } else {
                onPaymentSuccess()
              }
            },
          }).open()
        }
      }
    } catch (err: any) {
      setIsProcessing(false)
      toast.error(err.response?.data?.error || 'Erreur lors du paiement')
    }
  }

  const onPaymentSuccess = () => {
    qc.invalidateQueries({ queryKey: ['chat'] })
    qc.invalidateQueries({ queryKey: ['events', event.id] })
    qc.invalidateQueries({ queryKey: ['events', event.id, 'my-booking'] })
    setIsProcessing(false)
    onClose()
    navigate(`/events/${event.id}/success`)
  }

  return (
    <BottomSheet open={isOpen} onClose={onClose}>
      <div className="px-4 pb-safe-4 font-poppins flex flex-col gap-[24px]">
        {/* Recap Section */}
        <div className="flex flex-col gap-[16px]">
          <h2 className="text-[16px] font-bold text-[var(--color-text-primary)]">Récapitulatif</h2>
          <div className="flex flex-col gap-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium font-inter text-[var(--color-text-secondary)]">Événement</span>
              <span className="text-[14px] font-semibold text-[var(--color-text-primary)]">{event.title}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium font-inter text-[var(--color-text-secondary)]">Montant de participation</span>
              <span className="text-[14px] font-bold text-[var(--brand-orange-500)]">
                {minAmount > 0 ? `${minAmount.toLocaleString()} F CFA` : 'Gratuit'}
              </span>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="h-[1px] w-full bg-[var(--border-default)]" />

        {/* Payment Form */}
        {!isFree && (
          <div className="flex flex-col gap-[16px]">
            <div className="flex flex-col gap-[8px]">
              <label className="text-[14px] font-medium text-[var(--color-text-primary)]">Saisissez votre montant</label>
              <div className="relative">
                <Input
                  type="number"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="Ex: 5000"
                  className="pr-16"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-[var(--color-text-secondary)]">
                  F CFA
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-[8px]">
              <label className="text-[14px] font-medium text-[var(--color-text-primary)]">Moyen de paiement</label>
              <PaymentDropdown
                options={OPERATORS}
                value={operatorId}
                onChange={setOperatorId}
              />
            </div>

            <div className="flex flex-col gap-[8px]">
              <label className="text-[14px] font-medium text-[var(--color-text-primary)]">Numéro de téléphone</label>
              <PhoneInputField
                country={country}
                onCountryChange={(c) => { setCountry(c); resetPhone() }}
                phoneDisplay={phoneDisplay}
                onPhoneChange={handlePhoneChange}
              />
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex flex-col gap-[12px] mt-4">
          <Button
            onClick={handlePay}
            disabled={!isFormValid || isProcessing || joinMutation.isPending}
            className="w-full h-[40px] rounded-full text-[14px] font-medium border-none font-poppins"
            style={{
              background: (!isFormValid || isProcessing || joinMutation.isPending)
                ? 'var(--color-background-secondary)'
                : 'linear-gradient(243.43deg, #FFD439 16.67%, #FF7A00 83.33%)',
              color: (!isFormValid || isProcessing || joinMutation.isPending)
                ? 'var(--color-text-secondary)'
                : 'white'
            }}
          >
            {(isProcessing || joinMutation.isPending) ? (
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            ) : isFree ? (
              "Confirmer la participation"
            ) : (
              `Payer ${netToPay.toLocaleString()} F CFA`
            )}
          </Button>

          {/* Security Badge */}
          <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
            Sécurisé PCI DSS 🛡️ Fedapay
          </div>
        </div>

      </div>
    </BottomSheet>
  )
}
