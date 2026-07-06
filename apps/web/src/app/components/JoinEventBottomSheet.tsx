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
    <BottomSheet open={isOpen} onClose={onClose}>
      <div className="px-[16px] pb-[32px] font-poppins flex flex-col gap-[20px] w-full">
        
        {/* Custom Header */}
        <div className="flex items-center justify-between pb-[16px] border-b border-gray-100">
          <button onClick={onClose} className="w-[32px] h-[32px] flex items-center justify-center bg-gray-50 rounded-full active:scale-95 transition-transform">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-800">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <h2 className="text-[16px] font-semibold text-[#1B1818] text-center flex-1 pr-[32px]">Rejoindre l'événement</h2>
        </div>

        {/* Recap Section */}
        <div className="flex flex-col p-[16px] bg-[var(--color-background-alt)] rounded-[12px] border border-[#CED1D3] gap-[16px]">
          <span className="text-[18px] font-medium font-poppins text-[#1B1818]">{event.title}</span>
          <div className="flex items-center justify-between border-t border-[#CED1D3] border-dashed pt-[12px]">
            <span className="text-[14px] font-normal font-poppins text-[#404040]">Participation</span>
            <span className="text-[14px] font-normal font-inter text-[#1B1818]">
              {minAmount > 0 ? (
                <>A partir de <span className="text-[#007BFF] font-semibold">{minAmount}F</span></>
              ) : 'Gratuit'}
            </span>
          </div>
        </div>

        {/* Separator */}
        {/* Payment Form */}
        {!isFree && (
          <div className="flex flex-col gap-[16px]">
            <div className="flex flex-col gap-[6px]">
              <label className="text-[14px] font-normal font-poppins text-[#56514F]">Montant de votre participation</label>
              <div className="relative">
                <Input
                  type="number"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="0"
                  className="pr-[60px] h-[40px] rounded-[6px] bg-[#FFFFFF] border border-[#E0E0E0] text-[#1B1818] font-normal font-inter text-[14px] placeholder:text-[#BDBDBD]"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-normal font-inter text-[#1B1818]">
                  F CFA
                </span>
              </div>
              <span className="text-[12px] font-normal font-inter text-[#525252]">Minimum {minAmount}F</span>
            </div>

            <div className="flex flex-col gap-[6px]">
              <label className="text-[14px] font-normal font-poppins text-[#56514F]">Méthode de paiement</label>
              <div className="relative">
                <div className="flex flex-row items-center p-[10px] gap-[4px] h-[44px] bg-[#FFFFFF] border border-[#E0E0E0] rounded-[6px]">
                  <img src="/logos/mobile-money.png" alt="Mobile money" className="w-6 h-6 object-contain shrink-0" />
                  <span className="flex-1 text-[14px] font-normal font-inter text-[#1B1818] text-left">Mobile money</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#A3A3A3] shrink-0">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-[6px]">
              <label className="text-[14px] font-normal font-poppins text-[#56514F]">Opérateur</label>
              <PaymentDropdown
                options={OPERATORS}
                value={operatorId}
                onChange={setOperatorId}
              />
            </div>

            <div className="flex flex-col gap-[6px]">
              <label className="text-[14px] font-normal font-poppins text-[#1B1818]">Numéro de téléphone</label>
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
        <div className="flex flex-col gap-[16px] mt-[8px]">
          <Button
            onClick={handlePay}
            disabled={!isFormValid || isProcessing || joinMutation.isPending}
            className="w-full h-[48px] rounded-[1000px] text-[15px] font-semibold border-none font-poppins"
            style={{
              background: (!isFormValid || isProcessing || joinMutation.isPending)
                ? '#FBCF9E' // faded orange
                : 'linear-gradient(243.43deg, #FFD439 16.67%, #FF7A00 83.33%)',
              color: 'white'
            }}
          >
            {(isProcessing || joinMutation.isPending) ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : "Rejoindre"}
          </Button>

          {/* Security Badge */}
          <div className="flex flex-col items-center justify-center gap-[4px] text-[12px] font-medium text-gray-500 pb-[8px]">
            <div className="flex items-center gap-[4px] font-bold text-[#1B1818]">
              Sécurisé PCI DSS <span className="text-green-500">🛡️</span>
            </div>
            <span className="text-gray-400">Fedapay</span>
          </div>
        </div>

      </div>
    </BottomSheet>
  )
}
