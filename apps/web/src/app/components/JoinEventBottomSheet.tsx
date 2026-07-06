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
  { id: 'mtn', label: 'MTN Momo', logo: '/logos/mtn.png' },
  { id: 'moov', label: 'MOOV', logo: '/logos/moov.png' },
  { id: 'celtis', label: 'CELTIS', logo: '/logos/celtiis.png' },
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

  const minAmount = event.poolMinAmount || event.price || 0
  
  const parsedAmount = Number(amountStr) || 0
  const finalAmount = Math.max(parsedAmount, minAmount)

  // Use parsedAmount instead of finalAmount for validation so the form is invalid if the user hasn't typed an amount >= minAmount
  const isFormValid = isFree || (parsedAmount >= minAmount && rawPhone.trim().length >= 8)

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
    <BottomSheet open={isOpen} onClose={onClose} noPadding className="h-full sm:h-[95vh] font-poppins">
      <div className="flex flex-col h-full overflow-hidden w-full bg-white sm:rounded-t-[32px]">
        {/* Custom Header (Fixed) */}
        <div className="flex-none flex items-center justify-between px-[1rem] pt-[1rem] pb-[0.75rem] border-b border-[#E0E0E0] min-h-[56px]">
          <button onClick={onClose} className="w-[32px] h-[32px] flex items-center justify-start active:scale-95 transition-transform">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#1B1818]">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <h2 className="font-semibold text-[#1B1818] text-center flex-1 pr-[32px] text-[clamp(14px,4vw,16px)]">Rejoindre l'événement</h2>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-[1rem] py-[1.25rem] flex flex-col gap-[1rem]">
          {/* Recap Section */}
          <div className="w-full flex flex-col p-[1rem] rounded-[8px] border border-dashed border-[#CED1D3] gap-[0.75rem]">
            <span className="font-semibold text-[#1B1818] text-[clamp(14px,4vw,16px)]">{event.title}</span>
            <div className="flex items-center justify-between border-t border-[#CED1D3] border-dashed pt-[0.75rem]">
              <span className="font-normal text-[#56514F] text-[clamp(12px,3.5vw,14px)]">Participation</span>
              <span className="font-normal text-[#1B1818] text-[clamp(12px,3.5vw,14px)]">
                {minAmount > 0 ? (
                  <>A partir de <span className="text-[#007BFF] font-bold">{minAmount}F</span></>
                ) : 'Gratuit'}
              </span>
            </div>
          </div>

          {/* Payment Form */}
          {!isFree && (
            <div className="flex flex-col gap-[1rem] w-full">
              <div className="flex flex-col">
                <label className="font-medium text-[#1B1818] text-[clamp(12px,3.5vw,14px)] mb-[0.25rem]">Montant de votre participation</label>
                <div className="relative w-full">
                  <Input
                    type="number"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    placeholder="0"
                    className="w-full pr-[60px] min-h-[48px] h-auto rounded-[8px] bg-white border border-[var(--border-default)] text-[#1B1818] font-normal text-[clamp(12px,3.5vw,14px)] placeholder:text-[#BDBDBD] box-border"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-normal text-[#1B1818] text-[clamp(12px,3.5vw,14px)]">
                    F CFA
                  </span>
                </div>
                <span className="text-[clamp(10px,3vw,12px)] font-normal text-[#525252] mt-[0.25rem]">Minimum {minAmount}F</span>
              </div>

              <div className="flex flex-col">
                <label className="font-medium text-[#1B1818] text-[clamp(12px,3.5vw,14px)] mb-[0.25rem]">Méthode de paiement</label>
                <div className="flex flex-row items-center px-[1rem] py-[0.75rem] gap-[8px] w-full min-h-[48px] h-auto bg-white border border-[var(--border-default)] rounded-[8px] box-border">
                  <img src="/logos/mobile-money.png" alt="Mobile money" className="w-[20px] h-[20px] object-contain shrink-0" />
                  <span className="flex-1 font-normal text-[#1B1818] text-[clamp(12px,3.5vw,14px)] text-left truncate">Mobile money</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#A3A3A3] shrink-0">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </div>
              </div>

              <div className="flex flex-col">
                <label className="font-medium text-[#1B1818] text-[clamp(12px,3.5vw,14px)] mb-[0.25rem]">Opérateur</label>
                <div className="w-full">
                  <PaymentDropdown
                    options={OPERATORS}
                    value={operatorId}
                    onChange={setOperatorId}
                  />
                </div>
              </div>

              <div className="flex flex-col">
                <label className="font-medium text-[#1B1818] text-[clamp(12px,3.5vw,14px)] mb-[0.25rem]">Numéro de téléphone</label>
                <div className="w-full">
                  <PhoneInputField
                    country={country}
                    onCountryChange={(c) => { setCountry(c); resetPhone() }}
                    phoneDisplay={phoneDisplay}
                    onPhoneChange={handlePhoneChange}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Button & Badge (Fixed) */}
        <div className="flex-none flex flex-col gap-[0.5rem] px-[1rem] pt-[0.5rem] pb-[1rem] bg-white border-t border-[#F5F5F5]">
          <Button
            onClick={handlePay}
            disabled={!isFormValid || isProcessing || joinMutation.isPending}
            className="w-full min-h-[44px] h-auto rounded-[1000px] py-[0.625rem] px-[1rem] font-medium text-[clamp(13px,3.5vw,14px)] text-white text-center border-none transition-colors"
            style={{
              background: (!isFormValid || isProcessing || joinMutation.isPending)
                ? 'var(--color-button-disabled, #FBCF9E)' // token désactivé
                : 'linear-gradient(243.43deg, #FFD439 16.67%, #FF7A00 83.33%)',
            }}
          >
            {(isProcessing || joinMutation.isPending) ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : "Rejoindre"}
          </Button>

          <div className="flex flex-col items-center justify-center gap-[0.25rem] py-[0.5rem] w-full text-center">
            <div className="flex items-center gap-[4px] font-medium text-[#1B1818] text-[clamp(10px,3vw,12px)]">
              Sécurisé PCI DSS <span className="text-green-500">🛡️</span>
            </div>
            <span className="text-[#A3A3A3] text-[clamp(10px,3vw,12px)] block">Fedapay</span>
          </div>
        </div>
      </div>
    </BottomSheet>
  )
}
