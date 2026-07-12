import React, { useEffect, useRef, useState } from 'react'
import { Loader2, ChevronLeft, XCircle, ChevronDown, Check } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { PhoneInputField } from '@/components/shared/PhoneInputField'
import { COUNTRIES, Country } from '@/lib/countries'
import { usePhoneFormatter } from '@/lib/usePhoneFormatter'

const OPERATORS = [
  { id: 'mtn', label: 'MTN Momo', logo: '/logos/mtn.png', prefix: '97' },
  { id: 'moov', label: 'MOOV', logo: '/logos/moov.png', prefix: '96' },
  { id: 'celtis', label: 'CELTIS', logo: '/logos/celtiis.png', prefix: '95' },
]

export interface PaymentFlowProps {
  headerTitle: string;
  headerCard?: React.ReactNode;
  minAmount?: number;
  defaultAmount?: string;
  formSubmitText: string;
  summaryTitle?: string;
  summaryItemTitle?: string;
  summaryItemSubtitle?: React.ReactNode;
  summaryItemDetails?: React.ReactNode;
  summarySubmitText: string;
  transactionFee?: number;
  amountLabel?: string;
  onInitiate: (amount: number) => Promise<{
    devMode?: boolean;
    transactionId?: string;
    transactionToken?: string;
    publicKey?: string;
    amount?: number;
    description?: string;
  }>;
  onDevConfirm: (amount: number) => Promise<void>;
  onSuccess: (amount: number) => void;
  successScreen?: React.ReactNode;
  onBack?: () => void;
}

export function PaymentFlow({
  headerTitle,
  headerCard,
  minAmount = 0,
  defaultAmount = '',
  formSubmitText,
  summaryTitle = 'Résumé de la transaction',
  summaryItemTitle,
  summaryItemSubtitle,
  summaryItemDetails,
  summarySubmitText,
  transactionFee = 100,
  amountLabel = 'Participation',
  onInitiate,
  onDevConfirm,
  onSuccess,
  successScreen,
  onBack,
}: PaymentFlowProps) {
  const [status, setStatus] = useState<'form' | 'loading' | 'summary' | 'success' | 'error'>('form')
  const [participationAmount, setParticipationAmount] = useState(defaultAmount)
  const [country, setCountry] = useState<Country>(COUNTRIES[0])
  
  const {
    displayValue: phoneDisplay,
    rawValue: phoneNumber,
    handleChange: handlePhoneChange,
    reset: resetPhone,
  } = usePhoneFormatter()
  
  const [selectedOperator, setSelectedOperator] = useState(OPERATORS[0])
  const [showOperatorDropdown, setShowOperatorDropdown] = useState(false)
  const operatorRef = useRef<HTMLDivElement>(null)

  const finalAmount = Number(participationAmount) || 0
  const netToPay = finalAmount + transactionFee

  const cleanPhone = phoneNumber.trim().replace(/\s+/g, '')
  const isBenin = country.code === '+229' || country.cca2 === 'BJ'
  const isValidPhone = isBenin 
    ? (cleanPhone.length >= 10 && cleanPhone.startsWith('01')) 
    : cleanPhone.length > 0

  const isFormValid = finalAmount > 0 && !(minAmount > 0 && finalAmount < minAmount) && isValidPhone;

  useEffect(() => {
    if (defaultAmount && !participationAmount) {
      setParticipationAmount(defaultAmount)
    }
  }, [defaultAmount])

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
    if (!finalAmount || finalAmount <= 0) {
      toast.error('Veuillez entrer un montant valide')
      return
    }
    if (minAmount > 0 && finalAmount < minAmount) {
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
    setStatus('loading')

    try {
      const data = await onInitiate(finalAmount)

      if (data.devMode) {
        await handleDevConfirm(finalAmount)
      } else {
        const script = document.createElement('script')
        script.src = 'https://cdn.fedapay.com/checkout.js?v=1.1.7'
        script.async = true
        document.head.appendChild(script)
        script.onload = () => {
          const FedaPay = (window as any).FedaPay
          FedaPay.init({
            public_key: data.publicKey,
            transaction: { 
              id: data.transactionId, 
              token: data.transactionToken, 
              amount: data.amount, 
              description: data.description 
            },
            onComplete: (resp: any) => {
              if (resp.reason === FedaPay.DIALOG_DISMISSED) {
                setStatus('error')
                toast.error('Paiement annulé')
                document.getElementById('fedapay-backdrop')?.remove()
              } else {
                document.getElementById('fedapay-backdrop')?.remove()
                setStatus('success')
                onSuccess(finalAmount)
              }
            },
          }).open()

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
                backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9990;transition:opacity 0.3s;';
                backdrop.onclick = () => fedaEl.click?.();
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
                styleEl.textContent = `@keyframes slideUpSheet { from { transform: translateY(100%); } to { transform: translateY(0); } }`;
                document.head.appendChild(styleEl);
              }

              const iframe = fedaEl.querySelector('iframe') as HTMLElement | null;
              if (iframe) iframe.style.cssText = 'width:100%!important;height:100%!important;border:none!important;';
            }
          }, 100)
        }
      }
    } catch (err: any) {
      setStatus('error')
      toast.error(err.response?.data?.error || 'Erreur lors du paiement')
    }
  }

  const handleDevConfirm = async (amount: number) => {
    try {
      await onDevConfirm(amount)
      setStatus('success')
      onSuccess(amount)
    } catch (err: any) {
      setStatus('error')
      toast.error(err.response?.data?.error || 'Erreur')
    }
  }

  if (status === 'success') {
    return <>{successScreen}</>
  }

  if (status === 'error') {
    return (
      <div className="w-full h-full bg-white dark:bg-[#1A1A1A] flex flex-col font-poppins">
        <div className="px-5 pt-safe-4 pt-4 pb-3 flex items-center">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center bg-gray-100 dark:bg-[#2a2a2a] rounded-full active:scale-95">
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
          <XCircle className="w-20 h-20 text-red-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Paiement impossible</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Vérifiez le montant ou réessayez.</p>
          <button onClick={() => setStatus('form')} className="w-full bg-gray-900 text-white py-4 rounded-full font-bold">
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-white dark:bg-[#1A1A1A] gap-4 font-poppins">
        <Loader2 className="w-10 h-10 text-[#FF7A00] animate-spin" />
        <p className="text-gray-500 dark:text-gray-400 text-[14px]">Traitement en cours...</p>
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-white dark:bg-[#1A1A1A] flex flex-col" style={{ fontFamily: 'Poppins, sans-serif' }}>
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-5 pt-safe-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center active:scale-95">
          <ChevronLeft className="w-[22px] h-[22px] text-gray-900 dark:text-white" strokeWidth={2} />
        </button>
        <span className="flex-1 text-center text-[16px] font-semibold text-gray-900 dark:text-white -ml-8">
          {headerTitle}
        </span>
      </div>

      {/* ── Form content ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-40" style={{ scrollbarWidth: 'none' }}>
        {headerCard}

        {/* ── Amount field ── */}
        <div className="mb-4">
          <label className="block text-[13px] font-medium text-gray-900 dark:text-white mb-2">
            Montant de votre participation
          </label>
          <div className="flex items-center border border-[#DFDFDF] rounded-[10px] bg-white dark:bg-[#1A1A1A] overflow-hidden h-[52px] focus-within:border-2 focus-within:border-[var(--border-brand-primary)] transition-all duration-150">
            <input
              type="number"
              value={participationAmount}
              onChange={(e) => setParticipationAmount(e.target.value)}
              placeholder="0"
              className="flex-1 px-4 text-[15px] text-gray-900 dark:text-white placeholder:text-[#C0C0C0] outline-none bg-transparent h-full"
            />
            <span className="pr-4 text-[13px] font-semibold text-[#8D8D8D]">F CFA</span>
          </div>
          {minAmount > 0 && (
            <p className="text-[11px] text-[#8D8D8D] mt-1 ml-0.5">Minimum {minAmount.toLocaleString()}F</p>
          )}
        </div>

        {/* ── Payment method ── */}
        <div className="mb-4">
          <label className="block text-[13px] font-medium text-gray-900 dark:text-white mb-2">Méthode de paiement</label>
          <div className="flex flex-row items-center p-[10px] gap-[4px] w-full h-[44px] bg-white dark:bg-[#1A1A1A] border border-[#E0E0E0] rounded-[6px]">
            <img src="/logos/mobile-money.png" alt="Mobile money" className="w-6 h-6 object-contain shrink-0" />
            <span className="flex-1 text-[14px] text-gray-900 dark:text-white text-left">Mobile money</span>
            <ChevronDown className="w-4 h-4 text-[#8D8D8D] shrink-0" />
          </div>
        </div>

        {/* ── Operator (real dropdown) ── */}
        <div className="mb-4" ref={operatorRef}>
          <label className="block text-[13px] font-medium text-gray-900 dark:text-white mb-2">Opérateur</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowOperatorDropdown(!showOperatorDropdown)}
              className="w-full flex flex-row items-center p-[10px] gap-[4px] h-[44px] bg-white dark:bg-[#1A1A1A] border border-[#E0E0E0] rounded-[6px] active:bg-gray-50 dark:bg-[#222222] transition-colors"
            >
              <img src={selectedOperator.logo} alt={selectedOperator.label} className="w-6 h-6 object-contain shrink-0" />
              <span className="flex-1 text-[14px] text-gray-900 dark:text-white text-left">{selectedOperator.label}</span>
              <ChevronDown
                className="w-4 h-4 text-[#8D8D8D] shrink-0 transition-transform duration-200"
                style={{ transform: showOperatorDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>

            {showOperatorDropdown && (
              <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-30 bg-white dark:bg-[#1A1A1A] border border-[#DFDFDF] rounded-[10px] shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
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
                    <span className="flex-1 text-[14px] text-gray-900 dark:text-white text-left">{op.label}</span>
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
          <label className="block text-[13px] font-medium text-gray-900 dark:text-white mb-2">Numéro de téléphone</label>
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

      <div
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-[#1A1A1A] px-5 pt-3 flex flex-col items-center gap-2 border-t border-[#F0F0F0]"
        style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
      >
        <Button onClick={handleOpenSummary} className="w-full" disabled={!isFormValid}>
          {formSubmitText}
        </Button>
        <div className="flex flex-col items-center justify-center gap-[4px] pt-[0.25rem] w-full text-center">
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

      {/* ── Transaction Summary Bottom Sheet ── */}
      {status === 'summary' && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-end justify-center animate-in fade-in duration-200">
          <div className="w-full bg-white dark:bg-[#1A1A1A] rounded-t-[24px] shadow-2xl animate-in slide-in-from-bottom duration-300" style={{ fontFamily: 'Poppins, sans-serif' }}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-[#E0E0E0] rounded-full" />
            </div>

            <div className="px-5 pt-4" style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))' }}>
              <h2 className="text-[17px] font-bold text-gray-900 dark:text-white mb-5 text-center">{summaryTitle}</h2>

              <div className="mb-5">
                <h3 className="text-[16px] font-bold text-gray-900 dark:text-white">{summaryItemTitle}</h3>
                {summaryItemSubtitle && <p className="text-[12px] text-[#8D8D8D] mt-0.5">{summaryItemSubtitle}</p>}
                {summaryItemDetails && <p className="text-[12px] text-[#8D8D8D]">{summaryItemDetails}</p>}
              </div>

              {/* Phone + operator */}
              <div className="flex items-center gap-2 bg-[#F8F8F8] rounded-[10px] px-4 py-3 mb-1">
                <img src={selectedOperator.logo} alt={selectedOperator.label} className="w-6 h-6 object-contain shrink-0" />
                <span className="text-[14px] font-semibold text-gray-900 dark:text-white flex-1">{selectedOperator.label} • {country.code.replace('+', '')} {phoneDisplay}</span>
              </div>
              <p className="text-[11px] text-[#8D8D8D] mb-5 text-center">Moyen sécurisé de paiement</p>

              {/* Breakdown */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#8D8D8D]">{amountLabel}</span>
                  <span className="text-[13px] font-semibold text-gray-900 dark:text-white">{finalAmount.toLocaleString()}F</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#8D8D8D]">Frais de transaction</span>
                  <span className="text-[13px] font-semibold text-gray-900 dark:text-white">{transactionFee.toLocaleString()} F</span>
                </div>
                <div className="border-t border-[#F0F0F0] pt-3 flex items-center justify-between">
                  <span className="text-[14px] font-bold text-gray-900 dark:text-white">Net à payer</span>
                  <span className="text-[15px] font-bold text-gray-900 dark:text-white">{netToPay.toLocaleString()} F</span>
                </div>
              </div>

              <Button onClick={handlePay} className="w-full mt-2">
                {summarySubmitText}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
