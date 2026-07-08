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

  const minAmount = isFree ? 0 : Math.max(100, event.poolMinAmount || event.price || 0)
  
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
            transaction: { id: data.transactionId, token: data.transactionToken, amount: data.amount, description: data.description },
            onComplete: (resp: any) => {
              if (resp.reason === FedaPay.DIALOG_DISMISSED) {
                toast.error('Paiement annulé')
                setIsProcessing(false)
                document.getElementById('fedapay-backdrop')?.remove()
              } else {
                document.getElementById('fedapay-backdrop')?.remove()
                onPaymentSuccess()
              }
            },
          }).open()

          // Convert FedaPay overlay to bottom sheet using a robust poller
          let attempts = 0;
          const styleInterval = setInterval(() => {
            attempts++;
            if (attempts > 20) {
              clearInterval(styleInterval);
              return;
            }

            const fedaEl = Array.from(document.querySelectorAll('body > div')).find(el => {
              const s = window.getComputedStyle(el);
              return s.position === 'fixed' && parseInt(s.zIndex || '0') > 100 && el.id !== 'fedapay-backdrop';
            }) as HTMLElement | undefined;

            if (fedaEl && !fedaEl.dataset.styledAsSheet) {
              clearInterval(styleInterval);
              fedaEl.dataset.styledAsSheet = 'true';

              if (!document.getElementById('fedapay-backdrop')) {
                const backdrop = document.createElement('div');
                backdrop.id = 'fedapay-backdrop';
                backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9990;';
                document.body.appendChild(backdrop);
              }

              fedaEl.style.cssText = [
                'position: fixed !important',
                'top: auto !important',
                'bottom: 0 !important',
                'left: 0 !important',
                'right: 0 !important',
                'width: 100% !important',
                'height: 85dvh !important',
                'max-height: 85dvh !important',
                'border-radius: 20px 20px 0 0 !important',
                'overflow: hidden !important',
                'z-index: 9999 !important',
                'box-shadow: 0 -8px 32px rgba(0,0,0,0.25) !important',
                'animation: slideUpSheet 0.35s cubic-bezier(0.32,0.72,0,1) !important',
              ].join(';');

              if (!document.getElementById('fedapay-sheet-style')) {
                const styleEl = document.createElement('style');
                styleEl.id = 'fedapay-sheet-style';
                styleEl.textContent = `
                  @keyframes slideUpSheet {
                    from { transform: translateY(100%); }
                    to   { transform: translateY(0); }
                  }
                `;
                document.head.appendChild(styleEl);
              }

              const iframe = fedaEl.querySelector('iframe') as HTMLElement | null;
              if (iframe) {
                iframe.style.cssText = 'width:100%!important;height:100%!important;border:none!important;';
              }
            }
          }, 100)

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
    <BottomSheet open={isOpen} onClose={onClose} noPadding className="h-[calc(100dvh-110px)] sm:h-[90vh] font-poppins">
      <div className="flex flex-col h-full overflow-hidden w-full bg-white dark:bg-[#1A1A1A] rounded-t-[32px]">
        {/* Custom Header (Fixed) */}
        <div className="flex-none flex items-center justify-between px-[1rem] pt-[1rem] pb-[0.75rem] border-b border-[#E0E0E0] min-h-[56px]">
          <button onClick={onClose} className="w-[32px] h-[32px] flex items-center justify-start active:scale-95 transition-transform">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-900 dark:text-white">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <h2 className="font-semibold text-gray-900 dark:text-white text-center flex-1 pr-[32px] text-[clamp(14px,4vw,16px)]">Rejoindre l'événement</h2>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-[1rem] py-[1.25rem] flex flex-col gap-[1rem]">
          {/* Recap Section */}
          <div className="w-full flex flex-col p-[1rem] rounded-[8px] border border-dashed border-[#CED1D3] gap-[0.75rem]">
            <span className="font-semibold text-gray-900 dark:text-white text-[clamp(14px,4vw,16px)]">{event.title}</span>
            <div className="flex items-center justify-between border-t border-[#CED1D3] border-dashed pt-[0.75rem]">
              <span className="font-normal text-gray-500 dark:text-gray-400 text-[clamp(12px,3.5vw,14px)]">Participation</span>
              <span className="font-normal text-gray-900 dark:text-white text-[clamp(12px,3.5vw,14px)]">
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
                <label className="font-medium text-gray-900 dark:text-white text-[clamp(12px,3.5vw,14px)] mb-[0.25rem]">Montant de votre participation</label>
                <div className="relative w-full">
                  <Input
                    type="number"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    placeholder="0"
                    className="w-full pr-[60px] min-h-[48px] h-auto rounded-[8px] bg-white dark:bg-[#1A1A1A] border border-[var(--border-default)] text-gray-900 dark:text-white font-normal text-[clamp(12px,3.5vw,14px)] placeholder:text-[#BDBDBD] box-border"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-normal text-gray-900 dark:text-white text-[clamp(12px,3.5vw,14px)]">
                    F CFA
                  </span>
                </div>
                <span className="text-[clamp(10px,3vw,12px)] font-normal text-[#525252] mt-[0.25rem]">Minimum {minAmount}F</span>
              </div>

              <div className="flex flex-col">
                <label className="font-medium text-gray-900 dark:text-white text-[clamp(12px,3.5vw,14px)] mb-[0.25rem]">Méthode de paiement</label>
                <div className="flex flex-row items-center px-[1rem] py-[0.75rem] gap-[8px] w-full min-h-[48px] h-auto bg-white dark:bg-[#1A1A1A] border border-[var(--border-default)] rounded-[8px] box-border">
                  <img src="/logos/mobile-money.png" alt="Mobile money" className="w-[20px] h-[20px] object-contain shrink-0" />
                  <span className="flex-1 font-normal text-gray-900 dark:text-white text-[clamp(12px,3.5vw,14px)] text-left truncate">Mobile money</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#A3A3A3] shrink-0">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </div>
              </div>

              <div className="flex flex-col">
                <label className="font-medium text-gray-900 dark:text-white text-[clamp(12px,3.5vw,14px)] mb-[0.25rem]">Opérateur</label>
                <div className="w-full">
                  <PaymentDropdown
                    options={OPERATORS}
                    value={operatorId}
                    onChange={setOperatorId}
                  />
                </div>
              </div>

              <div className="flex flex-col">
                <label className="font-medium text-gray-900 dark:text-white text-[clamp(12px,3.5vw,14px)] mb-[0.25rem]">Numéro de téléphone</label>
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
        <div className="flex-none flex flex-col gap-[0.5rem] px-[1rem] pt-[0.5rem] pb-[1rem] bg-white dark:bg-[#1A1A1A] border-t border-[#F5F5F5]">
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

          <div className="flex flex-col items-center justify-center gap-[4px] py-[0.5rem] w-full text-center">
            <div className="flex items-center justify-center gap-[6px] font-medium text-gray-900 dark:text-white text-[clamp(12px,3.5vw,14px)]">
              Sécurisé PCI DSS 
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1.34844 0C0.990808 0 0.647828 0.142067 0.394948 0.394948C0.142067 0.647828 0 0.990808 0 1.34844V5.3061C0 11.5255 5.28169 13.5833 6.30877 13.9253C6.58912 14.0249 6.89525 14.0249 7.17559 13.9253C8.20267 13.5833 13.4844 11.5255 13.4844 5.3061V1.34844C13.4844 0.99081 13.3423 0.64783 13.0894 0.394948C12.8365 0.142067 12.4936 0 12.1359 0H1.34844Z" fill="#14CD7F"/>
                <path d="M9.50648 4.04541L6.04353 7.34908L4.315 5.69724" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-[#6B7280] text-[clamp(11px,3vw,13px)] font-medium">Fedapay</span>
          </div>
        </div>
      </div>
    </BottomSheet>
  )
}
